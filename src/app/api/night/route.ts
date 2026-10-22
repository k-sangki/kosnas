import { DEX, EXTRA_COINS, HL_INFO, INPUTS, assemble, markOf, nightWindow, stepFor, type Candle } from "@/lib/night";

/**
 * 코스피200 야간 추정 자료. 현재가(요청 1개)는 5초, 차트 캔들(종목마다 1개)은 1분에 한 번만
 * 원천에서 받도록 Workers 엣지 캐시에 따로 담는다.
 */
export const dynamic = "force-dynamic";

const TTL = 5;
const CANDLE_TTL = 60;

type Cache = { match(k: Request): Promise<Response | undefined>; put(k: Request, r: Response): Promise<void> };

async function info<T>(body: unknown): Promise<T> {
  const r = await fetch(HL_INFO, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`hyperliquid ${r.status}`);
  return r.json() as Promise<T>;
}

const coins = INPUTS.map((i) => i.coin);

async function loadCandles(now: number, interval: string, from: number, to: number) {
  const series = await Promise.all(
    coins.map((c) =>
      info<{ t: number; c: string }[]>({ type: "candleSnapshot", req: { coin: `${DEX}:${c}`, interval, startTime: from, endTime: to } }).catch(() => []),
    ),
  );
  const candles: Record<string, Candle[]> = {};
  coins.forEach((c, i) => (candles[c] = series[i].map((k) => ({ t: k.t, c: Number(k.c) })).sort((a, b) => a.t - b.t)));
  return { at: now, candles };
}

async function candlesFor(cache: Cache | undefined, base: string, now: number, interval: string, from: number, to: number) {
  const key = new Request(new URL(`/api/night/candles?${interval}-${from}`, base).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return (await hit.json()) as Awaited<ReturnType<typeof loadCandles>>;
  const got = await loadCandles(now, interval, from, to);
  await cache?.put(key, Response.json(got, { headers: { "Cache-Control": `public, max-age=${CANDLE_TTL}` } })).catch(() => undefined);
  return got;
}

async function load(now: number, cache: Cache | undefined, base: string) {
  const win = nightWindow(now);
  const step = stepFor(win, now);
  const interval = step === 60_000 ? "1m" : "5m";
  // 거래가 드문 종목(원/달러 등)도 15:45 직전 체결가를 찾도록 두 시간 앞부터 받는다
  const from = win.start - 120 * 60_000;
  const [ctx, { candles }] = await Promise.all([
    info<[{ universe: { name: string }[] }, { markPx?: string; oraclePx?: string; prevDayPx?: string }[]]>({ type: "metaAndAssetCtxs", dex: DEX }),
    candlesFor(cache, base, now, interval, from, Math.min(now, win.end)),
  ]);
  const marks: Record<string, number | null> = {};
  const extra: Record<string, { price: number; prev: number | null }> = {};
  ctx[0].universe.forEach((u, i) => {
    const c = u.name.replace(`${DEX}:`, "");
    if (coins.includes(c as (typeof coins)[number])) marks[c] = markOf(ctx[1][i]);
    if ((EXTRA_COINS as readonly string[]).includes(c)) {
      const price = markOf(ctx[1][i]);
      const prev = Number(ctx[1][i]?.prevDayPx);
      if (price) extra[c] = { price, prev: prev > 0 ? prev : null };
    }
  });
  const data = assemble(now, win, candles, marks, step);
  return data && { ...data, extra };
}

export async function GET(req: Request) {
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
