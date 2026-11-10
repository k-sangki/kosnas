import { describe, expect, it } from "vitest";
import { contextFor, type KospiStats } from "./kospi-stats";

const s: KospiStats = {
  updated: "2026-11-09",
  index: "코스피200",
  since: "2006-01-04",
  last: "2026-11-09",
  days: 100,
  big: 1.5,
  ups: [["2026-10-28", 7.4], ["2008-10-30", 12.2], ["2026-11-02", 2.3]],
  downs: [["2026-03-04", -11.9]],
  gaps: [
    { k: 2, n: 129, upFromOpen: 55, ocAvg: 0.1, chgAvg: 3.2, closeAbovePrev: 94 },
    { k: 3, n: 46, upFromOpen: 54, ocAvg: 0.1, chgAvg: 4.3, closeAbovePrev: 93 },
    { k: 5, n: 3, upFromOpen: 57, ocAvg: 0.6, chgAvg: 6.7, closeAbovePrev: 100 },
  ],
};

describe("극단값의 맥락", () => {
  it("작은 움직임은 붙이지 않는다", () => expect(contextFor(1.2, s)).toBeNull());
  it("이상 움직인 날 수·올해·최근", () => {
    const c = contextFor(5.69, s, 2026)!;
    expect(c.n).toBe(2);
    expect(c.thisYear).toBe(1);
    expect(c.latest).toBe("2026-10-28");
    // 5% 문턱은 표본 3일이라 빼고 3%를 쓴다
    expect(c.gap?.k).toBe(3);
  });
  it("하락", () => {
    const c = contextFor(-2, s, 2026)!;
    expect(c.n).toBe(1);
    expect(c.gap).toBeNull();
  });
});
