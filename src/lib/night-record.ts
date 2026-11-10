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

export type RecordSummary = {
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
  if (d.window.live || d.open == null || !(d.base > 0) || !(d.est > 0)) return null;
  const day = new Date(d.window.end + 9 * 3600_000).toISOString().slice(0, 10);
  const weekend = new Date(d.window.start + 9 * 3600_000).getUTCDay() === 5;
  return { day, est: d.est, open: d.open, base: d.base, baseKind: d.baseKind, weekend };
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
