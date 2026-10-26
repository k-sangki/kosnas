import {
  DEX,
  EXTRA_COINS,
  MAIN_COINS,
  WEEKEND_COINS,
  chartEnd,
  weekendRef,
  HL_INFO,
  INPUTS,
  assemble,
  isExpiryDay,
  kstYmd,
  markOf,
  nightWindow,
  stepFor,
  windowSpark,
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
  const key = new Request(new URL(`/api/night/extra3?${slot}`, base).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return (await hit.json()) as Record<string, Close[]>;
  // 기본 거래소 코인은 24시간 전 가격도 이 봉에서 찾으므로 15분 더 앞부터
  const from = Math.min(now - DAY - 15 * MIN, win.start - 60 * MIN);
  const all = [...EXTRA_COINS.map((c) => [c, `${DEX}:${c}`]), ...MAIN_COINS.map((c) => [c, c])];
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
  const [ctx, { candles, prem }, close, extraCandles, mids] = await Promise.all([
    info<[{ universe: { name: string }[] }, HlCtx[]]>({ type: "metaAndAssetCtxs", dex: DEX }),
    candlesFor(cache, base, now, interval, from, Math.min(now, win.end)),
    closeFor(cache, base, now, win),
    extraCandlesFor(cache, base, now, win).catch(() => ({}) as Record<string, Close[]>),
    info<Record<string, string>>({ type: "allMids" }).catch(() => ({}) as Record<string, string>),
  ]);
  const marks: Record<string, number | null> = {};
  const extra: NonNullable<NightData["extra"]> = {};
  /** 선은 야간 구간(15:45~09:00) 위에 15:45 가격부터 지금까지. 점선은 등락률 기준인 24시간 전 가격(화면이 그린다) */
  const extraOf = (c: string, price: number, prev: number, cs: Close[]) => {
    const end = (k: Close) => k.t + 15 * MIN;
    const at = [...cs].reverse().find((k) => end(k) <= win.start)?.c ?? cs.find((k) => end(k) > win.start)?.c;
    const mid = cs.filter((k) => end(k) > win.start && end(k) <= Math.min(now, win.end)).map((k) => [end(k), k.c] as const);
    const last = win.live ? ([now, price] as const) : null;
    const s = at ? windowSpark(win, at, mid, last) : undefined;
    const wk = (WEEKEND_COINS as readonly string[]).includes(c)
      ? weekendRef(win, now, cs, chartEnd(win, last?.[0] ?? mid[mid.length - 1]?.[0] ?? win.start) - win.start)
      : null;
    return { price, prev: prev > 0 ? prev : null, ...(s ?? {}), ...(wk ? { wk } : {}) };
  };
  let kr200: HlCtx | undefined;
  ctx[0].universe.forEach((u, i) => {
    const c = u.name.replace(`${DEX}:`, "");
    if (c === "KR200") kr200 = ctx[1][i];
    if (coins.includes(c as (typeof coins)[number])) marks[c] = markOf(ctx[1][i]);
    if ((EXTRA_COINS as readonly string[]).includes(c)) {
      const price = markOf(ctx[1][i]);
      const prev = Number(ctx[1][i]?.prevDayPx);
      if (price) extra[c] = extraOf(c, price, prev, extraCandles[c] ?? []);
    }
  });
  // 기본 거래소 코인(비트코인): 지금 가격은 중간가, 24시간 전 가격은 그때 끝난 15분봉 종가
  for (const c of MAIN_COINS) {
    const price = Number(mids[c]);
    const cs = extraCandles[c] ?? [];
    let prev = 0;
    for (const k of cs) if (k.t + 15 * MIN <= now - DAY) prev = k.c;
    if (price > 0) extra[c] = extraOf(c, price, prev, cs);
  }
  const num = (v: string | null | undefined) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  const oracle = num(kr200?.oraclePx);
  const data = assemble(now, win, candles, marks, step, {
    oracle: oracle && oracle > 0 ? oracle : null,
    premium: num(kr200?.premium),
    prem: prem ?? [],
    close,
  });
  return data && { ...data, extra };
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
