/**
 * 코스피200 야간 추정.
 *
 * 국내 장이 닫힌 동안(15:45 ~ 다음 거래일 09:00) 해외에서 24시간 거래되는 한국 관련 무기한선물로
 * 코스피200 수준을 추정한다. KRX 야간선물 시세를 받지 않는다(실시간 재배포는 계약이 필요하다).
 *
 * 추정 = 기준점 × √(EWY 등락 배율 × KR200 등락 배율)  — 15:45 대비 두 무기한선물 등락의 기하평균
 *  - 기준점: 15:45(주간 선물 마감 시각)의 KR200 무기한선물 가격 — 국내 장중에는 코스피200 지수를 따라간다.
 *  - EWY: 한국 대형주를 담은 미국 ETF(iShares MSCI South Korea)를 따르는 무기한선물. 거래가 많아 매끄럽다.
 *  - KR200: 코스피200을 따르는 무기한선물. 거래가 적어 계단식이지만 지수 자체를 따른다.
 * 2026-10-07 ~ 10-21 밤 10번을 KRX 야간선물 종가(06:00)와 비교한 15:45 대비 등락률 평균 오차:
 *   EWY만 0.25%p, KR200만 0.25%p, 반반 0.20%p. 다음 날 09:00 시가로는 0.60·0.62·0.53%p
 *   (KRX 야간 종가를 그대로 시가 예측으로 쓰면 0.98%p).
 * 원천은 Hyperliquid의 trade.xyz 시장(공개 API, 키 없음).
 */

export const HL_INFO = "https://api.hyperliquid.xyz/info";
export const DEX = "xyz";

const KST = 9 * 3600_000;
const MIN = 60_000;
const DAY = 86_400_000;

/** 화면에 같이 보여 줄 해외 무기한선물. 이름은 trade.xyz 종목 이름이다. */
export const INPUTS = [
  { coin: "EWY", label: "EWY(한국 ETF)", unit: "$" },
  { coin: "KR200", label: "KR200 무기한선물", unit: "" },
  { coin: "SP500", label: "S&P 500 무기한선물", unit: "" },
  { coin: "XYZ100", label: "나스닥 100 무기한선물", unit: "" },
  { coin: "KRW", label: "원/달러", unit: "₩" },
  { coin: "SMSN", label: "삼성전자", unit: "$", krw: true },
  { coin: "SKHX", label: "SK하이닉스", unit: "$", krw: true },
] as const;

export type Candle = { t: number; c: number };

/** KST 기준 그 날 00:00 (UTC ms) */
function kstMidnight(ms: number) {
  return Math.floor((ms + KST) / DAY) * DAY - KST;
}
function kstWeekday(ms: number) {
  return new Date(ms + KST).getUTCDay(); // 0 일 … 6 토
}
const isWeekday = (ms: number) => {
  const d = kstWeekday(ms);
  return d >= 1 && d <= 5;
};

export type NightWindow = {
  /** 기준 시각(15:45 KST) */
  start: number;
  /** 다음 거래일 09:00 KST */
  end: number;
  /** 지금이 이 구간 안인가 */
  live: boolean;
};

/**
 * 지금 볼 야간 구간. 평일 15:45부터 다음 평일 09:00까지다. 장중(09:00~15:45)에는 지난밤 구간을 돌려준다.
 * 국내 휴장일은 따로 보지 않는다(그날도 15:45를 기준으로 삼는다).
 */
export function nightWindow(now: number): NightWindow {
  let day = kstMidnight(now);
  for (let i = 0; i < 10; i++, day -= DAY) {
    const start = day + (15 * 60 + 45) * MIN;
    if (!isWeekday(day) || start > now) continue;
    let next = day + DAY;
    while (!isWeekday(next)) next += DAY;
    const end = next + 9 * 60 * MIN;
    return { start, end, live: now < end };
  }
  throw new Error("야간 구간을 찾지 못했다");
}

/** 기준 시각에 끝난 1분봉(시작 시각이 기준 1분 전 이하인 것 중 마지막)의 종가 */
export function priceAt(candles: Candle[], at: number): Candle | undefined {
  let hit: Candle | undefined;
  for (const k of candles) {
    if (k.t <= at - MIN) hit = k;
    else break;
  }
  return hit;
}

export type NightPoint = [t: number, est: number, kr200: number | null];

export type NightSeries = {
  base: number;
  baseEwy: number;
  points: NightPoint[];
};

/**
 * 추정선을 만든다. 점의 시각은 봉이 끝난 시각(시작 + 1분)이다.
 * 기준점이 없으면(자료 부족) null.
 */
export function buildSeries(ewy: Candle[], kr200: Candle[], win: NightWindow, step = MIN): NightSeries | null {
  const e0 = priceAt(ewy, win.start);
  const k0 = priceAt(kr200, win.start);
  if (!e0 || !k0) return null;
  const kr = new Map(kr200.map((k) => [k.t, k.c]));
  const points: NightPoint[] = [];
  let kLast = k0.c; // KR200은 거래가 없는 분이 있어 직전 값을 이어 쓴다
  for (const k of ewy) {
    const t = k.t + step;
    if (kr.has(k.t)) kLast = kr.get(k.t)!;
    if (t <= win.start || t > win.end) continue;
    points.push([t, blend(k0.c, e0.c, k.c, kLast), kr.has(k.t) ? kr.get(k.t)! : null]);
  }
  return { base: k0.c, baseEwy: e0.c, points: [[win.start, k0.c, k0.c], ...points] };
}

/** 그 시각까지 찍힌 마지막 점의 추정값. 그 시각이 아직 안 왔으면 null */
export function valueAt(points: NightPoint[], at: number) {
  if (!points.length || points[points.length - 1][0] < at) return null;
  let v: number | null = null;
  for (const p of points) if (p[0] <= at) v = p[1];
  return v;
}

/** 15:45 대비 EWY·KR200 등락 배율의 기하평균을 기준점에 곱한다 */
export function blend(k0: number, e0: number, eNow: number, kNow: number) {
  return round2(k0 * Math.sqrt((eNow / e0) * (kNow / k0)));
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

export type NightInput = { coin: string; label: string; price: number; chg: number | null; krw?: number };

export type NightData = {
  window: NightWindow;
  base: number;
  est: number;
  chg: number;
  chgPct: number;
  high: number;
  low: number;
  kr200: number | null;
  /** KRX 야간선물이 끝나는 06:00의 추정값(지났을 때만) */
  at0600: number | null;
  points: NightPoint[];
  inputs: NightInput[];
  updated: number;
};

type Ctx = { markPx?: string; oraclePx?: string };

/** 무기한선물 지금 가격(표시 가격 → 오라클 순) */
export function markOf(ctx: Ctx | undefined) {
  const v = Number(ctx?.markPx ?? ctx?.oraclePx);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** 원천 응답으로 화면 자료를 만든다. 지금 표시 가격을 맨 끝 점으로 붙인다. */
export function assemble(
  now: number,
  win: NightWindow,
  candles: Record<string, Candle[]>,
  marks: Record<string, number | null>,
  step = MIN,
): NightData | null {
  const s = buildSeries(candles.EWY ?? [], candles.KR200 ?? [], win, step);
  if (!s) return null;
  const points = s.points;
  const ewyNow = marks.EWY;
  if (win.live && ewyNow) {
    const last = points[points.length - 1];
    const kNow = marks.KR200 ?? [...points].reverse().find((p) => p[2] != null)?.[2] ?? s.base;
    const live: NightPoint = [now, blend(s.base, s.baseEwy, ewyNow, kNow), marks.KR200 ?? null];
    if (now - last[0] < step) points[points.length - 1] = [last[0], live[1], live[2]];
    else points.push(live);
  }
  const ests = points.map((p) => p[1]);
  const est = ests[ests.length - 1];
  const krw = marks.KRW ?? null;
  const inputs: NightInput[] = INPUTS.map((i) => {
    const price = marks[i.coin] ?? null;
    const at = priceAt(candles[i.coin] ?? [], win.start)?.c;
    const chg = price != null && at ? round2((price / at - 1) * 100) : null;
    return {
      coin: i.coin,
      label: i.label,
      price: price ?? NaN,
      chg,
      ...("krw" in i && i.krw && price != null && krw ? { krw: Math.round(price * krw) } : {}),
    };
  }).filter((i) => Number.isFinite(i.price));
  return {
    window: win,
    base: s.base,
    est,
    chg: round2(est - s.base),
    chgPct: round2((est / s.base - 1) * 100),
    high: Math.max(...ests),
    low: Math.min(...ests),
    kr200: marks.KR200 ?? null,
    at0600: valueAt(points, win.end - 3 * 3600_000),
    points,
    inputs,
    updated: now,
  };
}

/** 봉 간격: 1분봉은 한 번에 5,000개까지라 주말을 낀 구간은 5분봉으로 받는다 */
export function stepFor(win: NightWindow, now: number) {
  return (Math.min(now, win.end) - win.start) / MIN > 4800 ? 5 * MIN : MIN;
}

/** 미국 정규장 개장(뉴욕 09:30) 시각. 구간 안에 있으면 돌려준다(서머타임 자동 반영). */
export function usOpenIn(win: NightWindow): number | null {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let day = Math.floor(win.start / DAY) * DAY; day < win.end; day += DAY) {
    // UTC 13:30(서머타임) 또는 14:30(표준시) 중 뉴욕 09:30인 것
    for (const h of [13.5, 14.5]) {
      const t = day + h * 3600_000;
      if (t > win.start && t < win.end && fmt.format(t) === "09:30") return t;
    }
  }
  return null;
}

/** 시각을 KST HH:MM으로 */
export function hhmm(ms: number) {
  const d = new Date(ms + KST);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
