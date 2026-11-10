import type { NightInput } from "./night";

/** 밤사이 내 손익 계산기에 넣을 수 있는 종목(무기한선물 원화 환산이 있는 국내 대형주) */
export const PNL_STOCKS = [
  { coin: "SMSN", name: "삼성전자" },
  { coin: "SKHX", name: "SK하이닉스" },
] as const;

export type PnlCoin = (typeof PNL_STOCKS)[number]["coin"];
export type Holdings = Partial<Record<PnlCoin, number>>;

export type PnlRow = { coin: PnlCoin; name: string; shares: number; now: number; base: number; won: number; pct: number };

/** 보유 주수로 쓸 수 있는 값인지(0 이상 정수, 1억 주까지) */
export function cleanShares(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[,\s주]/g, "")) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 1e8) return null;
  return Math.floor(n);
}

/**
 * 종목별 밤사이 손익 추정: 보유 주수 × (지금 원화 환산 가격 − 기준 가격).
 * 기준 가격은 KRX 종가(krxClose), 없으면 등락률로 되돌린 기준(15:45 등) 가격이다.
 */
export function pnlRows(inputs: NightInput[] | undefined, h: Holdings): PnlRow[] {
  const out: PnlRow[] = [];
  for (const s of PNL_STOCKS) {
    const shares = h[s.coin] ?? 0;
    if (!shares) continue;
    const i = inputs?.find((x) => x.coin === s.coin);
    if (!i?.krw || i.chg == null) continue;
    const base = i.krxClose ?? i.krw / (1 + i.chg / 100);
    out.push({ coin: s.coin, name: s.name, shares, now: i.krw, base, won: shares * (i.krw - base), pct: (i.krw / base - 1) * 100 });
  }
  return out;
}

/** 합계 손익과 평가 금액 대비 등락률 */
export function pnlTotal(rows: PnlRow[]) {
  const won = rows.reduce((a, r) => a + r.won, 0);
  const base = rows.reduce((a, r) => a + r.shares * r.base, 0);
  return { won, pct: base ? (won / base) * 100 : 0 };
}

/** 금액을 '83만 원', '1.2억 원', '5,400원'처럼 짧게(부호 포함) */
export function shortWon(v: number) {
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1e8) return `${s}${(a / 1e8).toFixed(a >= 1e10 ? 0 : a >= 1e9 ? 1 : 2).replace(/\.?0+$/, "")}억 원`;
  if (a >= 1e4) return `${s}${(a / 1e4).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, "")}만 원`;
  return `${s}${Math.round(a).toLocaleString("ko-KR")}원`;
}
