/**
 * /api/econ: 발표 직후 실제 값을 화면에 바로 채우려고 나스닥 경제지표 달력의 오늘·어제 발표만 받아 준다.
 * 바탕 자료(src/data/econ.json)는 하루 몇 번만 새로 쓰므로 그 사이를 메운다. 엣지에 2분 담는다.
 * 나스닥이 막으면 빈 줄을 돌려주고 화면은 바탕 자료만 쓴다.
 */
import { EARN_FOCUS, wanted, type Earning, type Row } from "./econ";

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

const money = (v: unknown) => {
  let s = clean(v).replace(/[$,]/g, "");
  if (/^\(.*\)$/.test(s)) s = `-${s.slice(1, -1)}`;
  const n = s === "" ? NaN : Number(s);
  return Number.isFinite(n) ? n : null;
};

/** 주목 기업의 그날(미국 날짜 그대로) 실적. 이름은 화면이 바탕 자료의 한글 이름으로 바꾼다 */
async function earnDay(d: string): Promise<Earning[]> {
  const r = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${d}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`nasdaq ${r.status}`);
  const body = (await r.json()) as { data?: { rows?: Record<string, unknown>[] } };
  const out: Earning[] = [];
  for (const x of body.data?.rows ?? []) {
    const symbol = clean(x.symbol);
    if (!EARN_FOCUS.has(symbol)) continue;
    const t = clean(x.time);
    out.push({
      symbol,
      name: symbol,
      date: d,
      when: t.includes("pre-market") ? "pre" : t.includes("after-hours") ? "after" : "",
      capB: null,
      quarter: clean(x.fiscalQuarterEnding),
      f: money(x.epsForecast),
      n: null,
      a: money(x.eps),
      s: money(x.surprise),
      ly: money(x.lastYearEPS),
    });
  }
  return out;
}

/**
 * 나스닥 실적 달력은 실제 EPS를 반나절쯤 늦게 올린다(코어위브 2026-11-10 장 뒤 발표가 다음 날 오전에도 비어 있었다).
 * 야후 파이낸스는 발표 몇 분 뒤 실제 EPS·예상(같은 회사 기준)을 준다 → 발표일이 지났는데 비어 있는 주목 기업만 야후로 채운다.
 * 야후는 쿠키(A3)와 crumb을 먼저 받아야 한다. 막히면 조용히 넘어간다(나스닥 값이 늦게라도 채운다).
 */
async function yahooFill(list: Earning[]): Promise<Earning[]> {
  const want = list.filter((e) => e.a == null);
  if (!want.length) return list;
  const ua = { "User-Agent": HEADERS["User-Agent"] };
  const fc = await fetch("https://fc.yahoo.com/", { headers: ua, redirect: "manual" });
  const cookie = (fc.headers.get("set-cookie") ?? "").match(/A3=[^;]+/)?.[0];
  if (!cookie) return list;
  const crumb = await (await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { ...ua, Cookie: cookie } })).text();
  if (!crumb || crumb.length > 40) return list;
  const got = new Map<string, Partial<Earning>>();
  await Promise.all(
    want.map(async (e) => {
      const r = await fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${e.symbol}?modules=earnings&crumb=${encodeURIComponent(crumb)}`, {
        headers: { ...ua, Cookie: cookie },
      });
      if (!r.ok) return;
      type Q = { actual?: { raw?: number }; estimate?: { raw?: number }; surprisePct?: string; reportedDate?: { fmt?: string } };
      const b = (await r.json()) as { quoteSummary?: { result?: { earnings?: { earningsChart?: { quarterly?: Q[] } } }[] } };
      const q = b.quoteSummary?.result?.[0]?.earnings?.earningsChart?.quarterly ?? [];
      // 발표일(미국)이 같거나 하루 뒤로 적힌 분기
      const hit = q.find((x) => {
        const d = x.reportedDate?.fmt;
        return d && Math.abs(Date.parse(d) - Date.parse(e.date)) <= 86_400_000 && x.actual?.raw != null;
      });
      if (!hit) return;
      const a = Math.round(hit.actual!.raw! * 100) / 100;
      const f = hit.estimate?.raw != null ? Math.round(hit.estimate.raw * 100) / 100 : e.f;
      const s = Number(hit.surprisePct);
      got.set(`${e.symbol}-${e.date}`, { a, f, s: Number.isFinite(s) ? s : null, src: "yahoo" });
    }),
  );
  return list.map((e) => ({ ...e, ...got.get(`${e.symbol}-${e.date}`) }));
}

export async function econGET(req: Request) {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL("/api/econ", req.url).toString());
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit;
  // 달력은 물은 날짜의 하루 전(미국 동부) 발표를 준다: 미국 동부 오늘+1 = 오늘 발표, 오늘 = 어제 발표
  const et = Date.now() - 5 * 3600_000;
  const ds = [0, 1].map((k) => new Date(et + k * 86_400_000).toISOString().slice(0, 10));
  // 실적 달력은 날짜가 발표일 그대로: 미국 동부 어제(장 뒤 발표 = 한국 오늘 아침)와 오늘
  const es = [-1, 0].map((k) => new Date(et + k * 86_400_000).toISOString().slice(0, 10));
  let body: { rows: Row[]; earnings: Earning[]; live: boolean; at: number };
  try {
    const [rows, earnings] = await Promise.all([
      Promise.all(ds.map(day)).then((x) => x.flat()),
      Promise.all(es.map(earnDay))
        .then((x) => x.flat())
        .then((x) => yahooFill(x).catch(() => x))
        .catch(() => []),
    ]);
    body = { rows, earnings, live: true, at: Date.now() };
  } catch {
    body = { rows: [], earnings: [], live: false, at: Date.now() };
  }
  const res = Response.json(body, { headers: { "Cache-Control": `public, max-age=${TTL}` } });
  await cache?.put(key, res.clone()).catch(() => undefined);
  return res;
}
