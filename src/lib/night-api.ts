import {
  DEX,
  EXTRA_COINS,
  MAIN_COINS,
  REF_RULES,
  US_INDEX_COINS,
  WEEKEND_COINS,
  sparkEnd,
  lastRefTime,
  refPrice,
  weekendRef,
  HL_INFO,
  INPUTS,
  KRX_CODES,
  assemble,
  isExpiryDay,
  kstYmd,
  markOf,
  nightWindow,
  stepFor,
  windowSpark,
  priceAt,
  type NightInput,
  type Candle,
  type NightData,
  type NightWindow,
  type Premium,
} from "./night";

/**
 * /api/night 응답. Workers 진입점(worker/index.ts)이 Next.js를 거치지 않고 바로 부른다(Next 라우트는 개발용).
 * 코스피200 야간 추정 자료. 현재가(요청 1개)는 5초, 차트 캔들(종목마다 1개)과 KR200 시간별 프리미엄은 1분,
 * KRX 선물 주간 종가는 몇 시간에 한 번만 원천에서 받도록 Workers 엣지 캐시에 따로 담는다.
 */
const TTL = 5;
const CANDLE_TTL = 60;
const MIN = 60_000;

type Cache = { match(k: Request): Promise<Response | undefined>; put(k: Request, r: Response): Promise<void> };

async function info<T>(body: unknown): Promise<T> {
  const r = await fetch(HL_INFO, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`hyperliquid ${r.status}`);
  return r.json() as Promise<T>;
}

const coins = INPUTS.map((i) => i.coin);

async function loadCandles(now: number, interval: string, from: number, to: number) {
  const [series, funding] = await Promise.all([
    Promise.all(
      coins.map((c) =>
        info<{ t: number; c: string }[]>({ type: "candleSnapshot", req: { coin: `${DEX}:${c}`, interval, startTime: from, endTime: to } }).catch(() => []),
      ),
    ),
    // 시간마다 정산한 KR200 평균 프리미엄: 지난 시각의 기준가를 체결가에서 되짚는 데 쓴다
    info<{ time: number; premium: string }[]>({ type: "fundingHistory", coin: `${DEX}:KR200`, startTime: from }).catch(() => []),
  ]);
  const candles: Record<string, Candle[]> = {};
  coins.forEach((c, i) => (candles[c] = series[i].map((k) => ({ t: k.t, c: Number(k.c) })).sort((a, b) => a.t - b.t)));
  const prem: Premium[] = funding.map((x) => ({ t: x.time, p: Number(x.premium) })).filter((x) => Number.isFinite(x.p));
  return { at: now, candles, prem };
}

async function candlesFor(cache: Cache | undefined, base: string, now: number, interval: string, from: number, to: number) {
  const key = new Request(new URL(`/api/night/candles?${interval}-${from}`, base).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return (await hit.json()) as Awaited<ReturnType<typeof loadCandles>>;
  const got = await loadCandles(now, interval, from, to);
  await cache?.put(key, Response.json(got, { headers: { "Cache-Control": `public, max-age=${CANDLE_TTL}` } })).catch(() => undefined);
  return got;
}

const EXTRA_TTL = 300;
const DAY = 24 * 60 * MIN;

type Close = { t: number; c: number };

/** 대시보드 추가 카드의 15분봉 종가(야간 구간 시작 전부터). 원천 호출을 아끼려고 5분 단위로 묶어 캐시한다 */
async function extraCandlesFor(cache: Cache | undefined, base: string, now: number, win: NightWindow) {
  const slot = Math.floor(now / (EXTRA_TTL * 1000));
  const key = new Request(new URL(`/api/night/extra4?${slot}`, base).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return (await hit.json()) as Record<string, Close[]>;
  // 등락률 기준 시각(전일 미국 마감·정산, 09:00)의 가격도 이 봉에서 찾으므로 가장 이른 기준보다 30분 앞부터
  const earliest = Math.min(...Object.values(REF_RULES).map((r) => lastRefTime(now, r)));
  const from = Math.min(earliest - 30 * MIN, win.start - 60 * MIN);
  const dexCoins = [...EXTRA_COINS, ...US_INDEX_COINS];
  const all = [...dexCoins.map((c) => [c, `${DEX}:${c}`]), ...MAIN_COINS.map((c) => [c, c])];
  const series = await Promise.all(
    all.map(([, coin]) =>
      info<{ t: number; c: string }[]>({ type: "candleSnapshot", req: { coin, interval: "15m", startTime: from, endTime: now } }).catch(() => []),
    ),
  );
  const got: Record<string, Close[]> = {};
  all.forEach(([c], i) => (got[c] = series[i].sort((a, b) => a.t - b.t).map((k) => ({ t: k.t, c: Number(k.c) })).filter((k) => k.c > 0)));
  await cache?.put(key, Response.json(got, { headers: { "Cache-Control": `public, max-age=${EXTRA_TTL}` } })).catch(() => undefined);
  return got;
}

const NAVER = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  referer: "https://finance.naver.com/",
};

/** KRX 코스피200 선물 그날 주간 종가(네이버 증권의 최근월 연결 일봉, 없으면 실시간 시세의 마감 값) */
async function loadClose(win: NightWindow) {
  const ymd = kstYmd(win.start);
  const day = await fetch(`https://fchart.stock.naver.com/siseJson.nhn?symbol=FUT&requestType=1&startTime=${ymd}&endTime=${ymd}&timeframe=day`, {
    headers: NAVER,
  })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  // ["20261022", 시가, 고가, 저가, 종가, 거래량, …]
  const row = new RegExp(`\\[\\s*"${ymd}"\\s*,\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*,\\s*[\\d.]+\\s*,\\s*([\\d.]+)`).exec(day);
  if (row && Number(row[1]) > 0) return Number(row[1]);
  const rt = await fetch("https://polling.finance.naver.com/api/realtime/domestic/index/FUT", { headers: NAVER })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const d = (rt as { datas?: { closePriceRaw?: string; marketStatus?: string; localTradedAt?: string }[] } | null)?.datas?.[0];
  const v = Number(d?.closePriceRaw);
  return d?.marketStatus === "CLOSE" && d.localTradedAt?.slice(0, 10).replace(/-/g, "") === ymd && v > 0 ? v : null;
}

type StockRt = {
  marketStatus?: string;
  localTradedAt?: string;
  closePriceRaw?: string;
  compareToPreviousClosePriceRaw?: string;
  compareToPreviousPrice?: { name?: string };
};

/**
 * 네이버 실시간 시세에서 그날(ymd) KRX 정규장 종가를 읽는다.
 * 일봉(fchart)은 넥스트레이드 애프터마켓(~20:00)까지 합친 통합 종가라 KRX 종가와 다를 수 있어 쓰지 않는다
 * (2026-11-06 삼성전자 일봉 193,500 대 KRX 종가 188,700).
 * 정규장이 열려 있지 않으면 closePrice가 마지막 KRX 종가이고, 다음 날 정규장 중이면 지금가 − 전일 대비로 전일 종가를 되짚는다.
 */
export function stockCloseFromRt(d: StockRt | undefined, ymd: string): number | null {
  const close = Number(d?.closePriceRaw);
  if (!d || !(close > 0)) return null;
  if (d.marketStatus !== "OPEN") return close;
  const day = d.localTradedAt?.slice(0, 10).replace(/-/g, "");
  if (!day || day <= ymd) return null;
  const diff = Math.abs(Number(d.compareToPreviousClosePriceRaw));
  if (!Number.isFinite(diff)) return null;
  const falling = /FALL|LOWER/.test(d.compareToPreviousPrice?.name ?? "");
  const prev = falling ? close + diff : close - diff;
  return prev > 0 ? prev : null;
}

/** KRX 정규장 종가(15:30)는 야간 구간 시작(15:45)보다 15분 앞이다 */
const KRX_CLOSE_LAG = 15 * MIN;

/**
 * 원화 환산 종목을 KRX 종가 기준으로 바꾼다: 원화 가격 = 종가 × (지금 무기한선물 ÷ 종가 시각 무기한선물), 등락률은 그 배율.
 * 무기한선물 × 원/달러를 그대로 쓰면 환율·웃돈 때문에 종가와 수준이 어긋나 등락률이 1% 안팎 틀어진다(2026-11-11 삼성 −0.98%).
 * 종가나 종가 시각 가격이 없으면, 또는 배율이 30% 넘게 벗어나면(자료 오류) 그대로 둔다.
 */
export function toKrxClose(i: NightInput, close: number | null | undefined, ref: number | null | undefined): NightInput {
  if (!close || !ref || !i.krw || !(i.price > 0)) return i;
  const r = i.price / ref;
  if (Math.abs(r - 1) >= 0.3) return i;
  return { ...i, krw: Math.round(close * r), chg: Math.round((r - 1) * 10000) / 100, krxClose: close };
}

async function loadStockClose(code: string, ymd: string) {
  const rt = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${code}`, { headers: NAVER })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return stockCloseFromRt((rt as { datas?: StockRt[] } | null)?.datas?.[0], ymd);
}

/** 삼성전자·SK하이닉스 그날 KRX 종가. 15:45 뒤부터 받고, 받으면 6시간, 못 받으면 5분 둔다 */
async function stockClosesFor(cache: Cache | undefined, base: string, now: number, win: NightWindow) {
  if (now < win.start) return {};
  const ymd = kstYmd(win.start);
  const key = new Request(new URL(`/api/night/stock-close-krx?${ymd}`, base).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return (await hit.json()) as Record<string, number | null>;
  const entries = await Promise.all(Object.entries(KRX_CODES).map(async ([coin, code]) => [coin, await loadStockClose(code, ymd).catch(() => null)] as const));
  const got = Object.fromEntries(entries);
  const age = Object.values(got).every((v) => v != null) ? 6 * 3600 : 300;
  await cache?.put(key, Response.json(got, { headers: { "Cache-Control": `public, max-age=${age}` } })).catch(() => undefined);
  return got;
}

/**
 * 장중(구간이 끝난 뒤) 그날 KRX 코스피200 선물 주간 시가. 네이버 실시간 시세(최근월 연결)에서 그날 체결된 값만 쓴다.
 * 받으면 6시간, 못 받으면 5분 둔다(네이버 선물 시세는 20분 늦게 들어온다)
 */
async function openFor(cache: Cache | undefined, base: string, now: number, win: NightWindow) {
  if (win.live || now < win.end) return null;
  const ymd = kstYmd(win.end);
  const key = new Request(new URL(`/api/night/open?${ymd}`, base).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return ((await hit.json()) as { open: number | null }).open;
  const rt = await fetch("https://polling.finance.naver.com/api/realtime/domestic/index/FUT", { headers: NAVER })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const open = futOpenFromRt((rt as { datas?: FutRt[] } | null)?.datas?.[0], ymd);
  await cache?.put(key, Response.json({ open }, { headers: { "Cache-Control": `public, max-age=${open == null ? 300 : 6 * 3600}` } })).catch(() => undefined);
  return open;
}

type FutRt = { openPriceRaw?: string; localTradedAt?: string };

/** 네이버 선물 실시간 시세에서 그날(ymd) 주간 시가. 다른 날 체결이면 null */
export function futOpenFromRt(d: FutRt | undefined, ymd: string): number | null {
  const v = Number(d?.openPriceRaw);
  if (!d || !(v > 0)) return null;
  return d.localTradedAt?.slice(0, 10).replace(/-/g, "") === ymd ? v : null;
}

/** 주간 종가는 그날 16:10(네이버 20분 지연 뒤)부터 받는다. 만기일은 끝나는 월물의 종가라 쓰지 않는다 */
async function closeFor(cache: Cache | undefined, base: string, now: number, win: NightWindow) {
  if (isExpiryDay(win) || now < win.start + 25 * MIN) return null;
  const key = new Request(new URL(`/api/night/close?${win.start}`, base).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return ((await hit.json()) as { close: number | null }).close;
  const close = await loadClose(win).catch(() => null);
  // 받은 첫 한 시간은 10분마다 다시 확인하고, 그 뒤로는 6시간 둔다. 못 받으면 5분 뒤 다시
  const age = close == null ? 300 : now < win.start + 75 * MIN ? 600 : 6 * 3600;
  await cache?.put(key, Response.json({ close }, { headers: { "Cache-Control": `public, max-age=${age}` } })).catch(() => undefined);
  return close;
}

type HlCtx = { markPx?: string; oraclePx?: string; prevDayPx?: string; premium?: string | null };

async function load(now: number, cache: Cache | undefined, base: string) {
  const win = nightWindow(now);
  const step = stepFor(win, now);
  const interval = step === 60_000 ? "1m" : "5m";
  // 거래가 드문 종목(원/달러 등)도 15:45 직전 체결가를 찾도록 두 시간 앞부터 받는다
  const from = win.start - 120 * MIN;
  const [ctx, { candles, prem }, close, extraCandles, mids, stockClose, open] = await Promise.all([
    info<[{ universe: { name: string }[] }, HlCtx[]]>({ type: "metaAndAssetCtxs", dex: DEX }),
    // 장중에도 작은 카드 선 차트를 지금까지 이으려고 지금까지 받는다(야간 추정선은 구간 끝에서 멈춘다)
    candlesFor(cache, base, now, interval, from, now),
    closeFor(cache, base, now, win),
    extraCandlesFor(cache, base, now, win).catch(() => ({}) as Record<string, Close[]>),
    info<Record<string, string>>({ type: "allMids" }).catch(() => ({}) as Record<string, string>),
    stockClosesFor(cache, base, now, win).catch(() => ({}) as Record<string, number | null>),
    openFor(cache, base, now, win).catch(() => null),
  ]);
  const marks: Record<string, number | null> = {};
  const extra: NonNullable<NightData["extra"]> = {};
  /**
   * 선은 야간 구간(15:45~09:00) 위에 15:45 가격부터 지금까지. 점선은 등락률 기준 가격(화면이 그린다).
   * 기준은 종목마다 국내 앱과 같은 시각(REF_RULES)의 15분봉 종가, 봉이 없으면 원천의 24시간 전 가격(fallback)
   */
  const extraOf = (c: string, price: number, fallback: number, cs: Close[]) => {
    const rule = REF_RULES[c];
    const prevAt = rule ? lastRefTime(now, rule) : undefined;
    const ref = prevAt != null ? refPrice(cs, prevAt) : null;
    const prev = ref ?? fallback;
    const end = (k: Close) => k.t + 15 * MIN;
    const at = [...cs].reverse().find((k) => end(k) <= win.start)?.c ?? cs.find((k) => end(k) > win.start)?.c;
    // 장중(09:00~15:45)에도 카드 가격(지금)과 맞도록 선을 지금 가격까지 잇는다
    const mid = cs.filter((k) => end(k) > win.start && end(k) <= now).map((k) => [end(k), k.c] as const);
    const last = [now, price] as const;
    const s = at ? windowSpark(win, at, mid, last) : undefined;
    const wk = (WEEKEND_COINS as readonly string[]).includes(c)
      ? weekendRef(win, now, cs, sparkEnd(win, last[0]) - win.start)
      : null;
    return { price, prev: prev > 0 ? prev : null, ...(ref && prevAt ? { prevAt } : {}), ...(s ?? {}), ...(wk ? { wk } : {}) };
  };
  let kr200: HlCtx | undefined;
  ctx[0].universe.forEach((u, i) => {
    const c = u.name.replace(`${DEX}:`, "");
    if (c === "KR200") kr200 = ctx[1][i];
    if (coins.includes(c as (typeof coins)[number])) marks[c] = markOf(ctx[1][i]);
    if ((EXTRA_COINS as readonly string[]).includes(c) || (US_INDEX_COINS as readonly string[]).includes(c)) {
      const price = markOf(ctx[1][i]);
      const prev = Number(ctx[1][i]?.prevDayPx);
      if (price) extra[c] = extraOf(c, price, prev, extraCandles[c] ?? []);
    }
  });
  // 기본 거래소 코인(비트코인): 지금 가격은 중간가, 기준은 오늘 09:00에 끝난 15분봉 종가(REF_RULES)
  for (const c of MAIN_COINS) {
    const price = Number(mids[c]);
    const cs = extraCandles[c] ?? [];
    if (price > 0) extra[c] = extraOf(c, price, refPrice(cs, now - DAY) ?? 0, cs);
  }
  const num = (v: string | null | undefined) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  const oracle = num(kr200?.oraclePx);
  const data = assemble(now, win, candles, marks, step, {
    oracle: oracle && oracle > 0 ? oracle : null,
    premium: num(kr200?.premium),
    prem: prem ?? [],
    close,
  });
  if (!data) return data;
  // 원화 환산 종목(삼성전자·SK하이닉스): 등락률을 그날 KRX 종가 대비로(국내 앱의 시간외 시세와 같은 기준).
  // 종가 시각(15:30) 무기한선물 가격 대비 배율을 종가에 곱한다 — 환율·웃돈으로 생기는 수준 차이(11/11 약 1%)를 지운다
  const inputs = data.inputs.map((i) => {
    const ref = priceAt(candles[i.coin] ?? [], win.start - KRX_CLOSE_LAG)?.c;
    return toKrxClose(i, stockClose[i.coin], ref);
  });
  // 장중: 지난밤 추정과 비교할 오늘 주간 시가(추정값과 3% 넘게 다르면 다른 월물로 보고 버린다)
  const ref = data.at0900 ?? data.est;
  const opened = open != null && Math.abs(open / ref - 1) < 0.03 ? open : null;
  return { ...data, inputs, extra, ...(win.live ? {} : { open: opened }) };
}

export async function nightGET(req: Request) {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL("/api/night", req.url).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit;
  try {
    const data = await load(Date.now(), cache, req.url);
    if (!data) return Response.json({ error: "기준 시각 자료가 없습니다" }, { status: 503 });
    const res = Response.json(data, { headers: { "Cache-Control": `public, max-age=${TTL}` } });
    await cache?.put(key, res.clone()).catch(() => undefined);
    return res;
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
