import type { NightData } from "./night";

/**
 * 추정 적중 기록: 거래일마다 '09:00 직전 추정값 vs 그날 KRX 코스피200 선물 주간 시가'를 하나씩 남긴다.
 * 저장은 worker/night-record.ts(Durable Object), 계산·모양은 여기.
 */
export type RecordRow = {
  /** 거래일(KST, YYYY-MM-DD) */
  day: string;
  est: number;
  open: number;
  base: number;
  /** close = KRX 주간 종가 기준(방향을 볼 수 있음), est = 15:45 추정 기준 */
  baseKind: "close" | "est";
  /** 금요일 밤~월요일 아침(주말을 낀 추정) */
  weekend: boolean;
};

/** 원화 환산 종목 한 줄: 09:00 추정 원화 가격 vs 그날 KRX 시가, 기준은 전일 KRX 종가 */
export type StockRow = { day: string; coin: string; est: number; open: number; base: number };

export type StockSummary = {
  rows: (StockRow & { err: number; hit: boolean })[];
  n: number;
  mae: number | null;
  dirHit: number;
};

export type RecordSummary = {
  /** 종목별(삼성전자·SK하이닉스) 기록 */
  stocks?: Record<string, StockSummary>;
  rows: (RecordRow & { err: number; hit: boolean | null })[];
  /** 최근 n일 등락률 차이 절댓값 평균(%p) */
  n: number;
  mae: number | null;
  /** 방향을 볼 수 있는 날(baseKind=close) 중 맞은 날 */
  dirN: number;
  dirHit: number;
  since: string | null;
};

/** 장중 /api/night 자료에서 오늘 기록 한 줄(시가가 아직 없으면 null) */
export function rowFrom(d: NightData): RecordRow | null {
  // 장중 est는 지금 값이라 09:00 추정(at0900)을 쓴다
  const est = d.at0900 ?? d.est;
  if (d.window.live || d.open == null || !(d.base > 0) || !(est > 0)) return null;
  const day = new Date(d.window.end + 9 * 3600_000).toISOString().slice(0, 10);
  const weekend = new Date(d.window.start + 9 * 3600_000).getUTCDay() === 5;
  return { day, est, open: d.open, base: d.base, baseKind: d.baseKind, weekend };
}

/** 장중 /api/night 자료에서 오늘 종목 기록(시가를 받은 종목만) */
export function stockRowsFrom(d: NightData): StockRow[] {
  if (d.window.live || !d.stocks) return [];
  const day = new Date(d.window.end + 9 * 3600_000).toISOString().slice(0, 10);
  return Object.entries(d.stocks).flatMap(([coin, v]) =>
    v.at0900 != null && v.open != null && v.close > 0 ? [{ day, coin, est: v.at0900, open: v.open, base: v.close }] : [],
  );
}

export function summarizeStocks(rows: StockRow[], keep = 30): Record<string, StockSummary> {
  const out: Record<string, StockSummary> = {};
  for (const coin of [...new Set(rows.map((r) => r.coin))]) {
    const recent = rows
      .filter((r) => r.coin === coin)
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .slice(0, keep)
      .map((r) => ({ ...r, err: Math.round(errPct(r) * 1000) / 1000, hit: Math.sign(r.est - r.base) === Math.sign(r.open - r.base) }));
    out[coin] = {
      rows: recent,
      n: recent.length,
      mae: recent.length ? Math.round((recent.reduce((a, r) => a + Math.abs(r.err), 0) / recent.length) * 1000) / 1000 : null,
      dirHit: recent.filter((r) => r.hit).length,
    };
  }
  return out;
}

/** 등락률 차이(%p): 추정 등락률 − 시가 등락률 */
export const errPct = (r: Pick<RecordRow, "est" | "open" | "base">) => ((r.est - r.open) / r.base) * 100;

export function summarize(rows: RecordRow[], keep = 30): RecordSummary {
  const recent = [...rows].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, keep);
  const out = recent.map((r) => ({
    ...r,
    err: Math.round(errPct(r) * 1000) / 1000,
    hit: r.baseKind === "close" ? Math.sign(r.est - r.base) === Math.sign(r.open - r.base) : null,
  }));
  const dir = out.filter((r) => r.hit != null);
  return {
    rows: out,
    n: out.length,
    mae: out.length ? Math.round((out.reduce((a, r) => a + Math.abs(r.err), 0) / out.length) * 1000) / 1000 : null,
    dirN: dir.length,
    dirHit: dir.filter((r) => r.hit).length,
    since: out.length ? out[out.length - 1].day : null,
  };
}
