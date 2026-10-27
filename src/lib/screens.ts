/**
 * 국장 종목 검색(스크리너)의 거르기·정렬과 고정 조건 페이지.
 * 화면(브라우저)에서도 쓰므로 섹터 자료(json)를 직접 가져오지 않는다 — 타입만 쓴다.
 */
import type { Stock } from "./sectors";

/** 거르기에 필요한 값만. 종목 검색 자료(kr-stocks.json)와 섹터 자료의 종목 줄 모두 이 모양으로 바꿔 쓴다 */
export interface ScreenStock {
  code: string;
  name: string;
  market: string;
  sector: string | null;
  ind: string | null;
  rs: number | null;
  close: number;
  chg: number | null;
  r: Record<string, number | null>;
  fromHigh: number | null;
  above50: boolean;
  capEok: number | null;
  base: boolean;
  spark?: (number | null)[];
  /** 52주 저가 대비(%) · 추세 비트 · 20일 최소 거래대금(억) · 시세가 있는 거래일 수 — 종목 검색 자료에만 있다 */
  fromLow?: number | null;
  trend?: number | null;
  minValEok?: number | null;
  days?: number | null;
  /** 거래량 ÷ 직전 50일 평균 · 20일 거래대금 중앙값(억) */
  volRatio?: number | null;
  medValEok?: number | null;
  /** 가장 최근 분기(예: 2026.2Q)의 영업이익·순이익(억), 매출 전년 같은 분기 대비(%), 전년 같은 분기 영업이익(억) — DART */
  earnP?: string | null;
  opEok?: number | null;
  netEok?: number | null;
  revYoY?: number | null;
  opPrevEok?: number | null;
}

export type SortKey = "rs" | "chg" | "r20" | "cap" | "high";

export const SORTS: { key: SortKey; name: string }[] = [
  { key: "rs", name: "RS" },
  { key: "chg", name: "등락률" },
  { key: "r20", name: "20일" },
  { key: "high", name: "신고가" },
  { key: "cap", name: "시총" },
];

/**
 * 추세 비트(collector/compute.py trend·more_bits): 1 종가>150일선 2 종가>200일선 4 150일선>200일선 8 200일선 한 달 상승
 * 16 50일선>150일선 32 50일선>200일선 64 종가>10일 EMA 128 종가>21일 EMA 256 종가≤10일 EMA×1.10 512 종가≤10주 평균×1.25
 * 1024 첫 52주 신고가(직전 20일에 없음) 2048 양봉 상승 마감
 */
const bit = (s: ScreenStock, b: number) => s.trend != null && (s.trend & b) === b;

export interface Toggle {
  key: string;
  name: string;
  test: (s: ScreenStock) => boolean;
  /** 이 자료가 아직 없으면(수집 전) 고를 수 없게 한다 */
  needs?: "vol" | "earn";
}

export interface FilterGroup {
  key: string;
  name: string;
  hint: string;
  items: Toggle[];
}

/**
 * 켜고 끄는 조건. 금융위 시세(종가·거래대금·시가총액)로 직접 계산한 값만 쓴다.
 * 기본 필터 세 가지는 처음부터 켜져 있다(DEFAULT_ON).
 */
export const GROUPS: FilterGroup[] = [
  {
    key: "base",
    name: "기본 필터",
    hint: "거래가 너무 적거나 작은 종목을 뺍니다",
    items: [
      { key: "price", name: "종가 3,000원 이상", test: (s) => s.close >= 3000 },
      { key: "cap", name: "시가총액 1,500억 이상", test: (s) => (s.capEok ?? 0) >= 1500 },
      { key: "value", name: "20일 최소 거래대금 10억 초과", test: (s) => (s.minValEok ?? (s.base ? 11 : 0)) > 10 },
      { key: "listed", name: "상장 1년 이상", test: (s) => (s.days ?? 0) >= 252 },
      { key: "medval", name: "20일 거래대금 중앙값 20억 이상", test: (s) => (s.medValEok ?? 0) >= 20 },
      { key: "nofin", name: "금융업 제외", test: (s) => s.sector !== "finance" },
    ],
  },
  {
    key: "trend",
    name: "추세 템플릿",
    hint: "미너비니의 상승 추세 조건 — 모두 켜면 2단계(상승) 국면 종목",
    items: [
      { key: "a50", name: "종가 > 50일선", test: (s) => s.above50 },
      { key: "a150", name: "종가 > 150·200일선", test: (s) => bit(s, 1 | 2) },
      { key: "m150", name: "150일선 > 200일선", test: (s) => bit(s, 4) },
      { key: "m200up", name: "200일선 한 달 상승", test: (s) => bit(s, 8) },
      { key: "m50", name: "50일선 > 150·200일선", test: (s) => bit(s, 16 | 32) },
      { key: "low30", name: "52주 저가 대비 +30% 이상", test: (s) => s.fromLow != null && s.fromLow >= 30 },
      { key: "high25", name: "52주 고가 대비 −25% 이내", test: (s) => s.fromHigh != null && s.fromHigh >= -25 },
      { key: "rs70", name: "상대강도 70 이상", test: (s) => (s.rs ?? 0) >= 70 },
    ],
  },
  {
    key: "earn",
    name: "실적",
    hint: "가장 최근 분기 보고서 기준(DART) — 4분기는 연간에서 3분기 누적을 뺀 값",
    items: [
      { key: "op", name: "영업이익 흑자", test: (s) => (s.opEok ?? 0) > 0, needs: "earn" },
      { key: "net", name: "순이익 흑자", test: (s) => (s.netEok ?? 0) > 0, needs: "earn" },
      { key: "turn", name: "영업이익 흑자 전환", test: (s) => (s.opEok ?? 0) > 0 && s.opPrevEok != null && s.opPrevEok <= 0, needs: "earn" },
      { key: "rev20", name: "매출 +20% 이상(전년 같은 분기)", test: (s) => (s.revYoY ?? -Infinity) >= 20, needs: "earn" },
    ],
  },
  {
    key: "price",
    name: "가격·거래량",
    hint: "가장 최근 거래일 종가 기준",
    items: [
      { key: "newhigh", name: "52주 신고가", test: (s) => s.fromHigh === 0 },
      { key: "firsthigh", name: "첫 52주 신고가(20일 만에)", test: (s) => bit(s, 1024) },
      { key: "high10", name: "52주 고가 대비 −10% 이내", test: (s) => s.fromHigh != null && s.fromHigh >= -10 },
      { key: "vol15", name: "거래량 50일 평균 1.5배 이상", test: (s) => (s.volRatio ?? 0) >= 1.5, needs: "vol" },
      { key: "up", name: "상승 마감", test: (s) => (s.chg ?? 0) > 0 },
      { key: "upbar", name: "양봉 상승 마감", test: (s) => bit(s, 2048), needs: "vol" },
      { key: "e10", name: "종가 > 10일 EMA", test: (s) => bit(s, 64) },
      { key: "e21", name: "종가 > 21일 EMA", test: (s) => bit(s, 128) },
      { key: "notext", name: "과열 아님(10일선 +10%·10주선 +25% 이내)", test: (s) => bit(s, 256 | 512) },
      { key: "r20up", name: "20일 수익률 플러스", test: (s) => (s.r["20"] ?? 0) > 0 },
    ],
  },
];

const TOGGLES = new Map(GROUPS.flatMap((g) => g.items.map((t) => [t.key, t] as const)));
export const DEFAULT_ON = ["price", "cap", "value"];

export interface Filters {
  market: "" | "KOSPI" | "KOSDAQ";
  sector: string;
  rsMin: number;
  /** 켠 조건(GROUPS의 key) */
  on: string[];
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = { market: "", sector: "", rsMin: 0, on: DEFAULT_ON, sort: "rs" };

const low = -Infinity;

function sortValue(s: ScreenStock, k: SortKey): number {
  switch (k) {
    case "rs":
      return s.rs ?? low;
    case "chg":
      return s.chg ?? low;
    case "r20":
      return s.r["20"] ?? low;
    case "cap":
      return s.capEok ?? low;
    case "high":
      return s.fromHigh ?? low;
  }
}

/** 큰 값이 먼저. 같으면 RS → 시총 */
export function sortStocks<T extends ScreenStock>(list: T[], k: SortKey): T[] {
  return [...list].sort((a, b) => sortValue(b, k) - sortValue(a, k) || (b.rs ?? 0) - (a.rs ?? 0) || (b.capEok ?? 0) - (a.capEok ?? 0));
}

export function applyFilters<T extends ScreenStock>(list: T[], f: Filters): T[] {
  const tests = f.on.map((k) => TOGGLES.get(k)).filter((t): t is Toggle => !!t);
  return sortStocks(
    list.filter(
      (s) =>
        (!f.market || s.market === f.market) &&
        (!f.sector || s.sector === f.sector) &&
        (!f.rsMin || (s.rs ?? 0) >= f.rsMin) &&
        tests.every((t) => t.test(s)),
    ),
    f.sort,
  );
}

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

/** 한글 이름의 초성(삼성전자 → ㅅㅅㅈㅈ). 한글이 아닌 글자는 그대로 */
export function chosung(s: string): string {
  return Array.from(s, (ch) => {
    const c = ch.charCodeAt(0) - 0xac00;
    return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
  }).join("");
}

const onlyCho = /^[ㄱ-ㅎ]+$/;

/** 이름·종목코드·초성으로 찾기. 이름이 검색어로 시작하는 종목 → 포함하는 종목 순, 그 안에서는 시총 순 */
export function searchStocks<T extends ScreenStock>(list: T[], query: string): T[] {
  const q = query.replace(/\s+/g, "").toLowerCase();
  if (!q) return [];
  const cho = onlyCho.test(q);
  const scored: [T, number][] = [];
  for (const s of list) {
    const name = s.name.replace(/\s+/g, "").toLowerCase();
    const hay = cho ? chosung(name) : name;
    let score = -1;
    if (s.code === q) score = 0;
    else if (hay.startsWith(q)) score = 1;
    else if (hay.includes(q)) score = 2;
    else if (/^\d+$/.test(q) && s.code.startsWith(q)) score = 3;
    if (score >= 0) scored.push([s, score]);
  }
  return scored.sort((a, b) => a[1] - b[1] || (b[0].capEok ?? 0) - (a[0].capEok ?? 0)).map((x) => x[0]);
}

/** StockList(종목 줄·차트)에 넘기는 모양으로 */
export function toListStock(s: ScreenStock): Stock {
  return {
    code: s.code,
    name: s.name,
    tv: `KRX:${s.code}`,
    rs: s.rs ?? 0,
    market: s.market,
    close: s.close,
    chg: s.chg,
    spark: s.spark,
    r: s.r,
    above50: s.above50,
    fromHigh: s.fromHigh,
    ind: s.ind,
  };
}

/** 고정 조건 페이지. 기본 필터를 통과한 종목에서 sort 순으로 위에서 SHOW개 */
export interface Screen {
  slug: string;
  /** 탭·링크에 쓰는 짧은 이름 */
  short: string;
  h1: string;
  title: string;
  description: string;
  keywords: string[];
  sort: SortKey;
  /** 종목 줄 아래에 적을 기간 수익률(일) */
  period: number;
  /** 페이지 첫 문단: 무엇을 어떤 순서로 모았는지 */
  what: string;
  /** 위 몇 종목을 문장으로 적을 때 쓰는 값 */
  value: (s: ScreenStock) => string;
}

export const SHOW = 30;

const pct = (v: number | null | undefined) => (v == null ? "-" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

export const SCREENS: Screen[] = [
  {
    slug: "near-high",
    short: "52주 신고가 근처",
    h1: "52주 신고가 근처 종목",
    title: "52주 신고가 근처 종목 - 코스피·코스닥 신고가 임박 종목 순위",
    description: "코스피·코스닥 보통주 가운데 52주(1년) 최고가에 가장 가까운 종목을 매일 장 마감 자료로 모았습니다. 52주 고점 대비 거리, 상대강도(RS), 기간별 등락률과 차트.",
    keywords: ["52주 신고가", "52주 신고가 종목", "신고가 종목", "신고가 근처 종목", "신고가 임박", "코스피 신고가", "코스닥 신고가", "1년 최고가"],
    sort: "high",
    period: 20,
    what: "52주(최근 252거래일) 최고 종가에 가까운 순서",
    value: (s) => (s.fromHigh === 0 ? "52주 신고가" : `52주 고점 ${pct(s.fromHigh)}`),
  },
  {
    slug: "rs-top",
    short: "상대강도 상위",
    h1: "상대강도(RS) 상위 종목",
    title: "상대강도(RS) 상위 종목 - 코스피·코스닥 강세주 순위",
    description: "최근 12개월 수익률을 최근 3개월에 무게를 두어 전 종목과 비교한 상대강도(RS, 1~99) 순위. 코스피·코스닥에서 시장보다 강하게 움직인 종목을 매일 정리합니다.",
    keywords: ["상대강도", "RS 순위", "RS 상위 종목", "상대강도 순위", "강세주", "주도주", "코스피 강세주", "코스닥 강세주"],
    sort: "rs",
    period: 60,
    what: "상대강도(RS) 점수가 높은 순서",
    value: (s) => `RS ${s.rs ?? "-"}`,
  },
  {
    slug: "gainers-20d",
    short: "20일 상승률 상위",
    h1: "최근 20일 상승률 상위 종목",
    title: "최근 한 달(20거래일) 상승률 상위 종목 - 코스피·코스닥 순위",
    description: "코스피·코스닥 보통주의 최근 20거래일(약 한 달) 등락률 순위. 한 달 동안 많이 오른 종목과 그 섹터·산업, 52주 고점 대비 위치를 매일 장 마감 자료로.",
    keywords: ["한달 상승률", "20일 상승률", "상승률 순위", "많이 오른 종목", "한 달 급등주", "코스피 상승률 순위", "코스닥 상승률 순위"],
    sort: "r20",
    period: 20,
    what: "최근 20거래일 등락률이 높은 순서",
    value: (s) => `20일 ${pct(s.r["20"])}`,
  },
  {
    slug: "gainers",
    short: "하루 상승률 상위",
    h1: "하루 상승률 상위 종목",
    title: "상승률 상위 종목 - 코스피·코스닥 하루 등락률 순위",
    description: "코스피·코스닥 보통주의 하루 등락률 순위. 가장 최근 거래일 장 마감 기준으로 많이 오른 종목과 섹터·산업, 상대강도를 정리합니다.",
    keywords: ["상승률 순위", "급등주", "상승률 상위 종목", "오늘 오른 종목", "등락률 순위", "코스피 급등주", "코스닥 급등주"],
    sort: "chg",
    period: 5,
    what: "가장 최근 거래일 등락률이 높은 순서",
    value: (s) => `하루 ${pct(s.chg)}`,
  },
];

export function findScreen(slug: string): Screen | undefined {
  return SCREENS.find((s) => s.slug === slug);
}

export function runScreen(list: ScreenStock[], screen: Screen): ScreenStock[] {
  return sortStocks(
    list.filter((s) => s.base && sortValue(s, screen.sort) !== low),
    screen.sort,
  ).slice(0, SHOW);
}
