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
  /** 국내: 기간별 수익률(%) · 50일선 위 · 52주 고가 대비(%) · 산업 이름 */
  r?: Record<string, number | null>;
  above50?: boolean;
  fromHigh?: number | null;
  ind?: string | null;
}

/** 섹터·산업이 같이 쓰는 계산 값 */
export interface Unit {
  id: string;
  name: string;
  count?: number;
  ret: Record<string, number | null>;
  x: Record<string, number | null>;
  y: Record<string, number | null>;
  q: Record<string, Quadrant | null>;
  path?: Record<string, number[][]>;
  /** 전반·후반 강도(%p) — 가속·감속 */
  half?: Record<string, [number, number] | null>;
  /** 지금 시총 비중(%)과 기간 동안의 변화(%p, 주가 변화분만) */
  capShare?: number | null;
  capShareChg?: Record<string, number | null>;
  /** 거래대금 비중 변화(%p): 최근 n일 − 앞 n일 */
  dShare?: Record<string, number | null>;
  /** 하락일 버팀: 묶음 평균이 내린 날들의 (묶음 − 평균) 평균(%p) */
  hold?: Record<string, number | null>;
  above50?: number;
  newHighs?: number;
  /** 시총 1위. shown = 기본 필터 통과(아니면 이름을 보이지 않는다) */
  leader?: {
    code: string;
    name: string;
    fromHigh: number | null;
    shown: boolean;
  };
  /** 기본 필터 통과 종목 중 RS 80 이상 수 */
  rsLeaders?: number;
  rsLeadersAll?: number;
  rsMedian?: number | null;
}

export interface Sector extends Unit {
  /** 섹터 소개 (섹터 페이지 본문) */
  intro?: string;
  /** 이 섹터의 산업 id */
  industries?: string[];
  /** 기본 필터에 걸려 목록에서 뺀 종목 수 */
  hidden?: number;
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
export interface Industry extends Unit {
  sector: string;
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

const DATA: Record<Market, SectorData> = {
  kr: kr as unknown as SectorData,
  us: us as unknown as SectorData,
};

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
export function ready(s: Unit, period: number): boolean {
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
export function moveScores(sectors: Unit[], period: number): Map<string, Move> {
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
      return [
        r.id,
        {
          dir: r.dir,
          straight: r.straight,
          dist,
          score: Math.round((100 * r.straight * Math.min(dist, 2)) / 2),
          line: r.line,
        },
      ];
    }),
  );
}

/** 기본 필터(종목 목록에 보이는 기준) 설명 */
export const BASE_FILTER = "종가 3,000원 이상 · 시가총액 1,500억원 이상 · 최근 20거래일 최소 거래대금 10억원 초과 · 보통주";
export const RS_LEADER = 80;

export type Accel = "speedup" | "rebound" | "slowdown" | "rollover" | "weaker" | "easing";
export const ACCEL: Record<Accel, { name: string; hint: string; up: boolean }> = {
  speedup: { name: "가속", hint: "점점 빨리 강해지는 중", up: true },
  rebound: { name: "반등", hint: "약하다가 강해지는 중", up: true },
  slowdown: { name: "감속", hint: "강해지지만 느려지는 중", up: false },
  rollover: { name: "꺾임", hint: "강해지다가 약해지는 중", up: false },
  weaker: { name: "약세 가속", hint: "점점 빨리 약해지는 중", up: false },
  easing: { name: "약세 둔화", hint: "약해지는 속도가 줄어듦", up: true },
};

/** 전반·후반 일수(기간 p = 전반 p − ⌊p/2⌋ + 후반 ⌊p/2⌋) */
export const halfDays = (p: number): [number, number] => [p - Math.floor(p / 2), Math.floor(p / 2)];

/** neoScreen 가속·감속: 전반·후반 강도를 하루당 속도로 비교 */
export function accelOf(u: Unit, period: number) {
  const h = u.half?.[period];
  if (!h) return null;
  const [d1, d2] = halfDays(period);
  const v1 = h[0] / d1;
  const v2 = h[1] / d2;
  const kind: Accel = v1 > 0 ? (v2 > v1 ? "speedup" : v2 > 0 ? "slowdown" : "rollover") : v2 > 0 ? "rebound" : v2 < v1 ? "weaker" : "easing";
  return { kind, h1: h[0], h2: h[1], v1, v2, change: v2 - v1 };
}
