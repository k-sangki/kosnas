import { describe, expect, it } from "vitest";
import { cleanShares, pnlRows, pnlTotal, shortWon } from "./night-pnl";

describe("밤사이 내 손익", () => {
  const inputs = [
    { coin: "SMSN", label: "", price: 139, chg: 1, krw: 101_000, krxClose: 100_000 },
    { coin: "SKHX", label: "", price: 500, chg: -2, krw: 490_000 },
  ];
  it("KRX 종가 대비, 없으면 등락률로 되돌린 기준 대비", () => {
    const rows = pnlRows(inputs, { SMSN: 100, SKHX: 10 });
    expect(rows[0].won).toBe(100_000);
    expect(rows[1].won).toBeCloseTo(-100_000, 0);
    const t = pnlTotal(rows);
    expect(t.won).toBeCloseTo(0, 0);
  });
  it("0주·가격 없는 종목은 뺀다", () => {
    expect(pnlRows(inputs, { SMSN: 0 })).toEqual([]);
    expect(pnlRows([], { SMSN: 3 })).toEqual([]);
  });
  it("주수 입력 정리", () => {
    expect(cleanShares("1,234주")).toBe(1234);
    expect(cleanShares("-1")).toBeNull();
    expect(cleanShares("abc")).toBeNull();
  });
  it("짧은 금액", () => {
    expect(shortWon(830_000)).toBe("+83만 원");
    expect(shortWon(-83_400)).toBe("−8.3만 원");
    expect(shortWon(5_400)).toBe("+5,400원");
    expect(shortWon(123_000_000)).toBe("+1.23억 원");
    expect(shortWon(0)).toBe("0원");
  });
});
