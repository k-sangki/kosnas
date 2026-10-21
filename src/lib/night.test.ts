import { describe, expect, it } from "vitest";
import fx from "./fixtures/night-20261020.json";
import { assemble, nightWindow, priceAt, stepFor, usOpenIn, hhmm } from "./night";

const kst = (s: string) => Date.parse(`${s}+09:00`);
const toCandles = (rows: number[][]) => rows.map(([t, c]) => ({ t, c }));

describe("야간 구간", () => {
  it("평일 저녁은 그날 15:45 ~ 다음 날 09:00, 진행 중", () => {
    const w = nightWindow(kst("2026-10-20T22:00:00"));
    expect(w.start).toBe(kst("2026-10-20T15:45:00"));
    expect(w.end).toBe(kst("2026-10-21T09:00:00"));
    expect(w.live).toBe(true);
  });
  it("장중에는 지난밤 구간을 끝난 것으로", () => {
    const w = nightWindow(kst("2026-10-21T12:00:00"));
    expect(w.start).toBe(kst("2026-10-20T15:45:00"));
    expect(w.live).toBe(false);
  });
  it("금요일 밤은 월요일 09:00까지, 주말 내내 진행 중", () => {
    const w = nightWindow(kst("2026-10-25T10:00:00")); // 일요일
    expect(w.start).toBe(kst("2026-10-23T15:45:00"));
    expect(w.end).toBe(kst("2026-10-26T09:00:00"));
    expect(w.live).toBe(true);
    expect(stepFor(w, w.end)).toBe(60_000); // 65시간 = 3,915분이라 1분봉으로 된다
  });
  it("월요일 새벽은 금요일 구간", () => {
    expect(nightWindow(kst("2026-10-26T03:00:00")).start).toBe(kst("2026-10-23T15:45:00"));
  });
  it("미국 개장: 서머타임 22:30, 표준시 23:30", () => {
    expect(hhmm(usOpenIn(nightWindow(kst("2026-10-20T20:00:00")))!)).toBe("22:30");
    expect(hhmm(usOpenIn(nightWindow(kst("2026-11-10T20:00:00")))!)).toBe("23:30");
  });
});

describe("추정선", () => {
  const now = kst("2026-10-21T06:00:00");
  const win = nightWindow(now);
  const candles = { EWY: toCandles(fx.EWY), KR200: toCandles(fx.KR200) };
  const d = assemble(now, win, candles, { EWY: null, KR200: null })!;

  it("기준점은 15:44 시작 1분봉(15:45 마감)의 KR200", () => {
    expect(priceAt(candles.KR200, win.start)!.t).toBe(kst("2026-10-20T15:44:00"));
    expect(d.base).toBe(priceAt(candles.KR200, win.start)!.c);
    expect(d.points[0][0]).toBe(win.start);
  });

  it("2026-10-20 밤 esignal 야간 추정가와 평균 0.5%, 최대 1% 안에서 같이 움직인다", () => {
    const at = new Map(d.points.map((p) => [Math.floor((p[0] - 60_000) / 60_000) * 60_000, p[1]]));
    const errs = (fx.esignal as number[][])
      .map(([t, v]) => {
        const ours = at.get(Math.floor(t / 60_000) * 60_000);
        return ours == null ? null : Math.abs(ours / v - 1);
      })
      .filter((e): e is number => e != null);
    expect(errs.length).toBeGreaterThan(100);
    expect(errs.reduce((a, b) => a + b, 0) / errs.length).toBeLessThan(0.005);
    expect(Math.max(...errs)).toBeLessThan(0.01);
  });

  it("지금 가격을 끝점으로 붙인다", () => {
    const live = { ...win, live: true };
    const t = kst("2026-10-21T06:00:30");
    const e = assemble(t, live, candles, { EWY: 160, KR200: 900 })!;
    const last = e.points[e.points.length - 1];
    expect(last[2]).toBe(900);
    expect(last[1]).toBeCloseTo((e.base * 160) / priceAt(candles.EWY, win.start)!.c, 1);
  });
});
