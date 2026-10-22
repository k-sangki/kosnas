import raw from "@/data/investors.json";

/** 유명 투자자 최근 30일 공시(collector/investors_recent.py가 만든다) */
export type MoveKind = "buy" | "sell" | "acquire" | "dispose" | "stake";

export type Move = {
  investor: string;
  form: string;
  /** 공시일 */
  filed: string;
  acc: string;
  /** SEC 원문 */
  url: string;
  kind: MoveKind;
  issuer: string | null;
  ticker: string;
  shares: number | null;
  /** Form 4: 매매 금액(달러)·평균 가격·매매 뒤 보유 주식 수·거래 날짜 */
  value?: number | null;
  price?: number | null;
  after?: number | null;
  from?: string | null;
  to?: string | null;
  /** 13D·13G: 지분율(%)·앞 보고서 지분율·사건 날짜·정정 여부·13D(경영 참여 가능) 여부 */
  pct?: number | null;
  prev_pct?: number | null;
  event_date?: string | null;
  amend?: boolean;
  active?: boolean;
};

export type ArkTrade = {
  date: string;
  fund: string;
  ticker: string;
  name: string;
  kind: "new" | "exit" | "buy" | "sell";
  shares: number;
  value: number;
};

type Data = {
  updated: string;
  since: string;
  window: number;
  failed: string[];
  investors: { id: string; name: string; firm: string }[];
  events: Move[];
  ark: { started: string | null; asof: string | null; trades: ArkTrade[] };
};

export const DATA = raw as unknown as Data;
export const MOVES: Move[] = DATA.events;
export const ARK = DATA.ark;
const WHO = new Map(DATA.investors.map((i) => [i.id, i]));
export const who = (id: string) => WHO.get(id);

/** 최근 기간 공시가 하나도 없는 투자자 */
export const quiet = () => DATA.investors.filter((i) => !MOVES.some((m) => m.investor === i.id));

/** 2026-10-07 → 10월 7일 */
export function md(d: string | null | undefined) {
  if (!d) return "";
  const [, m, day] = d.split("-").map(Number);
  return `${m}월 ${day}일`;
}

/** 달러 금액을 억·만 단위로 */
export function usd(v: number): string {
  if (v < 0) return `-${usd(-v)}`;
  if (v >= 1e8) {
    const e = v / 1e8;
    return `${e >= 100 ? Math.round(e).toLocaleString() : e.toFixed(1)}억 달러`;
  }
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString()}만 달러`;
  return `${Math.round(v).toLocaleString()}달러`;
}

/** 주식 수를 만·억 주로 */
export function shares(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억 주`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString()}만 주`;
  return `${Math.round(v).toLocaleString()}주`;
}

/** 공시 한 줄의 동작 이름과 색 */
export function action(m: Move): { text: string; tone: "up" | "down" | "" } {
  switch (m.kind) {
    case "buy":
      return { text: "장내 매수", tone: "up" };
    case "sell":
      return { text: "장내 매도", tone: "down" };
    case "acquire":
      return { text: "주식 취득", tone: "up" };
    case "dispose":
      return { text: "주식 처분", tone: "down" };
  }
  const pct = m.pct != null ? `${m.pct}%` : "";
  if (m.amend && m.prev_pct != null && m.pct != null) {
    if (m.pct === m.prev_pct) return { text: `지분 ${pct} 유지`, tone: "" };
    return { text: `지분 ${m.prev_pct}% → ${pct}`, tone: m.pct > m.prev_pct ? "up" : "down" };
  }
  if (m.amend) return { text: `지분 ${pct} 변경 신고`, tone: "" };
  return { text: `지분 ${pct} 새로 신고`, tone: "up" };
}

export const ARK_KIND: Record<ArkTrade["kind"], { text: string; tone: "up" | "down" }> = {
  new: { text: "신규 매수", tone: "up" },
  buy: { text: "추가 매수", tone: "up" },
  sell: { text: "일부 매도", tone: "down" },
  exit: { text: "전량 매도", tone: "down" },
};
