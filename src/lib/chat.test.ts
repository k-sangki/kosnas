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

describe("피해 가는 욕설", () => {
  it("기호·숫자·한 글자 띄어쓰기는 막는다", () => {
    expect(checkText("씨.발 진짜").ok).toBe(false);
    expect(checkText("시1발").ok).toBe(false);
    expect(checkText("아 시 발 물렸네").ok).toBe(false);
    expect(checkText("병 신 같은 장").ok).toBe(false);
  });
  it("낱말 사이 띄어쓰기는 붙이지 않는다", () => {
    expect(checkText("오늘 공시 발표 나왔나요").ok).toBe(true);
    expect(checkText("개 새로운 소식").ok).toBe(true);
    expect(checkText("니 미래가 밝다").ok).toBe(true);
    expect(checkText("아 시발 물렸네")).toEqual({ ok: true, text: "아 ** 물렸네" });
  });
});
