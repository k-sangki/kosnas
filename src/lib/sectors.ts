import kr from "@/data/kr-sectors.json";
import us from "@/data/us-sectors.json";

export type Market = "kr" | "us";
export type Quadrant = "lead" | "weaken" | "lag" | "watch";

export interface Stock {
  code: string;
  name: string;
  /** 트레이딩뷰 심볼 (KRX:005930, NASDAQ:NVDA) */
  tv: string;
  /** 같은 시장 안 상대강도 순위 점수(1~99) */
  rs: number;
}

export interface Sector {
  id: string;
  name: string;
  /** 기간별 섹터 수익률(%) */
  ret: Record<string, number>;
  /** 강도: 섹터 수익률 − 전체 섹터 평균(%p) */
  x: Record<string, number>;
  /** 변화: 이번 강도 − 앞 기간 강도(%p) */
  y: Record<string, number>;
  q: Record<string, Quadrant>;
  /** 50일선 위 종목 비율(%) */
  above50: number;
  newHighs: number;
  stocks: Stock[];
}

export interface SectorData {
  market: Market;
  /** 화면 확인용 가짜 숫자면 true */
  sample: boolean;
  asof: string;
  periods: number[];
  sectors: Sector[];
}

const DATA: Record<Market, SectorData> = { kr: kr as SectorData, us: us as SectorData };

export function sectorData(market: Market): SectorData {
  return DATA[market];
}

export function findSector(market: Market, id: string): Sector | undefined {
  return DATA[market].sectors.find((s) => s.id === id);
}

export const MARKET_NAME: Record<Market, string> = { kr: "국내", us: "미국" };

/** 네 칸 이름. RRG 순서(주도 → 약화 → 소외 → 관찰) */
export const QUADRANTS: { key: Quadrant; name: string; hint: string }[] = [
  { key: "lead", name: "주도", hint: "평균보다 강하고 더 강해지는 중" },
  { key: "weaken", name: "약화", hint: "평균보다 강하지만 힘이 빠지는 중" },
  { key: "lag", name: "소외", hint: "평균보다 약하고 더 약해지는 중" },
  { key: "watch", name: "관찰", hint: "평균보다 약하지만 나아지는 중" },
];

export function signed(v: number, digits = 1): string {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : s;
}
