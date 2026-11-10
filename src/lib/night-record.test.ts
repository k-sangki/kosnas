import { describe, expect, it } from "vitest";
import { errPct, summarize, type RecordRow } from "./night-record";

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
