import { describe, expect, it } from "vitest";
import { industryPages, sectorData } from "./sectors";
import { INDUSTRY_NOTES } from "./industry-notes";
import { INVESTOR_NOTES } from "./investor-notes";
import { INVESTORS } from "./investors13f";

describe("섹터 자료", () => {
  it.each(["kr", "us"] as const)("%s 강도는 섹터 평균 기준이라 합이 0 근처", (m) => {
    const d = sectorData(m);
    for (const p of d.periods) {
      const sum = d.sectors.reduce((s, x) => s + (x.x[p] ?? 0), 0);
      expect(Math.abs(sum)).toBeLessThan(0.1); // 반올림 오차
    }
  });

  it.each(["kr", "us"] as const)("%s 칸은 강도·변화 부호와 맞는다", (m) => {
    for (const s of sectorData(m).sectors) {
      for (const p of sectorData(m).periods) {
        if (s.x[p] == null || s.y[p] == null) continue;
        const want = s.x[p] >= 0 ? (s.y[p] >= 0 ? "lead" : "weaken") : s.y[p] >= 0 ? "watch" : "lag";
        expect(s.q[p]).toBe(want);
      }
    }
  });
});

describe("페이지마다 직접 쓴 설명", () => {
  it("산업 페이지마다 설명이 있고 서로 다르다", () => {
    const pages = industryPages("kr");
    for (const i of pages) expect(INDUSTRY_NOTES[i.name], i.name).toBeTruthy();
    const texts = pages.map((i) => INDUSTRY_NOTES[i.name].drivers);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("투자자 페이지마다 소개가 있다", () => {
    for (const i of INVESTORS) expect(INVESTOR_NOTES[i.id], i.id).toBeTruthy();
  });
});
