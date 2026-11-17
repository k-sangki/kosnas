/**
 * 첫 화면 '오늘의 한 줄' 담벼락에서 서버(Durable Object)와 화면이 같이 쓰는 규칙.
 * 가입 없이 60자 한 줄, 매일 아침 8시(KST)에 비우고, 최근 30개만 보인다. 글마다 👍👎와 신고.
 * 링크·연락처·욕설은 채팅 규칙(./chat)을 그대로 쓰고, 리딩방 홍보 말을 더 막는다.
 */
import { checkText } from "./chat";

export const WALL_MAX = 60;
export const WALL_SHOW = 30;
/** 하루가 바뀌는 시각(KST 시). 이 시각에 담벼락을 비운다 */
export const RESET_HOUR = 8;
/** 같은 사람(그날 꼬리표)이 다음 글을 쓰기까지 기다리는 시간과 하루에 쓸 수 있는 수 */
export const WALL_GAP_MS = 30_000;
export const WALL_PER_DAY = 10;
/** 서로 다른 사람의 신고가 이만큼 모이면 숨긴다 */
export const WALL_HIDE_REPORTS = 3;

export type Thumb = 1 | -1 | 0;

export type WallPost = {
  id: number;
  at: number;
  /** 같은 날 같은 IP면 같은 짧은 꼬리표(IP는 저장하지 않는다) */
  tag: string;
  text: string;
  up: number;
  down: number;
  /** 이 브라우저가 누른 쪽 */
  mine: Thumb;
};

export type WallState = {
  /** 담벼락 날짜(아침 8시 기준 KST 날짜) */
  day: string;
  /** 오늘 남은(숨기지 않은) 글 수 */
  total: number;
  posts: WallPost[];
  /** 내 꼬리표(내 글에는 신고 버튼을 숨긴다) */
  tag: string;
};

/** 화면 → 서버(POST /api/wall) */
export type WallAction =
  | { type: "post"; text: string; voter: string; key?: string }
  | { type: "thumb"; id: number; voter: string; v: Thumb }
  | { type: "report"; id: number; voter: string }
  | { type: "admin"; id: number; key: string; action: "delete" | "ban" };

/** 아침 8시(KST)에 바뀌는 담벼락 날짜 'YYYY-MM-DD' */
export function wallDay(now: number) {
  return new Date(now + (9 - RESET_HOUR) * 3600_000).toISOString().slice(0, 10);
}

/** 브라우저 투표자 번호(투표함과 같은 모양: UUID) */
export function isVoterId(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
}

export function isThumb(v: unknown): v is Thumb {
  return v === 1 || v === -1 || v === 0;
}

/**
 * 링크 없이 하는 리딩방·종목 추천 홍보. 띄어쓰기를 지운 글에서 찾는다.
 * ('추천' 하나만으로는 막지 않는다: "추천 받은 종목 다 물림" 같은 글은 받는다)
 */
const PROMO = [
  "리딩방",
  "리딩해",
  "무료리딩",
  "무료추천",
  "종목추천해",
  "추천종목",
  "종목상담",
  "수익보장",
  "원금보장",
  "수익률보장",
  "적중률",
  "급등주추천",
  "세력주",
  "작전주",
  "단톡방",
  "오픈채팅",
  "오픈톡",
  "카톡방",
  "텔레방",
  "밴드가입",
  "입장하세요",
  "들어오세요",
  "문의주세요",
  "연락주세요",
  "쪽지주세요",
  "프로필참고",
  "프로필확인",
  "vip",
  "회원모집",
];

export function isPromo(text: string) {
  const flat = text.replace(/[\s.,·~!?*_\-]/g, "").toLowerCase();
  return PROMO.some((w) => flat.includes(w));
}

/** 담벼락 글 검사. 통과하면 가린 글, 아니면 이유 */
export function checkWallText(s: unknown): { ok: true; text: string } | { ok: false; why: string } {
  if (typeof s === "string" && Array.from(s.trim()).length > WALL_MAX) return { ok: false, why: `${WALL_MAX}자까지 쓸 수 있어요.` };
  const c = checkText(s);
  if (!c.ok) return c;
  if (isPromo(c.text)) return { ok: false, why: "종목 추천·단톡방 홍보는 올릴 수 없어요." };
  return c;
}

/** 오늘 쓴 시각들로 지금 써도 되는지. 되면 null, 아니면 이유 */
export function wallLimit(times: number[], now: number) {
  const last = times.length ? Math.max(...times) : null;
  if (last != null && now - last < WALL_GAP_MS) return "조금 있다가 다시 써 주세요(30초에 한 줄).";
  if (times.length >= WALL_PER_DAY) return `하루에 ${WALL_PER_DAY}줄까지 쓸 수 있어요. 내일 아침 8시에 다시 열려요.`;
  return null;
}
