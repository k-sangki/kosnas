import { describe, expect, it } from "vitest";
import { usSession } from "./session";
import { assembleUs } from "./us";

const kst = (s: string) => Date.parse(`${s}+09:00`);
const M5 = 300_000;

describe("미장 등락", () => {
  const now = kst("2026-10-21T23:00:00");
  const s = usSession(now);
  // 전일 16:00 직전 봉 100, 장중에는 1%씩 오른다
  const series = (base: number) => {
    const out = [{ t: s.prevClose - M5, c: base }];
    for (let t = s.open - M5; t < now; t += M5) out.push({ t, c: base * (1 + (0.01 * (t - s.open + M5)) / M5) });
    return out;
  };
  const candles = { SP500: series(100), XYZ100: series(200), EWY: series(50) };

  it("직전 거래일 16:00 대비 %로, 개장 시각부터 그린다", () => {
    const d = assembleUs(now, s, candles, {})!;
    expect(d.points[0]).toEqual([s.open, 0, 0]);
    expect(d.points[1][1]).toBeCloseTo(1, 5);
    expect(d.inputs.find((i) => i.coin === "EWY")).toBeUndefined(); // 지금 가격이 없으면 빼고
  });

  it("장중이면 지금 가격을 끝점으로", () => {
    const d = assembleUs(now + 1000, s, candles, { SP500: 103, XYZ100: 190, EWY: 51 })!;
    expect(d.sp).toBe(3);
    expect(d.nd).toBe(-5);
    expect(d.inputs.find((i) => i.coin === "EWY")!.chg).toBe(2);
  });

  it("기준 가격이 없으면 null", () => {
    expect(assembleUs(now, s, { SP500: [], XYZ100: [] }, {})).toBeNull();
  });
});
