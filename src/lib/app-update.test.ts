import { describe, expect, it } from "vitest";
import { dueForCheck, isNewVersion, reloadAllowed, RETRY_AFTER_MS } from "./app-update";

describe("app-update", () => {
  it("버전이 다를 때만 새 버전", () => {
    expect(isNewVersion("a", "b")).toBe(true);
    expect(isNewVersion("a", "a")).toBe(false);
    expect(isNewVersion(null, "b")).toBe(false);
    expect(isNewVersion("dev", "b")).toBe(false);
    expect(isNewVersion("a", "dev")).toBe(false);
  });
  it("같은 버전으로 방금 다시 불러왔으면 되풀이하지 않는다", () => {
    expect(reloadAllowed("b", null, 0)).toBe(true);
    expect(reloadAllowed("b", { v: "c", at: 0 }, 1)).toBe(true);
    expect(reloadAllowed("b", { v: "b", at: 0 }, 1000)).toBe(false);
    expect(reloadAllowed("b", { v: "b", at: 0 }, RETRY_AFTER_MS + 1)).toBe(true);
  });
  it("확인 간격", () => {
    expect(dueForCheck(0, 29_999)).toBe(false);
    expect(dueForCheck(0, 30_000)).toBe(true);
  });
});
