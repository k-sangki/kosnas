import { describe, expect, it } from "vitest";
import { toQuote } from "./quotes-api";

describe("야후 차트 → 카드 시세", () => {
  it("지금 가격·전일 종가·선(끝 점은 지금 가격)", () => {
    const t0 = Date.parse("2026-11-21T14:30:00Z") / 1000;
    const q = toQuote({
      chart: {
        result: [
          {
            meta: { regularMarketPrice: 210, chartPreviousClose: 220, regularMarketTime: t0 + 23400 },
            timestamp: [t0, t0 + 300, t0 + 600, t0 + 23100],
            indicators: { quote: [{ close: [219, null, 215, 209.5] }] },
          },
        ],
      },
    })!;
    expect(q.price).toBe(210);
    expect(q.prev).toBe(220);
    expect(q.spark).toEqual([219, 215, 210]);
    expect(q.sparkT[0]).toBe(0);
    expect(q.sparkT[2]).toBeCloseTo(23100 / 23400, 3);
  });
  it("가격이 없으면 null", () => {
    expect(toQuote({ chart: { result: [{ meta: {} }] } })).toBeNull();
    expect(toQuote({})).toBeNull();
  });
});
