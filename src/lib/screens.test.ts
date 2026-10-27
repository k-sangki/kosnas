import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, SCREENS, SHOW, applyFilters, chosung, runScreen, searchStocks, type ScreenStock } from "./screens";
import { krScreenStocks } from "./screen-data";

const st = (p: Partial<ScreenStock>): ScreenStock => ({
  code: "000000",
  name: "가",
  market: "KOSPI",
  sector: "semi",
  ind: null,
  rs: 50,
  close: 5000,
  minValEok: 20,
  days: 300,
  chg: 0,
  r: {},
  fromHigh: -30,
  above50: false,
  capEok: 1000,
  base: true,
  ...p,
});

describe("종목 검색", () => {
  const list = [
    st({ code: "005930", name: "삼성전자", rs: 90, capEok: 9000, fromHigh: -3, above50: true }),
    st({ code: "028260", name: "삼성물산", rs: 70, capEok: 3000, market: "KOSDAQ" }),
    st({ code: "000660", name: "SK하이닉스", rs: 95, capEok: 8000, base: false, minValEok: 5, trend: 63 }),
  ];

  it("초성·이름·코드로 찾는다", () => {
    expect(chosung("삼성전자")).toBe("ㅅㅅㅈㅈ");
    expect(searchStocks(list, "ㅅㅅㅈㅈ").map((s) => s.name)).toEqual(["삼성전자"]);
    expect(searchStocks(list, "삼성").map((s) => s.name)).toEqual(["삼성전자", "삼성물산"]);
    expect(searchStocks(list, "005930")[0].name).toBe("삼성전자");
    expect(searchStocks(list, "sk").map((s) => s.name)).toEqual(["SK하이닉스"]);
  });

  it("조건으로 거르고 정렬한다", () => {
    expect(applyFilters(list, DEFAULT_FILTERS).map((s) => s.name)).toEqual(["삼성전자", "삼성물산"]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, on: [] }).map((s) => s.name)).toEqual(["SK하이닉스", "삼성전자", "삼성물산"]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, market: "KOSDAQ" }).map((s) => s.name)).toEqual(["삼성물산"]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, on: [...DEFAULT_FILTERS.on, "high10", "a50"] }).map((s) => s.name)).toEqual(["삼성전자"]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, on: ["a150", "m50"] }).map((s) => s.name)).toEqual(["SK하이닉스"]);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, on: [...DEFAULT_FILTERS.on, "nofin"], sector: "semi" }).length).toBe(2);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, sort: "cap" }).map((s) => s.name)).toEqual(["삼성전자", "삼성물산"]);
  });

  it.each(SCREENS)("고정 조건 $slug 은 실제 자료로 목록이 나온다", (s) => {
    const out = runScreen(krScreenStocks(), s);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(SHOW);
  });
});
