import { describe, expect, it } from "vitest";
import {
  MASTERS,
  MAX_POINTS,
  QUESTIONS,
  decodePcts,
  encodePcts,
  score,
} from "./invest-test";

describe("투자 성향 테스트", () => {
  it("문항마다 보기 4개, 모든 대가가 점수를 받을 수 있다", () => {
    expect(QUESTIONS).toHaveLength(12);
    for (const q of QUESTIONS) expect(q.options).toHaveLength(4);
    for (const m of MASTERS)
      expect(MAX_POINTS[m.id]).toBeGreaterThanOrEqual(10);
  });

  it("대가마다 그 대가가 1등이 되는 답이 있다", () => {
    for (const m of MASTERS) {
      const best = QUESTIONS.map((q) => {
        let bi = 0;
        let bv = -Infinity;
        q.options.forEach((o, i) => {
          const v =
            (o.p[m.id] ?? 0) * 10 -
            Object.values(o.p).reduce((s, x) => s + (x ?? 0), 0);
          if (v > bv) [bi, bv] = [i, v];
        });
        return bi;
      });
      const r = score(best);
      expect(r[0].id).toBe(m.id);
      expect(r[0].pct).toBe(100);
    }
  });

  it("아무렇게나 답해도 결과가 한쪽으로 쏠리지 않는다", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const n: Record<string, number> = {};
    const N = 4000;
    for (let k = 0; k < N; k++) {
      const top = score(QUESTIONS.map(() => Math.floor(rnd() * 4)))[0].id;
      n[top] = (n[top] ?? 0) + 1;
    }
    for (const m of MASTERS) {
      expect(n[m.id] ?? 0, m.id).toBeGreaterThan(N * 0.05);
      expect(n[m.id] ?? 0, m.id).toBeLessThan(N * 0.25);
    }
  });

  it("공유 주소의 % 를 되살린다", () => {
    const r = score([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
    const back = decodePcts(encodePcts(r))!;
    expect(back.map((x) => x.id)[0]).toBe(r[0].id);
    expect(decodePcts("12")).toBeNull();
    expect(decodePcts(null)).toBeNull();
  });
});
