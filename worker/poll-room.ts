import { DurableObject } from "cloudflare:workers";
import {
  PER_TAG,
  SETTLE_DELAY,
  closeAt,
  currentRound,
  isSide,
  isVoter,
  roundFor,
  type PastRound,
  type PollState,
  type Side,
} from "../src/lib/poll";

/**
 * 첫 화면 '오늘의 한 표' 저장소(회차·표). 투표자는 브라우저마다 만든 익명 번호이고,
 * IP는 저장하지 않고 그날 해시 꼬리표로 한 회차에 PER_TAG 표까지만 받는다.
 * 지난 회차는 누가 상태를 물을 때 판정 가격을 받아 채운다.
 */
const HL_INFO = "https://api.hyperliquid.xyz/info";
const PAST = 20;
const RETRY_MS = 5 * 60_000;

async function tagOf(ip: string, now: number) {
  const day = new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kosnas-poll:${day}:${ip}`));
  return Array.from(new Uint8Array(buf).slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 코스피200 무기한선물 15분봉으로 회차 등락률(%) */
async function settlePct(target: string): Promise<number | null> {
  const r = roundFor(target);
  const res = await fetch(HL_INFO, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "candleSnapshot", req: { coin: "xyz:KR200", interval: "15m", startTime: r.start - 3 * 3600_000, endTime: r.end } }),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as { t: number; c: string }[];
  const candles = rows.map((k) => ({ t: k.t, c: Number(k.c) })).filter((k) => k.c > 0);
  const a = closeAt(candles, r.start);
  const b = closeAt(candles, r.end);
  return a && b ? (b / a - 1) * 100 : null;
}

export class PollRoom extends DurableObject {
  private tried = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS vote (target TEXT NOT NULL, voter TEXT NOT NULL, side TEXT NOT NULL, tag TEXT NOT NULL, at INTEGER NOT NULL,
         PRIMARY KEY (target, voter));
       CREATE TABLE IF NOT EXISTS result (target TEXT PRIMARY KEY, pct REAL);`,
    );
  }

  private counts(target: string) {
    const rows = this.ctx.storage.sql.exec<{ side: string; n: number }>(`SELECT side, COUNT(*) AS n FROM vote WHERE target = ? GROUP BY side`, target).toArray();
    const n = (s: Side) => rows.find((r) => r.side === s)?.n ?? 0;
    return { up: n("up"), down: n("down") };
  }

  /** 판정 시각이 지났는데 결과가 없는 회차를 채운다(실패하면 5분 뒤 다시) */
  private async settle(now: number) {
    const sql = this.ctx.storage.sql;
    const open = sql
      .exec<{ target: string }>(`SELECT DISTINCT target FROM vote WHERE target NOT IN (SELECT target FROM result) ORDER BY target DESC LIMIT 5`)
      .toArray()
      .map((r) => r.target)
      .filter((t) => roundFor(t).end + SETTLE_DELAY <= now && now - (this.tried.get(t) ?? 0) > RETRY_MS);
    for (const t of open) {
      this.tried.set(t, now);
      const pct = await settlePct(t).catch(() => null);
      // 일주일이 지나도 가격을 못 받으면 결과 없음으로 닫는다
      if (pct != null || now - roundFor(t).end > 7 * 86_400_000) sql.exec(`INSERT OR REPLACE INTO result (target, pct) VALUES (?, ?)`, t, pct);
    }
  }

  private state(now: number, voter: string | null): PollState {
    const r = currentRound(now);
    const mine = voter
      ? (this.ctx.storage.sql.exec<{ side: string }>(`SELECT side FROM vote WHERE target = ? AND voter = ?`, r.target, voter).toArray()[0]?.side ?? null)
      : null;
    const past: PastRound[] = this.ctx.storage.sql
      .exec<{ target: string; pct: number | null }>(`SELECT target, pct FROM result ORDER BY target DESC LIMIT ?`, PAST)
      .toArray()
      .map((x) => ({ target: x.target, pct: x.pct, ...this.counts(x.target) }));
    return {
      round: { target: r.target, open: now < r.closes, closes: r.closes, end: r.end, ...this.counts(r.target), mine: isSide(mine) ? mine : null },
      past,
    };
  }

  async fetch(req: Request) {
    const now = Date.now();
    const url = new URL(req.url);
    if (req.method === "GET") {
      await this.settle(now);
      const v = url.searchParams.get("voter");
      return Response.json(this.state(now, isVoter(v) ? v : null), { headers: { "Cache-Control": "no-store" } });
    }
    if (req.method !== "POST") return new Response("method", { status: 405 });
    let body: { voter?: unknown; side?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "잘못된 요청" }, { status: 400 });
    }
    if (!isVoter(body.voter) || !isSide(body.side)) return Response.json({ error: "잘못된 요청" }, { status: 400 });
    const r = currentRound(now);
    if (now >= r.closes) return Response.json({ error: "투표가 마감됐어요. 장이 끝난 뒤 다음 회차가 열립니다." }, { status: 409 });
    const sql = this.ctx.storage.sql;
    const had = sql.exec(`SELECT 1 FROM vote WHERE target = ? AND voter = ?`, r.target, body.voter).toArray().length > 0;
    if (!had) {
      const tag = await tagOf(req.headers.get("CF-Connecting-IP") ?? "", now);
      const n = sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM vote WHERE target = ? AND tag = ?`, r.target, tag).one().n;
      if (n >= PER_TAG) return Response.json({ error: "이 회차에는 이미 투표했어요." }, { status: 429 });
      sql.exec(`INSERT INTO vote (target, voter, side, tag, at) VALUES (?, ?, ?, ?, ?)`, r.target, body.voter, body.side, tag, now);
    } else {
      // 마감 전에는 마음을 바꿀 수 있다
      sql.exec(`UPDATE vote SET side = ?, at = ? WHERE target = ? AND voter = ?`, body.side, now, r.target, body.voter);
    }
    return Response.json(this.state(now, body.voter), { headers: { "Cache-Control": "no-store" } });
  }
}
