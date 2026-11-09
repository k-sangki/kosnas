import { describe, expect, it } from "vitest";
import { itemsFor, monday, tradingDaysBefore, weeks } from "./schedule";

describe("주요일정", () => {
  it("배당 막차는 기준일 2거래일 전(주말·휴장 건너뜀)", () => {
    expect(tradingDaysBefore("2026-11-20", 2)).toBe("2026-11-18");
    expect(tradingDaysBefore("2026-11-16", 2)).toBe("2026-11-12");
    // 12/31 휴장: 마지막 거래일 12/30에서 2거래일 전
    expect(tradingDaysBefore("2026-12-31", 2)).toBe("2026-12-28");
  });
  it("주는 월요일부터", () => {
    expect(monday("2026-11-09")).toBe("2026-11-09");
    expect(monday("2026-11-15")).toBe("2026-11-09");
  });
  it("옵션 만기: 국장 둘째 목요일, 미장 셋째 금요일", () => {
    expect(
      itemsFor("kr", "2026-11-01", "2026-11-30").some(
        (x) => x.date === "2026-11-12" && x.title.includes("만기"),
      ),
    ).toBe(true);
    expect(
      itemsFor("kr", "2026-12-01", "2026-12-31").find((x) =>
        x.title.includes("만기"),
      )?.date,
    ).toBe("2026-12-10");
    expect(
      itemsFor("us", "2026-11-01", "2026-11-30").find((x) =>
        x.title.includes("만기"),
      )?.date,
    ).toBe("2026-11-20");
  });
  it("이번 주·다음 주 두 묶음", () => {
    const w = weeks("us", "2026-11-11");
    expect(w.map((x) => [x.from, x.to])).toEqual([
      ["2026-11-09", "2026-11-15"],
      ["2026-11-16", "2026-11-22"],
    ]);
    const dates = w[0].days.map((d) => d.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates).toContain("2026-11-10"); // CPI
    expect(dates.every((d) => d >= "2026-11-09" && d <= "2026-11-15")).toBe(
      true,
    );
  });
});
