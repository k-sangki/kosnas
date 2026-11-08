import { describe, expect, it } from "vitest";
import { stockCloseFromRt } from "./night-api";

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
