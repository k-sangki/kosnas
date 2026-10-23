/**
 * 첫 화면 익명 실시간 채팅에서 서버(Durable Object)와 화면이 같이 쓰는 규칙.
 * 메시지는 24시간 또는 최근 300개까지만 두고, 링크는 받지 않고, 욕설은 가린다.
 */

export const MAX_TEXT = 200;
export const MAX_NICK = 12;
export const KEEP_MS = 24 * 3600_000;
export const KEEP_COUNT = 300;
/** 처음 접속할 때 보내는 최근 메시지 수 */
export const HISTORY = 100;
/** 같은 사람(IP)이 다음 메시지를 보내기까지 기다리는 시간과 1분에 보낼 수 있는 수 */
export const GAP_MS = 2500;
export const PER_MIN = 12;
/** 서로 다른 사람의 신고가 이만큼 모이면 숨긴다 */
export const HIDE_REPORTS = 3;

export type ChatMsg = {
  id: number;
  at: number;
  nick: string;
  /** 같은 날 같은 IP면 같은 짧은 꼬리표(닉네임 사칭을 가리는 용도, IP는 저장하지 않는다) */
  tag: string;
  text: string;
  reply?: { id: number; nick: string; text: string };
};

/** 서버 → 화면 */
export type ServerEvent =
  | { type: "init"; messages: ChatMsg[]; online: number; tag: string }
  | { type: "msg"; message: ChatMsg }
  | { type: "hide"; id: number }
  | { type: "online"; online: number }
  | { type: "error"; text: string };

/** 화면 → 서버 */
export type ClientEvent =
  | { type: "send"; nick: string; text: string; replyTo?: number }
  | { type: "report"; id: number }
  /** 운영자: 글 하나 지우기 / 그 글을 쓴 사람(그날 꼬리표)을 24시간 막고 그날 글을 모두 지우기 */
  | { type: "admin"; key: string; action: "delete" | "ban"; id: number };

const FIRST = [
  "물린",
  "존버하는",
  "익절 못한",
  "손절 장인",
  "새벽 4시의",
  "단타 치는",
  "풀매수한",
  "현금 0원",
  "고점에 산",
  "멘탈 나간",
  "라면 먹는",
  "출근 전",
  "퇴근 후",
  "눈치 보는",
  "평단 높은",
  "희망 회로",
  "물타기한",
  "불타기한",
  "차트만 보는",
  "뇌동매매",
  "인버스 탄",
  "졸린",
  "반대매매 직전",
  "야간선물 보는",
  "소수점 산",
];
const SECOND = [
  "개미",
  "고래",
  "다람쥐",
  "너구리",
  "펭귄",
  "햄스터",
  "곰",
  "황소",
  "거북이",
  "수달",
  "미어캣",
  "부엉이",
  "카피바라",
  "고등어",
  "멸치",
  "오징어",
  "감자",
  "만두",
  "호떡",
  "붕어빵",
];

/** B급 닉네임 하나. r은 0~1 난수 두 개(시험용으로 넣을 수 있다) */
export function randomNick(r1 = Math.random(), r2 = Math.random()) {
  return `${FIRST[Math.floor(r1 * FIRST.length) % FIRST.length]} ${SECOND[Math.floor(r2 * SECOND.length) % SECOND.length]}`;
}

/** 글자 앞뒤 공백·줄바꿈·제어 문자를 정리한다 */
function clean(s: string, max: number) {
  return Array.from(
    s
      .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .slice(0, max)
    .join("");
}

export function cleanNick(s: unknown) {
  return typeof s === "string" ? clean(s, MAX_NICK) : "";
}

/** 링크·도메인·전화번호(광고)로 보이는 것 */
const LINK = /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|kr|io|me|ly|gg|xyz|co|org|link|site|top|shop|app)\b|t\.me|open\.kakao|카톡\s*아이디|텔레\s*그램|0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4})/i;

/** 가릴 말(앞에 있는 것이 먼저 걸린다). 글자 사이 공백·기호로 피해 가는 것까지는 막지 않는다 */
const BAD = [
  "씨발",
  "시발",
  "씨바",
  "시바",
  "ㅆㅂ",
  "ㅅㅂ",
  "ㅄ",
  "병신",
  "븅신",
  "ㅂㅅ",
  "개새끼",
  "개새",
  "새끼",
  "좆",
  "좇",
  "니미",
  "니애미",
  "느금",
  "엠창",
  "지랄",
  "ㅈㄹ",
  "미친놈",
  "미친년",
  "썅",
  "fuck",
  "shit",
];
const BAD_RE = new RegExp(BAD.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
const BAD_ONE = new RegExp(BAD_RE.source, "i");

export function mask(s: string) {
  return s.replace(BAD_RE, (w) => "*".repeat(Array.from(w).length));
}

/**
 * 기호·숫자를 끼우거나('씨.발', '시1발') 한 글자씩 띄어 쓴('시 발') 욕설. 낱말 사이 띄어쓰기는 붙이지 않는다
 * ('공시 발표'를 '공시발표'로 붙이면 걸리기 때문). 그대로 가려지는 욕설은 먼저 뺀다.
 */
export function evades(text: string) {
  const words = text
    .replace(BAD_RE, "")
    .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z\s]/gi, "")
    .split(/\s+/)
    .filter(Boolean);
  const runs: string[] = [];
  let run = "";
  for (const w of words) {
    if (Array.from(w).length === 1) run += w;
    else {
      if (run) runs.push(run);
      run = "";
    }
  }
  if (run) runs.push(run);
  return [...words, ...runs].some((w) => BAD_ONE.test(w));
}

/** 보낼 메시지를 검사한다. 통과하면 가린 글, 아니면 이유 */
export function checkText(s: unknown): { ok: true; text: string } | { ok: false; why: string } {
  const text = typeof s === "string" ? clean(s, MAX_TEXT) : "";
  if (!text) return { ok: false, why: "내용을 입력해 주세요." };
  if (LINK.test(text)) return { ok: false, why: "링크·연락처는 올릴 수 없어요." };
  // '시 발', '씨.발'처럼 사이에 공백·기호·숫자를 끼워 피해 가는 욕설은 가리지 않고 받지 않는다
  if (evades(text)) return { ok: false, why: "욕설은 쓸 수 없어요." };
  return { ok: true, text: mask(text) };
}

/** 최근 보낸 시각들로 지금 보내도 되는지. 되면 null, 아니면 이유 */
export function rateLimit(times: number[], now: number) {
  const last = times[times.length - 1];
  if (last != null && now - last < GAP_MS) return "조금 천천히 보내 주세요.";
  if (times.filter((t) => now - t < 60_000).length >= PER_MIN) return "1분에 보낼 수 있는 메시지를 다 썼어요. 잠시 뒤에 보내 주세요.";
  return null;
}

/** 답글에 붙이는 원문 미리보기 */
export function quote(text: string, n = 40) {
  const a = Array.from(text);
  return a.length > n ? `${a.slice(0, n).join("")}…` : text;
}
