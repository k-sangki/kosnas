import { describe, expect, it } from "vitest";
import { GAP_MS, PER_MIN, checkText, cleanNick, mask, quote, randomNick, rateLimit } from "./chat";

describe("채팅 규칙", () => {
  it("B급 닉네임은 두 단어", () => {
    expect(randomNick(0, 0)).toBe("물린 개미");
    expect(randomNick(0.9999, 0.9999).split(" ").length).toBeGreaterThanOrEqual(2);
  });

  it("닉네임은 12자로 자르고 줄바꿈·제어 문자를 지운다", () => {
    expect(cleanNick("  존버\n하는​ 고래  ")).toBe("존버 하는 고래");
    expect(Array.from(cleanNick("가".repeat(30))).length).toBe(12);
    expect(cleanNick(3)).toBe("");
  });

  it("욕설은 가리고 링크·연락처는 받지 않는다", () => {
    expect(mask("아 시발 물렸다")).toBe("아 ** 물렸다");
    expect(checkText("내일 갭상승 가즈아")).toEqual({ ok: true, text: "내일 갭상승 가즈아" });
    expect(checkText("리딩방 https://a.b").ok).toBe(false);
    expect(checkText("www.spam 들어와").ok).toBe(false);
    expect(checkText("좋은정보 abc.com").ok).toBe(false);
    expect(checkText("문의 010-1234-5678").ok).toBe(false);
    expect(checkText("   ").ok).toBe(false);
    expect(checkText("코스피 2.5% 하락, 850.25 예상").ok).toBe(true);
  });

  it("도배 제한: 간격과 1분 개수", () => {
    expect(rateLimit([], 10_000)).toBeNull();
    expect(rateLimit([10_000], 10_000 + GAP_MS - 1)).not.toBeNull();
    expect(rateLimit([10_000], 10_000 + GAP_MS)).toBeNull();
    const full = Array.from({ length: PER_MIN }, (_, k) => 100_000 + k * 3000);
    expect(rateLimit(full, 100_000 + PER_MIN * 3000)).not.toBeNull();
    expect(rateLimit(full, 100_000 + 61_000 + PER_MIN * 3000)).toBeNull();
  });

  it("답글 미리보기는 40자", () => {
    expect(quote("짧은 글")).toBe("짧은 글");
    expect(quote("가".repeat(50))).toBe(`${"가".repeat(40)}…`);
  });
});
