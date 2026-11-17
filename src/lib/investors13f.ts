import raw from "@/data/investors-13f.json";
import { koName } from "./ko-names";

/** 유명 투자자 13F 보유 자료(collector/investors_13f.py가 만든다) */
export type Holding = {
  name: string;
  ticker: string | null;
  cls: string;
  cusip: string;
  /** 평가액(달러, 분기 말 기준) */
  value: number;
  shares: number;
  put_call?: "Put" | "Call";
  /** 주식이 아니라 원금 단위(전환사채 등) */
  prn?: boolean;
  weight?: number;
  change?: "new" | "add" | "reduce" | "same" | null;
  prev_shares?: number | null;
  /** 전 분기 말 비중(%) */
  prev_weight?: number;
  /** 이번 분기 사고판 금액(달러, 늘린·줄인 주식 수 × 분기 말 주가, 신규는 평가액, 판 것은 -) */
  amount?: number;
};

export type Investor = {
  id: string;
  cik: number;
  person: string;
  firm: string;
  sec_name: string;
  period: string;
  filed: string;
  prev_period: string | null;
  total: number;
  /** 전 분기 신고 총액(달러) */
  prev_total?: number | null;
  count: number;
  new_count: number;
  add_count: number;
  reduce_count: number;
  sold_count: number;
  holdings: Holding[];
  sold: Holding[];
  /** 지난 분기 대비 주요 변화(신규·확대·축소, 금액 큰 순, 상위 100개 밖 종목 포함) */
  moves?: Holding[];
};

export type SectorFlow = {
  sector: string;
  /** 이번 분기 산 금액(달러, +) */
  buy: number;
  /** 판 금액(달러, -) */
  sell: number;
  net: number;
  buyers: string[];
  sellers: string[];
  top_buy: string[];
  top_sell: string[];
};

type Data = {
  updated: string | null;
  failed?: string[];
  sectors?: { period: string; investors: number; sectors: SectorFlow[] } | null;
  investors: Investor[];
};

const DATA = raw as unknown as Data;

export const INVESTORS: Investor[] = DATA.investors;
export const SECTOR_FLOWS = DATA.sectors ?? null;
export const findInvestor = (id: string) => INVESTORS.find((i) => i.id === id);

/** 2026-06-30 → 2026년 2분기 */
export function quarter(period: string | null) {
  if (!period) return "";
  const [y, m] = period.split("-").map(Number);
  return `${y}년 ${Math.ceil(m / 3)}분기`;
}

/** 달러 금액을 억·만 단위로 */
export function usd(v: number): string {
  if (v < 0) return `-${usd(-v)}`;
  if (v >= 1e8) {
    const e = v / 1e8;
    return `${e >= 100 ? Math.round(e).toLocaleString() : e.toFixed(1)}억 달러`;
  }
  return `${Math.round(v / 1e4).toLocaleString()}만 달러`;
}

/** 이름 대신 쓸 기호(못 찾았으면 회사 이름) */
export const label = (h: Holding) => h.ticker ?? h.name;

export const optionTag = (h: Holding) =>
  h.put_call === "Put"
    ? "풋옵션"
    : h.put_call === "Call"
      ? "콜옵션"
      : h.prn
        ? "채권"
        : "";

/** 전 분기 대비 주식 수 변화(%) */
export function sharePct(h: Holding) {
  if (!h.prev_shares || h.change === "new") return null;
  return (h.shares / h.prev_shares - 1) * 100;
}

/** 이번 분기 여러 투자자가 함께 사거나 판 종목 */
export function crowd(kind: "buy" | "sell", n = 10) {
  const by = new Map<string, { h: Holding; who: string[] }>();
  for (const inv of INVESTORS) {
    const rows =
      kind === "buy"
        ? inv.holdings.filter(
            (h) =>
              !h.put_call &&
              !h.prn &&
              (h.change === "new" || h.change === "add"),
          )
        : [
            ...inv.holdings.filter(
              (h) => !h.put_call && !h.prn && h.change === "reduce",
            ),
            ...inv.sold.filter((h) => !h.put_call && !h.prn),
          ];
    for (const h of rows) {
      const k = h.cusip;
      const e = by.get(k) ?? { h, who: [] };
      if (!e.who.includes(inv.person)) e.who.push(inv.person);
      by.set(k, e);
    }
  }
  return [...by.values()]
    .filter((e) => e.who.length >= 2)
    .sort((a, b) => b.who.length - a.who.length || b.h.value - a.h.value)
    .slice(0, n);
}

/** 가장 많은 투자자가 고른 분기(보통 가장 최근 분기) */
export function mainPeriod() {
  const c = new Map<string, number>();
  INVESTORS.forEach((i) => c.set(i.period, (c.get(i.period) ?? 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export type Slice = {
  key: string;
  name: string;
  ticker: string | null;
  tag: string;
  weight: number;
};

/**
 * 파이차트 조각: 비중 1% 이상은 한 조각씩, 1% 미만과 목록에 없는 나머지(상위 100개 밖)는 모두 '기타'.
 * 비중은 13F 신고 총액(옵션 포함) 대비라 합이 100%가 된다.
 */
export function pieSlices(inv: Investor, min = 1): Slice[] {
  const big = inv.holdings
    .filter((h) => (h.weight ?? 0) >= min)
    .map((h) => ({
      key: h.cusip + (h.put_call ?? ""),
      name: koName(h.ticker, h.name),
      ticker: h.ticker,
      tag: optionTag(h),
      weight: h.weight ?? 0,
    }));
  const rest = 100 - big.reduce((s, x) => s + x.weight, 0);
  return rest >= 0.05
    ? [
        ...big,
        { key: "etc", name: "기타", ticker: null, tag: "", weight: rest },
      ]
    : big;
}

/** 상위 n개를 '애플 22.0%, 아메리칸 익스프레스 17.1%' 같은 문장으로(검색 결과 설명·요약용) */
export function topText(inv: Investor, n = 5) {
  return inv.holdings
    .filter((h) => !h.prn)
    .slice(0, n)
    .map(
      (h) =>
        `${koName(h.ticker, h.name)}${optionTag(h) ? `(${optionTag(h)})` : ""} ${h.weight?.toFixed(1)}%`,
    )
    .join(", ");
}

/** 이 분기 신고가 없는 투자자의 사정(최근 분기가 다른 사람보다 오래된 경우) */
export const STALE_NOTE: Record<string, string> = {
  burry:
    "사이언 자산운용이 2025년 말 SEC 등록을 정리해 2025년 3분기가 마지막 13F입니다.",
  marks:
    "오크트리는 2026년 3분기에 보유 표 대신 13F-NT(보유를 다른 회사 보고서에 넣어 신고)를 내 2분기가 마지막 표입니다.",
};

export type Change = {
  h: Holding;
  amount: number;
  prevWeight: number | null;
  pct: number | null;
};

/** 지난 분기 대비 변화 네 가지(신규 편입·비중 확대·비중 축소·전량 매도). 옵션·채권은 뺀다. 금액 큰 순 */
export function quarterChanges(inv: Investor) {
  const stock = (h: Holding) => !h.put_call && !h.prn;
  const base = inv.moves?.length ? inv.moves : inv.holdings;
  const amt = (h: Holding) =>
    h.amount ??
    (h.change === "new"
      ? h.value
      : h.prev_shares != null && h.shares > 0
        ? (h.shares - h.prev_shares) * (h.value / h.shares)
        : 0);
  const pw = (h: Holding) =>
    h.prev_weight ?? (inv.prev_total && h.change === "new" ? 0 : null);
  const rows = (kind: "new" | "add" | "reduce"): Change[] =>
    base
      .filter((h) => stock(h) && h.change === kind)
      .map((h) => ({ h, amount: amt(h), prevWeight: pw(h), pct: sharePct(h) }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  // 전량 매도: value는 전 분기 말 평가액
  const sold: Change[] = inv.sold
    .filter(stock)
    .map((h) => ({
      h,
      amount: -h.value,
      prevWeight:
        h.prev_weight ??
        (inv.prev_total ? (h.value / inv.prev_total) * 100 : null),
      pct: -100,
    }))
    .sort((a, b) => a.amount - b.amount);
  return { added: rows("new"), up: rows("add"), down: rows("reduce"), sold };
}
