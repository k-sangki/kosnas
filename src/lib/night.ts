/**
 * 코스피200 야간 추정.
 *
 * 국내 장이 닫힌 동안(15:45 ~ 다음 거래일 09:00) 해외에서 24시간 거래되는 한국 관련 무기한선물로
 * 코스피200 선물 수준을 추정한다. KRX 야간선물 시세를 받지 않는다(실시간 재배포는 계약이 필요하다).
 *
 * 기준가 방식(2026-10-22~, method "fair"):
 *  - 야간선물 마감(06:00)까지: KR200 무기한선물의 기준가(오라클) × 베이시스 배율.
 *    trade.xyz는 장이 닫힌 동안 KR200 기준가를 코스피200 선물 가격에서 현물 수준으로 환산해 정하므로
 *    (trade.xyz 문서), 만기까지의 이자 몫(연 CARRY_RATE)을 곱해 선물 수준으로 되돌린다.
 *    지난 시각의 기준가는 원천에 없어 체결가를 그 시간의 평균 프리미엄(fundingHistory)으로 나눠 근사한다.
 *  - 06:00 뒤: 06:00 값 × √(EWY 등락 배율 × KR200 등락 배율)(06:00 대비 체결가).
 *  - 등락률 기준: KRX 주간 선물 종가(받으면), 없으면 15:45 추정값.
 * 2026-10-06 ~ 10-21 밤 11번(주간 종가 기준): 06:00 등락률 평균 오차 0.19%p(이전 방식 0.22%p), 방향 11번 모두,
 *   다음 날 코스피200 시가로는 0.35%p(이전 0.41%p, KRX 야간 종가를 그대로 쓰면 0.94%p).
 *   2026-10-22 밤 esignal 야간 추정가는 KR200 기준가의 1.0022~1.0024배였다(이 배율이 그날 1.0023).
 *
 * 이전 방식(method "blend", 기준가를 못 받을 때): 15:45 KR200 체결가 × √(EWY 배율 × KR200 배율)(15:45 대비).
 *  - EWY: 한국 대형주를 담은 미국 ETF(iShares MSCI South Korea)를 따르는 무기한선물. 거래가 많아 매끄럽다.
 *  - KR200: 코스피200을 따르는 무기한선물. 거래가 적어 계단식이지만 지수 자체를 따른다.
 * 원천은 Hyperliquid의 trade.xyz 시장(공개 API, 키 없음).
 */

export const HL_INFO = "https://api.hyperliquid.xyz/info";
export const DEX = "xyz";

const KST = 9 * 3600_000;
const MIN = 60_000;
const HOUR = 3_600_000;
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

/** 코스피200 선물 만기까지 붙는 이자 몫(연율, 금리 − 배당). 2026-10-22 밤 esignal 추정가 ÷ KR200 기준가(1.0022~1.0024)에 맞춘 값 */
export const CARRY_RATE = 0.0171;

/** 그 시각 뒤 첫 코스피200 선물 만기(3·6·9·12월 둘째 목요일, 15:45 KST로 둔다). 휴장으로 앞당겨지는 해는 보지 않는다 */
export function frontExpiry(at: number) {
  const d = new Date(at + KST);
  let y = d.getUTCFullYear();
  let m = Math.floor(d.getUTCMonth() / 3) * 3 + 2; // 0부터 센 달: 2·5·8·11
  for (;;) {
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay(); // 0 일 … 4 목
    const e = Date.UTC(y, m, 1 + ((4 - first + 7) % 7) + 7, 15, 45) - KST;
    if (e > at) return e;
    m += 3;
    if (m > 11) [m, y] = [m - 12, y + 1];
  }
}

/** 기준가(현물 수준)를 선물 수준으로 바꾸는 배율: 1 + 이자 몫 × 만기까지 남은 날 ÷ 365 */
export function carryFactor(at: number) {
  return 1 + (CARRY_RATE * (frontExpiry(at) - at)) / DAY / 365;
}

/** 그날이 분기 선물 만기일인가(그날 주간 종가는 끝나는 월물이라 기준으로 쓰지 않는다) */
export const isExpiryDay = (win: NightWindow) => frontExpiry(win.start - MIN) === win.start;

/** KST 날짜(YYYYMMDD) */
export const kstYmd = (ms: number) => new Date(ms + KST).toISOString().slice(0, 10).replace(/-/g, "");

/** 한국거래소 야간선물 마감(구간 시작 다음 날 06:00 KST, 금요일 밤은 토요일 06:00) */
export function nightClose(win: NightWindow) {
  return kstMidnight(win.start) + DAY + 6 * HOUR;
}

/** 시간마다 정산하는 KR200 평균 프리미엄(체결 쪽 가격 ÷ 기준가 − 1). t는 그 시간이 끝난 시각 */
export type Premium = { t: number; p: number };

/**
 * 그 시각이 든 시간(정각에 끝나는 한 시간)의 평균 프리미엄을 돌려주는 함수.
 * 아직 끝나지 않은 시간은 지금 프리미엄, 그것도 없으면 가장 가까운 지난 시간 값, 아무것도 없으면 0.
 */
export function premiumAt(prem: Premium[], live: number | null) {
  const hours = [...new Map(prem.map((x) => [Math.round(x.t / HOUR) * HOUR, x.p]))].sort((a, b) => a[0] - b[0]);
  const by = new Map(hours);
  const lastHour = hours.length ? hours[hours.length - 1][0] : -Infinity;
  return (t: number) => {
    const h = Math.ceil(t / HOUR) * HOUR;
    const hit = by.get(h);
    if (hit != null) return hit;
    if (live != null && h > lastHour) return live;
    let v = hours.length ? hours[0][1] : (live ?? 0);
    for (const [k, p] of hours) if (k < h) v = p;
    return v;
  };
}

/**
 * 기준가 방식 추정선. 06:00(야간 마감)까지는 KR200 체결가 ÷ (1 + 그 시간 평균 프리미엄) × 베이시스 배율,
 * 그 뒤는 06:00 값에서 EWY·KR200 체결가 등락(06:00 대비)을 반반 섞어 잇는다. 기준점이 없으면 null.
 */
export function buildFair(ewy: Candle[], kr200: Candle[], win: NightWindow, prem: (t: number) => number, factor: number, step = MIN) {
  const e0 = priceAt(ewy, win.start);
  const k0 = priceAt(kr200, win.start);
  if (!e0 || !k0) return null;
  const close = nightClose(win);
  const fair = (k: number, t: number) => round2((k / (1 + prem(t))) * factor);
  const kr = new Map(kr200.map((k) => [k.t, k.c]));
  const level0 = fair(k0.c, win.start);
  const points: NightPoint[] = [[win.start, level0, k0.c]];
  // 06:00 뒤 등락의 출발점. 06:00 전 마지막 값과 그때까지의 체결가
  const anchor = { v: level0, e: priceAt(ewy, close)?.c ?? e0.c, k: priceAt(kr200, close)?.c ?? k0.c };
  let kLast = k0.c; // KR200은 거래가 없는 분이 있어 직전 체결가를 이어 쓴다
  let j = 0;
  for (const k of ewy) {
    while (j < kr200.length && kr200[j].t <= k.t) kLast = kr200[j++].c;
    const t = k.t + step;
    if (t <= win.start) continue;
    if (t > win.end) break;
    let v: number;
    if (t <= close) v = anchor.v = fair(kLast, t);
    else v = round2(anchor.v * Math.sqrt((k.c / anchor.e) * (kLast / anchor.k)));
    points.push([t, v, kr.has(k.t) ? kr.get(k.t)! : null]);
  }
  return { level0, close, anchor, points };
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

export type NightInput = {
  coin: string;
  label: string;
  price: number;
  chg: number | null;
  krw?: number;
  /** 15:45부터 지금까지의 가격(처음 값이 15:45, 많아야 80개) — 작은 카드의 선 차트 */
  spark?: number[];
};

/** 많아야 n개로 줄인다(처음·끝은 남긴다) */
export function thin(v: number[], n = 80) {
  if (v.length <= n) return v;
  const out: number[] = [];
  for (let k = 0; k < n - 1; k++) out.push(v[Math.floor((k * (v.length - 1)) / (n - 1))]);
  out.push(v[v.length - 1]);
  return out;
}

export type NightData = {
  window: NightWindow;
  /** 계산 방식: fair = 기준가 방식, blend = 15:45 체결가 방식(기준가 자료를 못 받을 때) */
  method: "fair" | "blend";
  /** 등락률 기준값과 그 종류: close = KRX 코스피200 선물 주간 종가, est = 15:45 추정값 */
  base: number;
  baseKind: "close" | "est";
  est: number;
  chg: number;
  chgPct: number;
  high: number;
  low: number;
  kr200: number | null;
  /** KRX 야간선물 마감 시각(06:00)과 그때의 추정값(지났을 때만) */
  nightClose: number;
  at0600: number | null;
  /** 기준가를 선물 수준으로 바꾼 배율(기준가 방식일 때) */
  factor?: number;
  points: NightPoint[];
  inputs: NightInput[];
  /** 차트 없이 지금 가격과 24시간 전 가격만 싣는 무기한선물(대시보드 추가 카드용) */
  extra?: Record<string, { price: number; prev: number | null }>;
  updated: number;
};

/** 대시보드에 넣을 수 있는 그 밖의 trade.xyz 무기한선물. 원천 호출을 늘리지 않으려고 이미 받는 시세 목록에서 가격만 꺼낸다 */
export const EXTRA_COINS = ["CL", "BRENTOIL", "GOLD", "SILVER", "NVDA", "TSLA", "MU", "TSM", "VIX", "DXY"] as const;

type Ctx = { markPx?: string; oraclePx?: string; prevDayPx?: string };

/** 무기한선물 지금 가격(표시 가격 → 오라클 순) */
export function markOf(ctx: Ctx | undefined) {
  const v = Number(ctx?.markPx ?? ctx?.oraclePx);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** 기준가 방식에 쓰는 원천 자료 */
export type FairInput = {
  /** 지금 KR200 기준가 */
  oracle: number | null;
  /** 지금 KR200 프리미엄(아직 정산되지 않은 지금 시간에 쓴다) */
  premium: number | null;
  /** 지난 시간들의 KR200 평균 프리미엄 */
  prem: Premium[];
  /** 그날 KRX 코스피200 선물 주간 종가(받았을 때) */
  close: number | null;
};

/**
 * 원천 응답으로 화면 자료를 만든다. 지금 값을 맨 끝 점으로 붙인다.
 * fair가 있으면 기준가 방식, 없거나 쓸 수 없으면 15:45 체결가 방식.
 */
export function assemble(
  now: number,
  win: NightWindow,
  candles: Record<string, Candle[]>,
  marks: Record<string, number | null>,
  step = MIN,
  fair?: FairInput,
): NightData | null {
  const close = nightClose(win);
  const factor = carryFactor(win.start);
  const f = fair ? buildFair(candles.EWY ?? [], candles.KR200 ?? [], win, premiumAt(fair.prem, fair.premium), factor, step) : null;
  let points: NightPoint[];
  let base: number;
  let baseKind: NightData["baseKind"] = "est";
  let live: number | null = null;
  if (f && fair) {
    points = f.points;
    // 주간 종가는 15:45 추정값과 3% 넘게 다르면(다른 월물·잘못 받은 값) 쓰지 않는다
    const c = fair.close;
    if (c != null && c > 0 && Math.abs(c / f.level0 - 1) < 0.03) [base, baseKind] = [c, "close"];
    else base = f.level0;
    if (win.live && now <= close) live = fair.oracle ? round2(fair.oracle * factor) : null;
    else if (win.live && marks.EWY && marks.KR200) live = round2(f.anchor.v * Math.sqrt((marks.EWY / f.anchor.e) * (marks.KR200 / f.anchor.k)));
  } else {
    const s = buildSeries(candles.EWY ?? [], candles.KR200 ?? [], win, step);
    if (!s) return null;
    points = s.points;
    base = s.base;
    if (win.live && marks.EWY) {
      const kNow = marks.KR200 ?? [...points].reverse().find((p) => p[2] != null)?.[2] ?? s.base;
      live = blend(s.base, s.baseEwy, marks.EWY, kNow);
    }
  }
  if (live != null) {
    const last = points[points.length - 1];
    if (now - last[0] < step) points[points.length - 1] = [last[0], live, marks.KR200 ?? null];
    else points.push([now, live, marks.KR200 ?? null]);
  }
  const ests = points.map((p) => p[1]);
  const est = ests[ests.length - 1];
  const krw = marks.KRW ?? null;
  const inputs: NightInput[] = INPUTS.map((i) => {
    const price = marks[i.coin] ?? null;
    const cs = candles[i.coin] ?? [];
    // 15:45 전 체결이 없으면 그 뒤 첫 체결을 기준으로 삼는다
    const at = priceAt(cs, win.start)?.c ?? cs.find((k) => k.t + step > win.start)?.c;
    const chg = price != null && at ? round2((price / at - 1) * 100) : null;
    const mid = cs.filter((k) => k.t + step > win.start && k.t + step <= win.end).map((k) => k.c);
    const spark = at ? thin([at, ...mid, ...(win.live && price != null ? [price] : [])]) : undefined;
    return {
      coin: i.coin,
      label: i.label,
      price: price ?? NaN,
      chg,
      ...("krw" in i && i.krw && price != null && krw ? { krw: Math.round(price * krw) } : {}),
      ...(spark && spark.length > 1 ? { spark } : {}),
    };
  }).filter((i) => Number.isFinite(i.price));
  return {
    window: win,
    method: f ? "fair" : "blend",
    base,
    baseKind,
    est,
    chg: round2(est - base),
    chgPct: round2((est / base - 1) * 100),
    high: Math.max(...ests),
    low: Math.min(...ests),
    kr200: marks.KR200 ?? null,
    nightClose: close,
    at0600: valueAt(points, close),
    ...(f ? { factor: Math.round(factor * 1e6) / 1e6 } : {}),
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
