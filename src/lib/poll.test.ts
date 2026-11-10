import { describe, expect, it } from "vitest";
import { closeAt, currentRound, hitRate, liveSide, majority, myStreak, outcome, roundFor, verdict } from "./poll";

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

  it("장중 방향은 판정과 같은 보합 문턱", () => {
    expect(liveSide(null)).toBeNull();
    expect(liveSide(0.01)).toBe("flat");
    expect(liveSide(0.3)).toBe("up");
    expect(liveSide(-0.3)).toBe("down");
  });

  it("연속 적중은 안 누른 회차·보합을 건너뛰고 첫 빗나감에서 멈춘다", () => {
    const past = [
      { target: "e", up: 1, down: 0, pct: 0.5 },
      { target: "d", up: 1, down: 0, pct: 0 },
      { target: "c", up: 1, down: 0, pct: -0.5 },
      { target: "b", up: 1, down: 0, pct: 0.5 },
      { target: "a", up: 1, down: 0, pct: 0.5 },
    ];
    expect(myStreak(past, { e: "up", d: "down", c: "down", b: "down", a: "up" })).toBe(2);
    expect(myStreak(past, { e: "down" })).toBe(0);
  });
});

describe("내 결과 한 줄", () => {
  const p = { target: "2026-11-03", up: 70, down: 30, pct: -0.8 };
  it("소수파 적중과 맞힌 사람 비율", () => {
    expect(verdict(p, "down")).toEqual({ hit: true, crowdPct: 30, minority: true });
  });
  it("다수 쪽 빗나감", () => {
    expect(verdict(p, "up")).toEqual({ hit: false, crowdPct: 30, minority: false });
  });
  it("보합·안 누름은 없음", () => {
    expect(verdict({ ...p, pct: 0.01 }, "up")).toBeNull();
    expect(verdict(p, undefined)).toBeNull();
  });
});

describe("워들식 월간 기록·쏠린 날", () => {
  const past = [
    { target: "2026-11-04", up: 90, down: 10, pct: 0.5 },
    { target: "2026-11-03", up: 85, down: 15, pct: -0.4 },
    { target: "2026-11-02", up: 5, down: 5, pct: 0.01 },
    { target: "2026-10-31", up: 1, down: 2, pct: 1 },
  ];
  const mine = { "2026-11-04": "up", "2026-11-03": "up", "2026-11-02": "down", "2026-10-31": "up" } as const;
  it("그 달 칸과 공유 문구", async () => {
    const { monthMarks, shareText } = await import("./poll");
    const m = monthMarks(past, { ...mine }, "2026-11");
    expect(m.map((x) => x.mark).join("")).toBe("⬜🟥🟩");
    expect(shareText("2026-11", m, 1)).toBe("코스나스 오늘의 한 표 11월 1/2\n⬜🟥🟩");
  });
  it("80% 넘게 쏠린 날 다수 적중", async () => {
    const { leanRate } = await import("./poll");
    expect(leanRate(past)).toEqual({ n: 2, hit: 1 });
  });
});
