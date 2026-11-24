/** 공포·탐욕 지수 추정(collector/fear_greed.py) 한 줄 요약 */
export type FgSummary = {
  date: string;
  score: number;
  prev: number;
  week: number;
  month: number;
  parts: Record<string, number | null>;
  hist: number[];
};

export type FgBand = { name: string; from: number; to: number; tone: "xf" | "f" | "n" | "g" | "xg" };

/** 구간은 CNN과 같다: 0~24 극단적 공포, 25~44 공포, 45~55 중립, 56~75 탐욕, 76~100 극단적 탐욕 */
export const BANDS: FgBand[] = [
  { name: "극단적 공포", from: 0, to: 25, tone: "xf" },
  { name: "공포", from: 25, to: 45, tone: "f" },
  { name: "중립", from: 45, to: 55, tone: "n" },
  { name: "탐욕", from: 55, to: 75, tone: "g" },
  { name: "극단적 탐욕", from: 75, to: 100, tone: "xg" },
];

export function bandOf(v: number): FgBand {
  if (v < 25) return BANDS[0];
  if (v < 45) return BANDS[1];
  if (v <= 55) return BANDS[2];
  if (v <= 75) return BANDS[3];
  return BANDS[4];
}
