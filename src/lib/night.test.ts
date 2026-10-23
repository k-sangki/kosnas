import { describe, expect, it } from "vitest";
import fx from "./fixtures/night-20261020.json";
import fx22 from "./fixtures/night-20261022.json";
import {
  assemble,
  windowSpark,
  carryFactor,
  frontExpiry,
  isExpiryDay,
  nightClose,
  nightWindow,
  premiumAt,
  priceAt,
  stepFor,
  usOpenIn,
  valueAt,
  hhmm,
  type Candle,
} from "./night";

const kst = (s: string) => Date.parse(`${s}+09:00`);
const toCandles = (rows: number[][]) => rows.map(([t, c]) => ({ t, c }));
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

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

  it("기준가 자료가 없으면 이전 방식: 기준점은 15:44 시작 1분봉(15:45 마감)의 KR200", () => {
    expect(d.method).toBe("blend");
    expect(d.baseKind).toBe("est");
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
    expect(last[1]).toBeCloseTo(e.base * Math.sqrt((160 / priceAt(candles.EWY, win.start)!.c) * (900 / e.base)), 1);
  });
});

describe("만기·베이시스", () => {
  it("다음 분기 만기는 3·6·9·12월 둘째 목요일 15:45", () => {
    expect(frontExpiry(kst("2026-10-22T15:45:00"))).toBe(kst("2026-12-10T15:45:00"));
    expect(frontExpiry(kst("2026-12-10T15:44:00"))).toBe(kst("2026-12-10T15:45:00"));
    expect(frontExpiry(kst("2026-12-10T15:45:00"))).toBe(kst("2027-03-11T15:45:00"));
    expect(frontExpiry(kst("2026-01-05T09:00:00"))).toBe(kst("2026-03-12T15:45:00"));
  });
  it("2026-10-22 배율은 만기까지 49일 몫(1.0023)", () => {
    expect(carryFactor(kst("2026-10-22T15:45:00"))).toBeCloseTo(1 + (0.0171 * 49) / 365, 10);
  });
  it("만기일 밤만 주간 종가를 쓰지 않는다", () => {
    expect(isExpiryDay(nightWindow(kst("2026-12-10T20:00:00")))).toBe(true);
    expect(isExpiryDay(nightWindow(kst("2026-12-11T20:00:00")))).toBe(false);
  });
  it("야간 마감은 다음 날 06:00, 금요일 밤은 토요일 06:00", () => {
    expect(nightClose(nightWindow(kst("2026-10-22T20:00:00")))).toBe(kst("2026-10-23T06:00:00"));
    expect(nightClose(nightWindow(kst("2026-10-25T12:00:00")))).toBe(kst("2026-10-24T06:00:00"));
  });
});

describe("시간별 프리미엄", () => {
  // 원천의 정산 시각은 정각에서 몇십 ms 늦다
  const p = premiumAt(
    [
      { t: kst("2026-10-22T21:00:00") + 62, p: 0.002 },
      { t: kst("2026-10-22T22:00:00") + 61, p: 0.001 },
    ],
    0.003,
  );
  it("정각에 끝나는 그 시간의 평균", () => {
    expect(p(kst("2026-10-22T20:30:00"))).toBe(0.002);
    expect(p(kst("2026-10-22T21:00:00"))).toBe(0.002);
    expect(p(kst("2026-10-22T21:01:00"))).toBe(0.001);
  });
  it("아직 정산 전인 지금 시간은 지금 프리미엄, 앞쪽 빈 시간은 가장 이른 값", () => {
    expect(p(kst("2026-10-22T22:30:00"))).toBe(0.003);
    expect(p(kst("2026-10-22T18:30:00"))).toBe(0.002);
  });
});

describe("기준가 방식(2026-10-22 밤)", () => {
  const candles = { EWY: toCandles(fx22.EWY), KR200: toCandles(fx22.KR200) };
  const prem = fx22.premium.map(([t, p]) => ({ t, p }));
  const now = kst("2026-10-22T23:30:00");
  const win = nightWindow(now);
  const fair = { oracle: null, premium: null, prem, close: fx22.close };
  const d = assemble(now, { ...win, live: false }, candles, {}, 60_000, fair)!;
  const f = carryFactor(win.start);

  it("등락률 기준은 KRX 주간 종가(857.00)", () => {
    expect(d.method).toBe("fair");
    expect(d.baseKind).toBe("close");
    expect(d.base).toBe(857);
    expect(d.points[0][0]).toBe(win.start);
  });

  it("지난 시각 값은 그때 기록한 KR200 기준가 × 배율과 평균 0.15%, 최대 0.4% 안", () => {
    const errs = fx22.oracle.map(([t, o]) => Math.abs(valueAt(d.points, t)! / (o * f) - 1));
    expect(errs.length).toBeGreaterThan(50);
    expect(mean(errs)).toBeLessThan(0.0015);
    expect(Math.max(...errs)).toBeLessThan(0.004);
  });

  it("지금 값은 지금 KR200 기준가 × 배율", () => {
    const t = kst("2026-10-22T23:29:30");
    const e = assemble(t, { ...win, live: true }, candles, { EWY: 151.37, KR200: 855.98 }, 60_000, { ...fair, oracle: 855.13 })!;
    expect(e.est).toBeCloseTo(855.13 * f, 1);
    expect(e.chgPct).toBeCloseTo(((855.13 * f) / 857 - 1) * 100, 1);
  });

  it("주간 종가가 15:45 추정값과 3% 넘게 다르면 15:45 추정값을 기준으로", () => {
    const e = assemble(now, { ...win, live: false }, candles, {}, 60_000, { ...fair, close: 800 })!;
    expect(e.baseKind).toBe("est");
    expect(e.base).toBe(e.points[0][1]);
  });
});

describe("기준가 방식 06:00 뒤", () => {
  // 06:00 전: EWY 150·KR200 860, 06:00 뒤: EWY +2%·KR200 +1%
  const win = nightWindow(kst("2026-10-22T20:00:00"));
  const close = nightClose(win);
  const ewy: Candle[] = [];
  const kr: Candle[] = [];
  for (let t = win.start - 5 * 60_000; t < win.end; t += 60_000) {
    ewy.push({ t, c: t < close ? 150 : 153 });
    kr.push({ t, c: t < close ? 860 : 868.6 });
  }
  const prem = [{ t: close, p: 0.002 }];
  const fair = { oracle: null, premium: 0.002, prem, close: 857 };
  const f = carryFactor(win.start);
  const v06 = Math.round((860 / 1.002) * f * 100) / 100;

  it("06:00까지는 체결가 ÷ (1 + 프리미엄) × 배율, 06:00 값이 at0600", () => {
    const d = assemble(win.end, { ...win, live: false }, { EWY: ewy, KR200: kr }, {}, 60_000, fair)!;
    expect(valueAt(d.points, kst("2026-10-23T03:00:00"))).toBe(v06);
    expect(d.at0600).toBe(v06);
    expect(valueAt(d.points, kst("2026-10-23T07:00:00"))).toBeCloseTo(v06 * Math.sqrt(1.02 * 1.01), 1);
  });

  it("06:00 뒤 지금 값은 06:00 값에 EWY·KR200 표시 가격 등락을 반반 섞는다", () => {
    const now = kst("2026-10-23T08:00:30");
    const d = assemble(
      now,
      { ...win, live: true },
      { EWY: ewy.filter((k) => k.t < now), KR200: kr.filter((k) => k.t < now) },
      { EWY: 156, KR200: 877.2 },
      60_000,
      {
        ...fair,
        oracle: 999,
      },
    )!;
    expect(d.est).toBeCloseTo(v06 * Math.sqrt((156 / 150) * (877.2 / 860)), 1);
  });
});

describe("windowSpark", () => {
  const win = { start: 0, end: 1000, live: true };
  it("가로 위치는 야간 구간 안의 시각 비율이라 지금 뒤는 비어 있다", () => {
    expect(windowSpark(win, 10, [[100, 11], [200, 12]], [300, 13])).toEqual({ spark: [10, 11, 12, 13], sparkT: [0, 0.1, 0.2, 0.3] });
  });
  it("구간이 끝났으면 끝까지 찬다", () => {
    expect(windowSpark({ ...win, live: false }, 10, [[500, 11], [1000, 12]], null)?.sparkT).toEqual([0, 0.5, 1]);
  });
  it("점이 하나뿐이면 그리지 않는다", () => {
    expect(windowSpark(win, 10, [], null)).toBeUndefined();
  });
});
