import { describe, expect, it } from "vitest";
import { datasetDescription } from "./seo";

describe("datasetDescription", () => {
  it("50자 미만이면 기준일·출처 문장을 붙여 50자 이상으로 만든다", () => {
    const out = datasetDescription("사업 내용으로 고른 원전 관련주 20종목의 시가총액.", "2026-11-03");
    expect([...out].length).toBeGreaterThanOrEqual(50);
    expect(out).toContain("2026년 11월 3일");
  });

  it("50자 이상이면 그대로 둔다", () => {
    const text = "가".repeat(60);
    expect(datasetDescription(text, "2026-11-03")).toBe(text);
  });

  it("5000자를 넘지 않는다", () => {
    expect([...datasetDescription("가".repeat(6000), "2026-11-03")].length).toBeLessThanOrEqual(5000);
  });
});
