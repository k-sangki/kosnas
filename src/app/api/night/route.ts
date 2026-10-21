import { DEX, HL_INFO, INPUTS, assemble, markOf, nightWindow, stepFor, type Candle } from "@/lib/night";

/** 코스피200 야간 추정 자료. 원천을 15초에 한 번만 부르도록 Workers 엣지 캐시에 담는다. */
export const dynamic = "force-dynamic";

const TTL = 15;

async function info<T>(body: unknown): Promise<T> {
  const r = await fetch(HL_INFO, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`hyperliquid ${r.status}`);
  return r.json() as Promise<T>;
}

async function load(now: number) {
  const win = nightWindow(now);
  const step = stepFor(win, now);
  const interval = step === 60_000 ? "1m" : "5m";
  // 거래가 드문 종목(원/달러 등)도 15:45 직전 체결가를 찾도록 두 시간 앞부터 받는다
  const from = win.start - 120 * 60_000;
  const coins = INPUTS.map((i) => i.coin);
  const [ctx, ...series] = await Promise.all([
    info<[{ universe: { name: string }[] }, { markPx?: string; oraclePx?: string }[]]>({ type: "metaAndAssetCtxs", dex: DEX }),
    ...coins.map((c) =>
      info<{ t: number; c: string }[]>({
        type: "candleSnapshot",
        req: { coin: `${DEX}:${c}`, interval, startTime: from, endTime: Math.min(now, win.end) },
      }).catch(() => []),
    ),
  ]);
  const marks: Record<string, number | null> = {};
  ctx[0].universe.forEach((u, i) => {
    const c = u.name.replace(`${DEX}:`, "");
    if (coins.includes(c as (typeof coins)[number])) marks[c] = markOf(ctx[1][i]);
  });
  const candles: Record<string, Candle[]> = {};
  coins.forEach((c, i) => (candles[c] = series[i].map((k) => ({ t: k.t, c: Number(k.c) })).sort((a, b) => a.t - b.t)));
  return assemble(now, win, candles, marks, step);
}

export async function GET(req: Request) {
  const cache = (globalThis as { caches?: CacheStorage & { default?: Cache } }).caches?.default;
  const key = new Request(new URL("/api/night", req.url).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit;
  try {
    const data = await load(Date.now());
    if (!data) return Response.json({ error: "기준 시각 자료가 없습니다" }, { status: 503 });
    const res = Response.json(data, { headers: { "Cache-Control": `public, max-age=${TTL}` } });
    await cache?.put(key, res.clone()).catch(() => undefined);
    return res;
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
