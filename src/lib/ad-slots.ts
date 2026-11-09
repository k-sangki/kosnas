/**
 * 광고 자리 이름. 대시보드·시세 화면은 board, 섹터·산업·가이드 같은 글 화면은 sector.
 * AdSlot.tsx("use client")에 두면 서버 컴포넌트에서 값이 undefined로 넘어가 따로 둔다.
 */
export type AdPlace = "board" | "sector";
export const AD_SLOTS = { board: "board", sector: "sector" } as const satisfies Record<AdPlace, AdPlace>;
