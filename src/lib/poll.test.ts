import { describe, expect, it } from "vitest";
import { closeAt, currentRound, hitRate, majority, outcome, roundFor } from "./poll";

const kst = (s: string) => Date.parse(`${s}+09:00`);

describe("오늘의 한 표 회차", () => {
  it("장 끝난 뒤에는 다음 거래일 회차가 열린다", () => {
    const r = currentRound(kst("2026-10-23T16:00:00")); // 금요일 장 뒤
    expect(r.target).toBe("2026-10-26");
    expect(r.start).toBe(kst("2026-10-23T15:45:00"));
    expect(r.closes).toBe(kst("2026-10-26T09:00:00"));
    expect(r.end).toBe(kst("2026-10-26T15:45:00"));
  });

  it("장중에는 그날 회차가 마감된 채로 남는다", () => {
    const r = currentRound(kst("2026-10-26T10:00:00"));
    expect(r.target).toBe("2026-10-26");
    expect(kst("2026-10-26T10:00:00") >= r.closes).toBe(true);
  });

  it("휴장일은 건너뛰고 비교 기준도 휴장 전 거래일이다", () => {
    expect(currentRound(kst("2026-12-24T16:00:00")).target).toBe("2026-12-28");
    expect(roundFor("2026-12-28").start).toBe(kst("2026-12-24T15:45:00"));
    expect(currentRound(kst("2026-12-30T16:00:00")).target).toBe("2027-01-04");
  });

  it("판정 가격은 15:45에 끝난 15분봉 종가", () => {
    const end = kst("2026-10-26T15:45:00");
    const m = 60_000;
    const c = [
      { t: end - 30 * m, c: 1 },
      { t: end - 15 * m, c: 2 },
      { t: end, c: 3 },
    ];
    expect(closeAt(c, end)).toBe(2);
    expect(closeAt([{ t: end - 60 * m, c: 5 }], end)).toBe(5);
    expect(closeAt([{ t: end, c: 5 }], end)).toBeNull();
  });

  it("보합·동률은 적중에서 뺀다", () => {
    expect(outcome(0.01)).toBeNull();
    expect(outcome(-0.5)).toBe("down");
    expect(majority(3, 3)).toBeNull();
    expect(
      hitRate([
        { target: "a", up: 5, down: 2, pct: 0.8 },
        { target: "b", up: 5, down: 2, pct: -0.8 },
        { target: "c", up: 2, down: 2, pct: 0.8 },
        { target: "d", up: 1, down: 0, pct: 0 },
      ]),
    ).toEqual({ n: 2, hit: 1 });
  });
});
