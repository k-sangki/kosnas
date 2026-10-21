import { describe, expect, it } from "vitest";
import { hhmm } from "./night";
import { usSession } from "./session";

const kst = (s: string) => Date.parse(`${s}+09:00`);

describe("미국 정규장 열림 여부(KST)", () => {
  it.each([
    ["2026-10-21T22:29:00", false],
    ["2026-10-21T22:30:00", true], // 서머타임: 22:30 개장
    ["2026-10-22T04:59:00", true],
    ["2026-10-22T05:00:00", false],
    ["2026-11-10T22:45:00", false], // 표준시: 23:30 개장
    ["2026-11-10T23:30:00", true],
    ["2026-11-11T05:30:00", true],
    ["2026-11-11T06:00:00", false],
    ["2026-10-24T03:00:00", true], // 금요일 미국장(토요일 새벽)
    ["2026-10-24T23:00:00", false], // 토요일 밤엔 미국장이 없다
  ])("%s → %s", (t, live) => expect(usSession(kst(t)).live).toBe(live));
});

describe("미국 정규장", () => {
  it("열려 있으면 오늘 장, 기준은 전 거래일 16:00", () => {
    const s = usSession(kst("2026-10-21T23:00:00"));
    expect(s.open).toBe(kst("2026-10-21T22:30:00"));
    expect(s.close).toBe(kst("2026-10-22T05:00:00"));
    expect(s.prevClose).toBe(kst("2026-10-21T05:00:00"));
    expect(s.live).toBe(true);
  });
  it("월요일 장의 기준은 금요일 16:00", () => {
    const s = usSession(kst("2026-10-27T01:00:00"));
    expect(s.prevClose).toBe(kst("2026-10-24T05:00:00"));
  });
  it("장 전에는 지난 장을 끝난 것으로", () => {
    const s = usSession(kst("2026-10-21T15:00:00"));
    expect(s.open).toBe(kst("2026-10-20T22:30:00"));
    expect(s.live).toBe(false);
  });
  it("서머타임이 끝난 주(11/2 월): 23:30 개장, 기준은 금요일 05:00", () => {
    const s = usSession(kst("2026-11-03T00:00:00"));
    expect(hhmm(s.open)).toBe("23:30");
    expect(s.prevClose).toBe(kst("2026-10-31T05:00:00"));
  });
});
