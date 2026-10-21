"use client";

/** 종목 검색 자료(public/data/kr-stocks.json). 처음 쓸 때 한 번만 받는다 */
export interface KrStock {
  code: string;
  name: string;
  market: string;
  sector: string | null;
  industry: string | null;
  rs: number | null;
  close: number;
  chg: number | null;
  r: Record<string, number | null>;
  fromHigh: number | null;
  above50: boolean;
  capEok: number;
  base: boolean;
  spark: (number | null)[];
}

export interface KrStocks {
  asof: string;
  sparkFrom: string;
  list: KrStock[];
  byCode: Map<string, KrStock>;
}

let cache: Promise<KrStocks> | null = null;

export function loadKrStocks(): Promise<KrStocks> {
  cache ??= fetch("/data/kr-stocks.json")
    .then((r) => {
      if (!r.ok) throw new Error(`종목 자료 ${r.status}`);
      return r.json();
    })
    .then((d: { asof: string; sparkFrom: string; cols: string[]; rows: unknown[][] }) => {
      const i = Object.fromEntries(d.cols.map((c, k) => [c, k]));
      const periods = d.cols.filter((c) => /^r\d+$/.test(c));
      const list = d.rows.map(
        (x) =>
          ({
            code: x[i.code],
            name: x[i.name],
            market: x[i.market],
            sector: x[i.sector],
            industry: x[i.industry],
            rs: x[i.rs],
            close: x[i.close],
            chg: x[i.chg],
            r: Object.fromEntries(periods.map((p) => [p.slice(1), x[i[p]]])),
            fromHigh: x[i.fromHigh],
            above50: x[i.above50],
            capEok: x[i.capEok],
            base: x[i.base],
            spark: x[i.spark],
          }) as KrStock,
      );
      return {
        asof: d.asof,
        sparkFrom: d.sparkFrom,
        list,
        byCode: new Map(list.map((s) => [s.code, s])),
      };
    })
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

/** 한글 초성만 뽑는다(삼성전자 → ㅅㅅㅈㅈ) */
export function initials(s: string): string {
  return [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0) - 0xac00;
      return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
    })
    .join("");
}

export function searchStocks(list: KrStock[], q: string, limit = 12): KrStock[] {
  const t = q.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return [];
  const onlyCho = /^[ㄱ-ㅎ]+$/.test(t);
  const hits = list.filter((s) => {
    const n = s.name.toLowerCase().replace(/\s+/g, "");
    return s.code.startsWith(t) || n.includes(t) || (onlyCho && initials(n).includes(t));
  });
  // 이름이 검색어로 시작하는 종목 → 시가총액 큰 순
  return hits.sort((a, b) => Number(b.name.toLowerCase().startsWith(t)) - Number(a.name.toLowerCase().startsWith(t)) || b.capEok - a.capEok).slice(0, limit);
}
