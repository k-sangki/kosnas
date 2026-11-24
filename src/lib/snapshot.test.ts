import { describe, expect, it } from "vitest";
import { nightWindow, type NightData } from "./night";
import { liveSnap, nightSnap, oilSnap, snapFor, snapNeeds, stockSnap, usSnap } from "./snapshot";
import type { UsData } from "./us";

// 2026-11-24(화) 22:30 KST — 야간 구간
const now = Date.parse("2026-11-24T13:30:00Z");
const night = {
  window: nightWindow(now),
  method: "fair",
  base: 830,
  baseKind: "close",
  est: 834.15,
  chg: 4.15,
  chgPct: 0.5,
  high: 835,
  low: 829,
  kr200: 833,
  nightClose: 0,
  at0600: null,
  points: [],
  inputs: [{ coin: "SMSN", label: "삼성전자", price: 70, chg: -1.2, krw: 98500 }],
  extra: {
    XYZ100: { price: 25100, prev: 25000, prevAt: now - 3600_000 },
    CL: { price: 70.5, prev: 70 },
  },
  updated: now,
} as unknown as NightData;

describe("서버가 미리 넣는 값", () => {
  it("야간 추정 한 줄에 값·등락률·기준 시각", () => {
    expect(nightSnap(night)).toBe("코스피200 야간선물 추정 834.15 (+0.50%, 주간 종가 대비) · 11/24 22:30 기준 · 실시간 값을 불러오는 중…");
  });
  it("종목·24시간 시세·유가", () => {
    expect(stockSnap(night, "SMSN", "삼성전자")).toContain("삼성전자 야간 추정 98,500원 (-1.20%, KRX 종가 대비)");
    expect(stockSnap(night, "SKHX", "SK하이닉스")).toBeNull();
    expect(liveSnap(night, "XYZ100", "나스닥 100 선물", "", "전일 미국 정규장 마감(뉴욕 16:00) 대비")).toContain("나스닥 100 선물 25,100.00 (+0.40%, 전일 미국 정규장 마감");
    expect(oilSnap(night)).toContain("WTI 원유 $70.50 (+0.71%) · 전일 CME 정산 대비");
  });
  it("미국 증시", () => {
    const us = { session: { prevClose: 0, open: 0, close: now, live: false }, points: [], sp: 0.45, nd: -0.3, inputs: [], updated: now } as UsData;
    expect(usSnap(us)).toContain("S&P 500 +0.45% · 나스닥 100 -0.30% · 지난 정규장(11/24 22:30 마감)");
  });
  it("속성으로 종류를 고르고, 자료가 없으면 null", () => {
    const attr = (n: string) => ({ "data-coin": "SMSN", "data-name": "삼성전자" })[n] ?? null;
    expect(snapFor("stock", attr, night, null)).toContain("98,500원");
    expect(snapFor("us", attr, night, null)).toBeNull();
    expect(snapNeeds("/live/nasdaq-100")).toEqual({ night: true, us: false });
    expect(snapNeeds("/kr/theme/robot")).toBeNull();
  });
});
