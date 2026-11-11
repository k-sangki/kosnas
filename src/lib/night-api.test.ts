import { describe, expect, it } from "vitest";
import { futOpenFromRt, krxRatio, regularFromMinutes, toKrxClose } from "./night-api";

describe("regularFromMinutes (정규장 종가·시가)", () => {
  const rows = [
    { localDateTime: "20261111090000", currentPrice: 197500, openPrice: 197100 },
    { localDateTime: "20261111153000", currentPrice: 206000, openPrice: 206000 },
    { localDateTime: "20261111154000", currentPrice: 206100, openPrice: 206000 },
  ];
  it("15:30 봉 가격이 종가, 09:00 봉 시가가 시가", () => {
    expect(regularFromMinutes(rows, "20261111", "close")).toBe(206000);
    expect(regularFromMinutes(rows, "20261111", "open")).toBe(197100);
  });
  it("그 봉이 없거나 다른 날이면 null", () => {
    expect(regularFromMinutes(rows.slice(2), "20261111", "close")).toBeNull();
    expect(regularFromMinutes(rows, "20261110", "close")).toBeNull();
    expect(regularFromMinutes(null, "20261111", "open")).toBeNull();
  });
});

describe("futOpenFromRt (주간 시가)", () => {
  it("그날 체결된 시가만 쓴다", () => {
    const d = { openPriceRaw: "784.00", localTradedAt: "2026-11-09T15:34:59+09:00" };
    expect(futOpenFromRt(d, "20261109")).toBe(784);
    expect(futOpenFromRt(d, "20261110")).toBeNull();
    expect(futOpenFromRt({ openPriceRaw: "0", localTradedAt: "2026-11-10T09:20:00+09:00" }, "20261110")).toBeNull();
  });
});

describe("toKrxClose (종가 시각 대비 배율)", () => {
  const i = { coin: "SMSN", label: "삼성전자", price: 156.37, chg: 1.3, krw: 208628 };
  it("종가 × (지금 ÷ 종가 시각 무기한선물)", () => {
    // 2026-11-11: 종가 208,000, 15:30 무기한선물 154.37 → +1.30%
    const r = toKrxClose(i, 208000, 154.37);
    expect(r.chg).toBe(1.3);
    expect(r.krw).toBe(Math.round((208000 * 156.37) / 154.37));
    expect(r.krxClose).toBe(208000);
  });
  it("종가나 종가 시각 가격이 없거나 배율이 이상하면 그대로", () => {
    expect(toKrxClose(i, null, 154.37)).toBe(i);
    expect(toKrxClose(i, 208000, undefined)).toBe(i);
    expect(toKrxClose(i, 208000, 50)).toBe(i);
  });
});

describe("krxRatio (원/달러 포함)", () => {
  it("원화 환산값끼리 견준다", () => {
    expect(krxRatio(101, 100, 1340, 1330)).toBeCloseTo((101 * 1340) / (100 * 1330), 10);
    expect(krxRatio(101, 100, null, 1330)).toBeCloseTo(1.01, 10);
    expect(krxRatio(101, null)).toBeNull();
  });
});
