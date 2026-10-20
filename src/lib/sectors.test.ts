import { describe, expect, it } from "vitest";
import { sectorData } from "./sectors";

describe("섹터 자료", () => {
  it.each(["kr", "us"] as const)("%s 강도는 섹터 평균 기준이라 합이 0 근처", (m) => {
    const d = sectorData(m);
    for (const p of d.periods) {
      const sum = d.sectors.reduce((s, x) => s + x.x[p], 0);
      expect(Math.abs(sum)).toBeLessThan(0.1);
    }
  });

  it.each(["kr", "us"] as const)("%s 칸은 강도·변화 부호와 맞는다", (m) => {
    for (const s of sectorData(m).sectors) {
      for (const p of sectorData(m).periods) {
        const want = s.x[p] >= 0 ? (s.y[p] >= 0 ? "lead" : "weaken") : s.y[p] >= 0 ? "watch" : "lag";
        expect(s.q[p]).toBe(want);
      }
    }
  });
});
