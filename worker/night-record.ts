import { DurableObject } from "cloudflare:workers";
import { nightGET } from "../src/lib/night-api";
import type { NightData } from "../src/lib/night";
import { rowFrom, stockRowsFrom, summarize, summarizeStocks, type RecordRow, type StockRow } from "../src/lib/night-record";

/**
 * 추정 적중 기록 저장소. 거래일마다 '09:00 직전 추정값 vs KRX 코스피200 선물 주간 시가' 한 줄.
 * 장중(09:20~15:45)에 누가 기록을 볼 때나 장중 예약 작업(13:20·14:00·14:40)이 돌 때 오늘 줄이 없으면 채운다.
 */
const TRY_MS = 5 * 60_000;

export class NightRecord extends DurableObject {
  private tried = 0;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS rec (day TEXT PRIMARY KEY, est REAL NOT NULL, open REAL NOT NULL, base REAL NOT NULL,
         base_kind TEXT NOT NULL, weekend INTEGER NOT NULL, at INTEGER NOT NULL);`,
    );
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS stock_rec (day TEXT NOT NULL, coin TEXT NOT NULL, est REAL NOT NULL, open REAL NOT NULL, base REAL NOT NULL,
         at INTEGER NOT NULL, PRIMARY KEY (day, coin));`,
    );
  }

  private rows(): RecordRow[] {
    return this.ctx.storage.sql
      .exec<{ day: string; est: number; open: number; base: number; base_kind: string; weekend: number }>(`SELECT * FROM rec ORDER BY day DESC LIMIT 60`)
      .toArray()
      .map((r) => ({ day: r.day, est: r.est, open: r.open, base: r.base, baseKind: r.base_kind === "close" ? "close" : "est", weekend: !!r.weekend }));
  }

  private stockRows(): StockRow[] {
    return this.ctx.storage.sql
      .exec<{ day: string; coin: string; est: number; open: number; base: number }>(`SELECT * FROM stock_rec ORDER BY day DESC LIMIT 120`)
      .toArray()
      .map((r) => ({ day: r.day, coin: r.coin, est: r.est, open: r.open, base: r.base }));
  }

  /** 오늘 KOSPI200 줄과 종목 두 줄이 모두 있는지 */
  private complete(today: string) {
    const stocks = this.ctx.storage.sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM stock_rec WHERE day = ?`, today).one().n;
    return this.rows()[0]?.day === today && stocks >= 2;
  }

  /** 장중이고 오늘 줄이 없으면 /api/night 를 읽어 채운다(5분에 한 번까지) */
  async fill(origin: string, force = false) {
    const now = Date.now();
    if (!force && now - this.tried < TRY_MS) return;
    this.tried = now;
    const res = await nightGET(new Request(`${origin}/api/night`));
    if (!res.ok) return;
    const data = (await res.json()) as NightData;
    for (const r of stockRowsFrom(data))
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO stock_rec (day, coin, est, open, base, at) VALUES (?, ?, ?, ?, ?, ?)`,
        r.day,
        r.coin,
        r.est,
        r.open,
        r.base,
        now,
      );
    const row = rowFrom(data);
    if (!row) return;
    // 같은 날은 처음 받은 값 그대로 둔다(시가는 하루 한 번 정해진다)
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO rec (day, est, open, base, base_kind, weekend, at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.day,
      row.est,
      row.open,
      row.base,
      row.baseKind,
      row.weekend ? 1 : 0,
      now,
    );
  }

  async fetch(req: Request) {
    const url = new URL(req.url);
    const kst = new Date(Date.now() + 9 * 3600_000);
    const hm = kst.getUTCHours() * 60 + kst.getUTCMinutes();
    const today = kst.toISOString().slice(0, 10);
    const have = this.complete(today);
    if (!have && hm >= 9 * 60 + 20 && hm < 15 * 60 + 45) await this.fill(url.origin, url.searchParams.has("force")).catch(() => undefined);
    return Response.json({ ...summarize(this.rows()), stocks: summarizeStocks(this.stockRows()) }, { headers: { "Cache-Control": "no-store" } });
  }
}
