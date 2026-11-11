import { describe, expect, it } from "vitest";
import { futOpenFromRt, stockCloseFromRt, toKrxClose } from "./night-api";

describe("stockCloseFromRt (KRX 종가)", () => {
  it("장 전·마감 뒤에는 closePrice가 마지막 KRX 종가", () => {
    // 2026-11-09 08:25 프리마켓: 금요일 KRX 종가 188,700(일봉 통합 종가는 193,500)
    expect(stockCloseFromRt({ marketStatus: "PREOPEN", localTradedAt: "2026-11-09T08:25:42+09:00", closePriceRaw: "188700" }, "20261106")).toBe(188700);
    expect(stockCloseFromRt({ marketStatus: "CLOSE", localTradedAt: "2026-11-06T16:00:00+09:00", closePriceRaw: "188700" }, "20261106")).toBe(188700);
  });
  it("다음 날 정규장 중에는 지금가 − 전일 대비로 되짚는다", () => {
    const base = { marketStatus: "OPEN", localTradedAt: "2026-11-09T10:00:00+09:00", closePriceRaw: "192500", compareToPreviousClosePriceRaw: "3800" };
    expect(stockCloseFromRt({ ...base, compareToPreviousPrice: { name: "RISING" } }, "20261106")).toBe(188700);
    expect(stockCloseFromRt({ ...base, closePriceRaw: "184900", compareToPreviousPrice: { name: "FALLING" } }, "20261106")).toBe(188700);
  });
  it("그날 정규장 중이거나 자료가 없으면 null", () => {
    expect(stockCloseFromRt({ marketStatus: "OPEN", localTradedAt: "2026-11-06T15:20:00+09:00", closePriceRaw: "190000" }, "20261106")).toBeNull();
    expect(stockCloseFromRt(undefined, "20261106")).toBeNull();
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
