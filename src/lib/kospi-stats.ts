import raw from "@/data/kospi-stats.json";

/** collector/kospi_stats.py 가 만드는 코스피200 과거 통계(큰 등락일·갭 출발한 날의 흐름) */
export type GapStat = { k: number; n: number; upFromOpen?: number; ocAvg?: number; chgAvg?: number; closeAbovePrev?: number; last?: string };
export type KospiStats = {
  updated: string;
  index: string;
  since: string | null;
  last: string | null;
  days: number;
  big: number;
  ups: [string, number][];
  downs: [string, number][];
  gaps: GapStat[];
};

export const KOSPI_STATS = raw as unknown as KospiStats;

export type Context = {
  /** 이만큼 이상(하락이면 이하) 움직인 날 수와 그중 올해·가장 최근 날 */
  n: number;
  thisYear: number;
  latest: string | null;
  sinceYear: string;
  gap: GapStat | null;
};

/**
 * 지금 등락률(%)의 과거 맥락. |pct|가 통계 문턱(big)보다 작으면 null.
 * 순위는 일봉 종가 기준 하루 등락과 견준 것이라 야간 추정과 정의가 다르다(화면에 '과거 통계'로만 쓴다).
 */
export function contextFor(pct: number, s: KospiStats = KOSPI_STATS, year = new Date().getFullYear()): Context | null {
  if (!Number.isFinite(pct) || Math.abs(pct) < s.big || !s.since) return null;
  const up = pct > 0;
  const list = up ? s.ups : s.downs;
  const hit = list.filter(([, v]) => (up ? v >= pct : v <= pct));
  const latest = hit.reduce<string | null>((a, [d]) => (a == null || d > a ? d : a), null);
  const thisYear = hit.filter(([d]) => d.startsWith(String(year))).length;
  // 같은 방향 갭 문턱 가운데 지금 등락률 이하에서 가장 큰 것(표본 5일 이상)
  const gap =
    s.gaps
      .filter((g) => (up ? g.k > 0 && g.k <= pct : g.k < 0 && g.k >= pct) && g.n >= 5)
      .sort((a, b) => Math.abs(b.k) - Math.abs(a.k))[0] ?? null;
  return { n: hit.length, thisYear, latest, sinceYear: s.since.slice(0, 4), gap };
}
