/**
 * /api/econ: 발표 직후 실제 값을 화면에 바로 채우려고 나스닥 경제지표 달력의 오늘·어제 발표만 받아 준다.
 * 바탕 자료(src/data/econ.json)는 하루 몇 번만 새로 쓰므로 그 사이를 메운다. 엣지에 2분 담는다.
 * 나스닥이 막으면 빈 줄을 돌려주고 화면은 바탕 자료만 쓴다.
 */
import { wanted, type Row } from "./econ";

const TTL = 120;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
};

const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\u00a0/g, " ")
    .trim();

async function day(d: string): Promise<Row[]> {
  const r = await fetch(`https://api.nasdaq.com/api/calendar/economicevents?date=${d}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`nasdaq ${r.status}`);
  const body = (await r.json()) as { data?: { rows?: Record<string, unknown>[] } };
  const out: Row[] = [];
  for (const x of body.data?.rows ?? []) {
    const row = { d, t: clean(x.gmt), c: clean(x.country), n: clean(x.eventName), a: clean(x.actual), f: clean(x.consensus), p: clean(x.previous) };
    if (/^\d\d:\d\d$/.test(row.t) && wanted(row)) out.push(row);
  }
  return out;
}

export async function econGET(req: Request) {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL("/api/econ", req.url).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit;
  // 달력은 물은 날짜의 하루 전(미국 동부) 발표를 준다: 미국 동부 오늘+1 = 오늘 발표, 오늘 = 어제 발표
  const et = Date.now() - 5 * 3600_000;
  const ds = [0, 1].map((k) => new Date(et + k * 86_400_000).toISOString().slice(0, 10));
  let body: { rows: Row[]; live: boolean; at: number };
  try {
    const rows = (await Promise.all(ds.map(day))).flat();
    body = { rows, live: true, at: Date.now() };
  } catch {
    body = { rows: [], live: false, at: Date.now() };
  }
  const res = Response.json(body, { headers: { "Cache-Control": `public, max-age=${TTL}` } });
  await cache?.put(key, res.clone()).catch(() => undefined);
  return res;
}
