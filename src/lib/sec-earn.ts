/**
 * 회사가 미국 공시(SEC 8-K, 2.02 실적)로 낸 실적 보도자료에서 EPS·매출을 바로 읽는다.
 * 보도자료는 발표 시각에 공시로 올라오므로 나스닥·야후보다 빠르고, 회사 원문이라 가장 믿을 만하다
 * (엔비디아 2026-11-17: 16:20 ET 공시, 야후는 40분 넘게 비어 있었다).
 *
 * 시장 예상(EPS)은 보통 조정(Non-GAAP) 기준이라 보도자료의 Non-GAAP·Adjusted 희석 EPS만 쓴다.
 * 그 값을 못 찾거나 예상치에서 50% 넘게 벗어나면 쓰지 않는다(틀린 숫자보다 빈 칸이 낫다). 매출도 예상의 ±40% 안만.
 */

import names from "../data/econ-names.json";

/** 보도자료 HTML → 한 줄 글 */
export function plainText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8212;|&#8211;|&mdash;|&ndash;/g, "-")
    .replace(/&#36;/g, "$")
    .replace(/&#40;/g, "(")
    .replace(/&#41;/g, ")")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** '$ 2.68' · '$(0.12)' · '(0.12)' · '2.68' → 수(괄호는 음수) */
function num(s: string): number | null {
  const t = s.replace(/[$\s,]/g, "");
  const neg = /^\(.*\)$/.test(t) || t.startsWith("-");
  const v = Number(t.replace(/[()\-]/g, ""));
  return Number.isFinite(v) ? (neg ? -v : v) : null;
}

const EPS_ROW = /(?:diluted\s+(?:earnings|net\s+income|income|EPS)(?:\s*\(loss\))?\s+per\s+(?:common\s+)?share|earnings\s+per\s+diluted\s+share|diluted\s+EPS|EPS\s*[-–]\s*diluted|per\s+diluted\s+share)[^$\d(]{0,40}\$?\s*(\(?-?\d{1,4}\.\d{2,3}\)?)/gi;

/** 조정(Non-GAAP) 희석 EPS. 'Non-GAAP' 표 머리 뒤의 첫 희석 EPS 줄, 또는 'non-GAAP earnings per diluted share were $2.68' 같은 문장 */
export function nonGaapEps(text: string): number | null {
  // 문장: 'GAAP and non-GAAP earnings per diluted share were $2.70 and $2.68'
  const both = text.match(/GAAP\s+and\s+non-GAAP\s+(?:diluted\s+)?(?:earnings|net\s+income)\s+per\s+diluted\s+share\s+(?:was|were)\s+\$?(\(?-?\d+\.\d{2}\)?)\s*(?:,|and)\s*\$?(\(?-?\d+\.\d{2}\)?)/i);
  if (both) return num(both[2]);
  const one = text.match(/(?:non-GAAP|adjusted)\s+(?:diluted\s+)?(?:earnings|EPS|net\s+income)(?:\s+per\s+(?:diluted\s+)?share)?\s+(?:was|were|of)\s+\$(\(?-?\d+\.\d{2}\)?)/i);
  if (one) return num(one[1]);
  // 표: 희석 EPS 줄 가운데, 바로 앞(1,500자 안)의 가장 가까운 머리가 'Non-GAAP'·'Adjusted' 인 첫 줄
  for (const m of text.matchAll(EPS_ROW)) {
    const before = text.slice(Math.max(0, m.index - 1500), m.index);
    const lastNon = Math.max(...[...before.matchAll(/non-GAAP|adjusted/gi)].map((x) => x.index), -1);
    const lastGaap = Math.max(...[...before.matchAll(/(?<!non-)\bGAAP\b/gi)].map((x) => x.index), -1);
    if (lastNon >= 0 && lastNon >= lastGaap) return num(m[1]);
  }
  return null;
}

/**
 * 이번 분기 매출(달러). 'revenue of $115.8 billion' 같은 문장과 표의 첫 Revenue 줄 × 표 단위를 함께 보고,
 * 둘이 다르면 큰 쪽(문장이 사업부 매출 'Data Center revenue was $107.6 billion'일 수 있다 — 전체가 더 크다)
 */
export function revenue(text: string): number | null {
  const s = text.match(/(?:revenue|revenues|net\s+sales)\b[^$]{0,80}?\$\s?([\d,]+(?:\.\d+)?)\s*(billion|million)/i);
  const said = s ? Number(s[1].replace(/,/g, "")) * (s[2].toLowerCase() === "billion" ? 1e9 : 1e6) : null;
  const unit = text.match(/in\s+(millions|billions|thousands)/i)?.[1].toLowerCase();
  const mult = unit === "billions" ? 1e9 : unit === "thousands" ? 1e3 : unit === "millions" ? 1e6 : null;
  const row = mult ? text.match(/\b(?:total\s+)?(?:net\s+)?revenues?\s+\$\s?([\d,]+(?:\.\d+)?)/i) : null;
  const table = row && mult ? Number(row[1].replace(/,/g, "")) * mult : null;
  if (said != null && table != null) return Math.max(said, table);
  return said ?? table;
}

/** 이번 분기 순이익(GAAP, 달러, 적자는 음수). 'GAAP net income was $65.3 billion' 문장 먼저, 없으면 GAAP 표의 첫 Net income 줄 × 표 단위 */
export function netIncome(text: string): number | null {
  const s = text.match(/(?<!non-)\bGAAP\s+net\s+(income|loss)\s+(?:was|of)\s+\$\s?([\d,]+(?:\.\d+)?)\s*(billion|million)/i);
  if (s) return Number(s[2].replace(/,/g, "")) * (s[3].toLowerCase() === "billion" ? 1e9 : 1e6) * (s[1].toLowerCase() === "loss" ? -1 : 1);
  const unit = text.match(/in\s+(millions|billions|thousands)/i)?.[1].toLowerCase();
  const mult = unit === "billions" ? 1e9 : unit === "thousands" ? 1e3 : unit === "millions" ? 1e6 : null;
  if (!mult) return null;
  for (const m of text.matchAll(/\bnet\s+income(?:\s*\(loss\))?\s+\$?\s*(\(?-?[\d,]+(?:\.\d+)?\)?)/gi)) {
    const before = text.slice(Math.max(0, m.index - 1500), m.index);
    const lastNon = Math.max(...[...before.matchAll(/non-GAAP|adjusted/gi)].map((x) => x.index), -1);
    if (lastNon >= 0 && lastNon > Math.max(...[...before.matchAll(/(?<!non-)\bGAAP\b/gi)].map((x) => x.index), -1)) continue;
    const v = num(m[1].replace(/,/g, ""));
    if (v != null) return v * mult;
  }
  return null;
}

/** 예상치와 맞춰 본 값만 돌려준다 */
export function readRelease(html: string, f: number | null, rf: number | null | undefined) {
  const text = plainText(html);
  let a = nonGaapEps(text);
  if (a != null && f != null && Math.abs(a - f) > Math.max(Math.abs(f) * 0.5, 0.1)) a = null;
  let ra = revenue(text);
  if (ra != null && rf && Math.abs(ra - rf) > rf * 0.4) ra = null;
  if (ra != null && !rf) ra = null;
  let na = netIncome(text);
  // 순이익은 공개 예상이 없어 매출보다 클 수 없다는 것만 본다
  if (na != null && (ra == null || Math.abs(na) > ra)) na = null;
  return { a, ra, na };
}

const CIK = (names as { cik?: Record<string, number> }).cik ?? {};
const SEC_UA = { "User-Agent": "KosNas kosnas.com contact@kosnas.com", Accept: "*/*" };

/** 그 종목이 발표일(미국) 이후 낸 2.02 실적 8-K의 보도자료(EX-99.1) 주소. 종목 기호로 바로 찾는다(EDGAR 목록 atom) */
/** 마지막으로 공시 읽기가 멈춘 곳(점검 기록용) */
export const secTrace: string[] = [];

/**
 * 그 종목이 발표일(미국) 이후 이틀 안에 낸 2.02(실적) 8-K의 보도자료(EX-99.1) 주소.
 * 회사 번호(econ-names.json cik)로 공시 목록(data.sec.gov)을 받는다 — 종목 기호로 찾는 옛 EDGAR 화면은 워커에서 400이었다(2026-11-18).
 */
export async function findRelease(sym: string, date: string): Promise<{ url: string; index: string } | null> {
  const cik = CIK[sym];
  if (!cik) return null;
  const sub = await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`, { headers: SEC_UA });
  if (!sub.ok) {
    secTrace.push(`${sym} list ${sub.status}`);
    return null;
  }
  const body = (await sub.json()) as { tickers?: string[]; filings?: { recent?: Record<string, string[]> } };
  // 회사 번호를 잘못 적었으면 쓰지 않는다
  if (!(body.tickers ?? []).includes(sym)) {
    secTrace.push(`${sym} cik mismatch`);
    return null;
  }
  const r = body.filings?.recent ?? {};
  const n = Math.min(r.form?.length ?? 0, 40);
  for (let i = 0; i < n; i++) {
    const filed = r.filingDate[i];
    if (r.form[i] !== "8-K" || filed < date || Date.parse(filed) - Date.parse(date) > 2 * 86_400_000) continue;
    if (!/2\.02/.test(r.items?.[i] ?? "")) continue;
    const acc = r.accessionNumber[i];
    const index = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, "")}/${acc}-index.htm`;
    const idx = await fetch(index, { headers: SEC_UA });
    if (!idx.ok) {
      secTrace.push(`${sym} index ${idx.status}`);
      continue;
    }
    const rows = (await idx.text()).split(/<tr[\s>]/i);
    const pick = rows.find((x) => /EX-99\.?0?1\b/i.test(x)) ?? rows.find((x) => /EX-99/i.test(x));
    const link = pick?.match(/href="([^"]+\.html?)"/i)?.[1];
    if (!link) {
      secTrace.push(`${sym} no ex99`);
      continue;
    }
    return { url: new URL(link.replace(/^\/ix\?doc=/, ""), "https://www.sec.gov").toString(), index };
  }
  secTrace.push(`${sym} no 8-K yet`);
  return null;
}

/** 공시 보도자료에서 EPS·매출·순이익. 공시가 아직이면 null, 공시는 있는데 숫자를 못 읽으면 주소만 */
export async function secEarning(sym: string, date: string, f: number | null, rf: number | null | undefined) {
  const rel = await findRelease(sym, date);
  if (!rel) return null;
  const r = await fetch(rel.url, { headers: SEC_UA });
  if (!r.ok) {
    secTrace.push(`${sym} doc ${r.status}`);
    return { url: rel.url, a: null, ra: null, na: null };
  }
  const got = readRelease(await r.text(), f, rf);
  secTrace.push(`${sym} read a=${got.a} ra=${got.ra} na=${got.na}`);
  return { url: rel.url, ...got };
}
