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
  market?: string;
}

export interface Sector {
  id: string;
  name: string;
  /** 섹터 소개 (섹터 페이지 본문) */
  intro?: string;
  /** 섹터에 든 보통주 수 */
  count?: number;
  /** 기간별 섹터 수익률(%, 시가총액 가중). 자료가 모자라면 null */
  ret: Record<string, number | null>;
  /** 강도: 섹터 수익률 − 섹터 평균(%p) */
  x: Record<string, number | null>;
  /** 변화: 이번 강도 − 바로 앞 같은 길이 기간의 강도(%p) */
  y: Record<string, number | null>;
  q: Record<string, Quadrant | null>;
  /** 50일선 위 종목 비율(%) */
  above50: number;
  newHighs: number;
  stocks: Stock[];
}

export interface Breadth {
  count: number;
  up: number;
  down: number;
  above50: number;
  newHighs: number;
}

export interface SectorData {
  market: Market;
  /** 원천 자료 표시 */
  source?: string;
  /** 시장별 폭 (KOSPI, KOSDAQ) */
  breadth?: Record<string, Breadth>;
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

/** 미국은 시세 원천(상업 이용 가능한 API)을 정할 때까지 메뉴·사이트맵에서 뺀다 */
export const US_ENABLED = false;

export const MARKETS: Market[] = US_ENABLED ? ["kr", "us"] : ["kr"];

/** 그 기간 값이 모두 있는 섹터만 */
export function ready(s: Sector, period: number): boolean {
  return s.x[period] != null && s.y[period] != null && s.q[period] != null;
}

export const MARKET_NAME: Record<Market, string> = { kr: "국내", us: "미국" };

/** 네 칸 이름. RRG 순서(주도 → 약화 → 소외 → 관찰) */
export const QUADRANTS: { key: Quadrant; name: string; hint: string }[] = [
  { key: "lead", name: "주도", hint: "평균보다 강하고 더 강해지는 중" },
  { key: "weaken", name: "약화", hint: "평균보다 강하지만 힘이 빠지는 중" },
  { key: "lag", name: "소외", hint: "평균보다 약하고 더 약해지는 중" },
  { key: "watch", name: "관찰", hint: "평균보다 약하지만 나아지는 중" },
];

export function signed(v: number | null | undefined, digits = 1): string {
  if (v == null) return "-";
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : s;
}
