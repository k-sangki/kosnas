import { DEX, HL_INFO, markOf, type Candle } from "./night";
import { usSession } from "./session";
import { US_INPUTS, assembleUs } from "./us";

/** /api/us 응답. Workers 진입점(worker/index.ts)이 Next.js를 거치지 않고 바로 부른다(Next 라우트는 개발용).
 * 미국 정규장 흐름 자료. 원천을 15초에 한 번만 부르도록 Workers 엣지 캐시에 담는다. */
const TTL = 15;

async function info<T>(body: unknown): Promise<T> {
  const r = await fetch(HL_INFO, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`hyperliquid ${r.status}`);
  return r.json() as Promise<T>;
}

async function load(now: number) {
  const s = usSession(now);
  const coins = US_INPUTS.map((i) => i.coin as string);
  const [ctx, ...series] = await Promise.all([
    info<[{ universe: { name: string }[] }, { markPx?: string; oraclePx?: string }[]]>({ type: "metaAndAssetCtxs", dex: DEX }),
    ...coins.map((c) =>
      info<{ t: number; c: string }[]>({
        type: "candleSnapshot",
        req: { coin: `${DEX}:${c}`, interval: "5m", startTime: s.prevClose - 30 * 60_000, endTime: Math.min(now, s.close) },
      }).catch(() => []),
    ),
  ]);
  const marks: Record<string, number | null> = {};
  ctx[0].universe.forEach((u, i) => {
    const c = u.name.replace(`${DEX}:`, "");
    if (coins.includes(c)) marks[c] = markOf(ctx[1][i]);
  });
  const candles: Record<string, Candle[]> = {};
  coins.forEach((c, i) => (candles[c] = series[i].map((k) => ({ t: k.t, c: Number(k.c) })).sort((a, b) => a.t - b.t)));
  return assembleUs(now, s, candles, marks);
}

export async function usGET(req: Request) {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL("/api/us", req.url).toString());
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
