/**
 * 미국 정규장 흐름. S&P 500·나스닥 100을 따르는 Hyperliquid(trade.xyz) 무기한선물로
 * 직전 거래일 16:00(뉴욕) 대비 등락을 그린다. 지수 시세를 받지 않는다(실시간 재배포는 계약이 필요하다).
 */

import { INPUTS, priceAt, round2, type Candle } from "./night";
import type { UsSession } from "./session";

export const US_STEP = 5 * 60_000;

/** 화면에 같이 보여 줄 무기한선물(앞 둘이 차트) */
export const US_INPUTS = [
  { coin: "SP500", label: "S&P 500 무기한선물" },
  { coin: "XYZ100", label: "나스닥 100 무기한선물" },
  ...INPUTS.filter((i) => !["SP500", "XYZ100"].includes(i.coin)),
] as const;

/** [봉이 끝난 시각, S&P 등락 %, 나스닥 등락 %] */
export type UsPoint = [t: number, sp: number | null, nd: number | null];

export type UsInput = { coin: string; label: string; price: number; chg: number | null; krw?: number };

export type UsData = {
  session: UsSession;
  points: UsPoint[];
  /** 지금(또는 마감) 등락 % */
  sp: number | null;
  nd: number | null;
  inputs: UsInput[];
  updated: number;
};

const pct = (v: number, base: number) => round2((v / base - 1) * 100);

export function assembleUs(
  now: number,
  session: UsSession,
  candles: Record<string, Candle[]>,
  marks: Record<string, number | null>,
  step = US_STEP,
): UsData | null {
  const sp0 = priceAt(candles.SP500 ?? [], session.prevClose)?.c;
  const nd0 = priceAt(candles.XYZ100 ?? [], session.prevClose)?.c;
  if (!sp0 || !nd0) return null;
  const nd = new Map((candles.XYZ100 ?? []).map((k) => [k.t, k.c]));
  const points: UsPoint[] = [];
  const spOpen = priceAt(candles.SP500, session.open)?.c;
  const ndOpen = priceAt(candles.XYZ100, session.open)?.c;
  points.push([session.open, spOpen ? pct(spOpen, sp0) : null, ndOpen ? pct(ndOpen, nd0) : null]);
  for (const k of candles.SP500) {
    const t = k.t + step;
    if (t <= session.open || t > session.close) continue;
    const n = nd.get(k.t);
    points.push([t, pct(k.c, sp0), n != null ? pct(n, nd0) : null]);
  }
  if (session.live && marks.SP500 && marks.XYZ100) {
    const live: UsPoint = [now, pct(marks.SP500, sp0), pct(marks.XYZ100, nd0)];
    const last = points[points.length - 1];
    if (now - last[0] < step) points[points.length - 1] = [last[0], live[1], live[2]];
    else points.push(live);
  }
  const lastOf = (i: 1 | 2) => [...points].reverse().find((p) => p[i] != null)?.[i] ?? null;
  const krw = marks.KRW ?? null;
  const inputs: UsInput[] = US_INPUTS.map((i) => {
    // 장이 끝났으면 마감 가격, 열려 있으면 지금 가격
    const price = session.live ? (marks[i.coin] ?? null) : (priceAt(candles[i.coin] ?? [], session.close)?.c ?? marks[i.coin] ?? null);
    const at = priceAt(candles[i.coin] ?? [], session.prevClose)?.c;
    return {
      coin: i.coin,
      label: i.label,
      price: price ?? NaN,
      chg: price != null && at ? pct(price, at) : null,
      ...("krw" in i && i.krw && price != null && krw ? { krw: Math.round(price * krw) } : {}),
    };
  }).filter((i) => Number.isFinite(i.price));
  return { session, points, sp: lastOf(1), nd: lastOf(2), inputs, updated: now };
}
