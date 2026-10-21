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
  /** 국내: 마지막 종가(원)·전일 대비(%)·최근 수정 종가 열(차트용) */
  close?: number;
  chg?: number | null;
  spark?: (number | null)[];
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
  /** 기간마다 그 기간 동안 매일의 [강도, 변화] — 마지막이 오늘 */
  path?: Record<string, number[][]>;
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

/** 섹터 아래 산업(DART 업종 코드로 나눔). 강도는 산업끼리의 평균 대비 %p */
export interface Industry {
  id: string;
  sector: string;
  name: string;
  count: number;
  ret: Record<string, number | null>;
  x: Record<string, number | null>;
  /** 최근 20거래일 매일의 20일 강도 */
  path20: (number | null)[];
  /** RS 상위 종목 이름 */
  top: string[];
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
  /** spark 열의 첫 날짜 */
  sparkFrom?: string;
  periods: number[];
  sectors: Sector[];
  industries?: Industry[];
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

export type Dir = "up" | "down";

export interface Move {
  /** 주도(오른쪽 위) 쪽으로 가는 중이면 up, 소외(왼쪽 아래) 쪽이면 down */
  dir: Dir;
  /** 이동 강도 0~100: 곧게(직진도) 멀리(거리) 갈수록 크다 */
  score: number;
  /** 시작→끝 직선거리 ÷ 지나온 길이 (1이면 일직선) */
  straight: number;
  /** 시작→끝 거리 ÷ 그 기간 섹터들의 중간값 */
  dist: number;
  /** 그래프에 그리는 매끄럽게 한 경로(끝점은 오늘 실제 위치) */
  line: [number, number][];
}

/** 경로를 짧은 이동평균으로 다듬는다(5·10일은 3일, 그보다 길면 5일). 끝점은 오늘 실제 위치로 둔다 */
function smooth(pts: number[][], period: number): [number, number][] {
  const k = period <= 10 ? 3 : 5;
  const out = pts.map((_, i) => {
    const w = pts.slice(Math.max(0, i - k + 1), i + 1);
    return [w.reduce((a, p) => a + p[0], 0) / w.length, w.reduce((a, p) => a + p[1], 0) / w.length] as [number, number];
  });
  if (pts.length) out[out.length - 1] = [pts[pts.length - 1][0], pts[pts.length - 1][1]];
  return out;
}

/** neoScreen 이동 강도와 같은 방식: 점수 = 100 × 직진도 × min(거리, 2) ÷ 2 */
export function moveScores(sectors: Sector[], period: number): Map<string, Move> {
  const raw = sectors.flatMap((s) => {
    const pts = s.path?.[period];
    if (!pts || pts.length < 2) return [];
    const line = smooth(pts, period);
    const [x0, y0] = line[0];
    const [x1, y1] = line[line.length - 1];
    const span = Math.hypot(x1 - x0, y1 - y0);
    let len = 0;
    for (let i = 1; i < line.length; i++) len += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    // 주도 방향(오른쪽 위 대각선)으로 얼마나 갔는지로 방향을 정한다
    const dir: Dir = x1 - x0 + (y1 - y0) >= 0 ? "up" : "down";
    return [{ id: s.id, span, straight: len ? span / len : 0, dir, line }];
  });
  const spans = raw.map((r) => r.span).sort((a, b) => a - b);
  const med = spans.length ? spans[Math.floor(spans.length / 2)] || 1 : 1;
  return new Map(
    raw.map((r) => {
      const dist = r.span / med;
      return [r.id, { dir: r.dir, straight: r.straight, dist, score: Math.round((100 * r.straight * Math.min(dist, 2)) / 2), line: r.line }];
    }),
  );
}
