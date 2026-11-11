import { describe, expect, it } from "vitest";
import { errPct, stockRowsFrom, summarize, summarizeStocks, type RecordRow } from "./night-record";

const row = (day: string, est: number, open: number, baseKind: "close" | "est" = "close"): RecordRow => ({ day, est, open, base: 800, baseKind, weekend: false });

describe("추정 적중 기록", () => {
  it("등락률 차이(%p)", () => expect(errPct(row("2026-11-10", 808, 804))).toBeCloseTo(0.5));
  it("최근 순·평균 차이·방향", () => {
    const s = summarize([row("2026-11-09", 790, 796), row("2026-11-10", 808, 804), row("2026-11-11", 808, 796), row("2026-11-12", 801, 799, "est")]);
    expect(s.rows[0].day).toBe("2026-11-12");
    expect(s.n).toBe(4);
    expect(s.dirN).toBe(3);
    expect(s.dirHit).toBe(2);
    expect(s.mae).toBeCloseTo((0.75 + 0.5 + 1.5 + 0.25) / 4, 3);
    expect(s.since).toBe("2026-11-09");
  });
  it("빈 기록", () => expect(summarize([]).mae).toBeNull());
});

describe("종목 적중 기록", () => {
  it("stocks 자료에서 줄을 만들고 요약한다", () => {
    const d = { window: { live: false, end: Date.UTC(2026, 10, 12, 0), start: 0 }, stocks: { SMSN: { at0900: 210000, open: 211000, close: 208000 }, SKHX: { at0900: null, open: 1300000, close: 1291000 } } };
    const rows = stockRowsFrom(d as never);
    expect(rows).toEqual([{ day: "2026-11-12", coin: "SMSN", est: 210000, open: 211000, base: 208000 }]);
    const s = summarizeStocks(rows).SMSN;
    expect(s.n).toBe(1);
    expect(s.dirHit).toBe(1);
    expect(s.mae).toBeCloseTo(0.481, 3);
  });
});
