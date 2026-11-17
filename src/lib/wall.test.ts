import { describe, expect, it } from "vitest";
import { WALL_GAP_MS, WALL_MAX, WALL_PER_DAY, checkWallText, isPromo, isThumb, isVoterId, wallDay, wallLimit } from "./wall";

describe("오늘의 한 줄 규칙", () => {
  it("담벼락 날짜는 아침 8시(KST)에 바뀐다", () => {
    // 2026-11-17 07:59 KST = 2026-11-16 22:59 UTC
    expect(wallDay(Date.UTC(2026, 10, 16, 22, 59))).toBe("2026-11-16");
    // 2026-11-17 08:00 KST
    expect(wallDay(Date.UTC(2026, 10, 16, 23, 0))).toBe("2026-11-17");
    // 2026-11-17 23:30 KST
    expect(wallDay(Date.UTC(2026, 10, 17, 14, 30))).toBe("2026-11-17");
  });

  it("60자까지, 링크·연락처·욕설은 채팅 규칙대로", () => {
    expect(checkWallText("오늘 반도체만 혼자 버티네요")).toEqual({ ok: true, text: "오늘 반도체만 혼자 버티네요" });
    expect(checkWallText("가".repeat(WALL_MAX)).ok).toBe(true);
    expect(checkWallText("가".repeat(WALL_MAX + 1)).ok).toBe(false);
    expect(checkWallText("좋은정보 abc.com").ok).toBe(false);
    expect(checkWallText("문의 010-1234-5678").ok).toBe(false);
    expect(checkWallText("아 시발 물렸다")).toEqual({ ok: true, text: "아 ** 물렸다" });
    expect(checkWallText("  ").ok).toBe(false);
  });

  it("링크 없는 리딩방·추천 홍보를 막는다", () => {
    expect(isPromo("무료 추천 받고 싶으면 프로필 참고")).toBe(true);
    expect(isPromo("리 딩 방 들어오세요")).toBe(true);
    expect(isPromo("수익 보장 VIP 회원 모집")).toBe(true);
    expect(isPromo("오픈채팅으로 오세요")).toBe(true);
    expect(checkWallText("내일 급등주 추천 드림 쪽지 주세요").ok).toBe(false);
    // 일상 글은 통과
    expect(isPromo("추천 받은 종목 다 물림 ㅠ")).toBe(false);
    expect(isPromo("FOMC 주간이라 거래량이 확실히 적네요")).toBe(false);
  });

  it("30초 간격, 하루 10줄", () => {
    expect(wallLimit([], 1_000_000)).toBeNull();
    expect(wallLimit([1_000_000], 1_000_000 + WALL_GAP_MS - 1)).not.toBeNull();
    expect(wallLimit([1_000_000], 1_000_000 + WALL_GAP_MS)).toBeNull();
    const day = Array.from({ length: WALL_PER_DAY }, (_, k) => k * 3600_000);
    expect(wallLimit(day, 99 * 3600_000)).not.toBeNull();
  });

  it("투표자 번호와 엄지 값", () => {
    expect(isVoterId("3f2b1c9e-8a7d-4e6f-9b1a-2c3d4e5f6a7b")).toBe(true);
    expect(isVoterId("x")).toBe(false);
    expect([1, -1, 0].every(isThumb)).toBe(true);
    expect(isThumb(2)).toBe(false);
  });
});
