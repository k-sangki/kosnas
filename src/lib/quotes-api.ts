/**
 * 대시보드 시세 카드(트레이딩뷰 위젯 대신 직접 그리는 카드)와 원/달러 카드의 시세.
 * 야후 파이낸스 일봉 차트(1일, 5분 간격)에서 지금 가격·전일 종가·오늘 선을 꺼낸다.
 * 주말·휴장에는 야후가 마지막 거래일을 주므로 국내 앱처럼 그날 하루 등락이 보인다.
 * 받지 못한 종목은 빼고 주며, 화면은 그 카드를 트레이딩뷰 위젯으로 되돌린다.
 */
import { thin } from "./night";

/** 카드 id → 야후 심볼 */
export const YAHOO: Record<string, string> = {
  SOXX: "SOXX",
  QQQ: "QQQ",
  SPY: "SPY",
  USO: "USO",
  WTI: "CL=F",
  BRENT: "BZ=F",
  GOLD: "GC=F",
  DXY: "DX-Y.NYB",
  KRW: "KRW=X",
};

export type Quote = {
  price: number;
  /** 전일 종가(등락률 기준) */
  prev: number;
  /** 마지막 가격 시각(ms) */
  at: number;
  spark: number[];
  /** spark 각 점의 가로 위치(0~1). 정규장 6시간 30분(주식) 또는 24시간(선물·환율) 위에 둔다 */
  sparkT: number[];
};

const TTL = 60;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const HOUR = 3_600_000;

type Chart = {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; regularMarketTime?: number };
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
  };
};

/** 야후 차트 응답 하나를 카드 자료로. 값이 모자라면 null */
export function toQuote(b: Chart): Quote | null {
  const r = b.chart?.result?.[0];
  const m = r?.meta;
  const price = m?.regularMarketPrice;
  const prev = m?.chartPreviousClose ?? m?.previousClose;
  if (!price || !prev || price <= 0 || prev <= 0) return null;
  const ts = r?.timestamp ?? [];
  const cs = r?.indicators?.quote?.[0]?.close ?? [];
  const pts: [number, number][] = [];
  ts.forEach((t, k) => {
    const c = cs[k];
    if (c != null && c > 0) pts.push([t * 1000, c]);
  });
  const at = (m?.regularMarketTime ?? 0) * 1000 || pts[pts.length - 1]?.[0] || Date.now();
  // 끝 점은 지금 가격으로 맞춘다(마지막 5분봉 종가와 조금 다를 수 있다)
  if (pts.length) pts[pts.length - 1] = [pts[pts.length - 1][0], price];
  const p = thin(pts, 80);
  if (p.length < 2) return { price, prev, at, spark: [], sparkT: [] };
  const t0 = p[0][0];
  const used = p[p.length - 1][0] - t0;
  // 6시간 30분 안에 끝나는 정규장(주식)이면 그 길이를, 아니면 하루를 가로축 전체로 둔다
  const span = Math.max(used, used <= 7 * HOUR ? 6.5 * HOUR : 23 * HOUR) || 1;
  return {
    price,
    prev,
    at,
    spark: p.map((x) => x[1]),
    sparkT: p.map((x) => Math.round(((x[0] - t0) / span) * 1000) / 1000),
  };
}

async function one(sym: string): Promise<Quote | null> {
  for (const host of ["query1", "query2"]) {
    try {
      const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m&includePrePost=false`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!r.ok) continue;
      const q = toQuote((await r.json()) as Chart);
      if (q) return q;
    } catch {}
  }
  return null;
}

export async function quotesGET(req: Request) {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL("/api/quotes", req.url).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit;
  const ids = Object.keys(YAHOO);
  const got = await Promise.all(ids.map((id) => one(YAHOO[id])));
  const out: Record<string, Quote> = {};
  ids.forEach((id, k) => {
    const q = got[k];
    if (q) out[id] = q;
  });
  const ok = Object.keys(out).length > 0;
  const res = Response.json({ quotes: out, updated: Date.now() }, { headers: { "Cache-Control": `public, max-age=${ok ? TTL : 15}` } });
  if (ok) await cache?.put(key, res.clone()).catch(() => undefined);
  return res;
}
