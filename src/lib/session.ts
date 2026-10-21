/**
 * 시각에 따라 첫 화면에 먼저 보일 시장을 고른다(KST).
 *  - 미국 정규장(뉴욕 09:30~16:00, 평일)이 열려 있으면 미장
 *  - 그 밖에 08:00~18:00은 국장
 *  - 나머지(18:00 ~ 미국 개장, 미국 마감 ~ 08:00)는 야간 코스피
 * 미국 개장은 서머타임이면 KST 22:30, 표준시면 23:30이다. 양국 휴장일은 따로 보지 않는다.
 */

export type Tab = "kr" | "night" | "us";

const KST = 9 * 3600_000;
const MIN = 60_000;
const DAY = 86_400_000;

const NY = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

/** 뉴욕 현지 날짜·시각·요일 */
export function nyParts(ms: number) {
  const p = Object.fromEntries(NY.formatToParts(ms).map((x) => [x.type, x.value]));
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    min: Number(p.hour) * 60 + Number(p.minute),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
  };
}

/** 뉴욕 현지 y-m-d hh:mm 의 UTC ms (EDT·EST 중 맞는 쪽) */
export function nyTime(y: number, m: number, d: number, min: number) {
  for (const off of [4, 5]) {
    const t = Date.UTC(y, m - 1, d, off, 0) + min * MIN;
    const p = nyParts(t);
    if (p.d === d && p.min === min) return t;
  }
  return Date.UTC(y, m - 1, d, 5, 0) + min * MIN;
}

const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;

export type UsSession = {
  /** 직전 거래일 16:00 (등락 기준) */
  prevClose: number;
  /** 정규장 09:30 */
  open: number;
  /** 정규장 16:00 */
  close: number;
  /** 지금 정규장 중인가 */
  live: boolean;
};

/** 지금 보여 줄 미국 정규장: 열려 있으면 오늘, 아니면 가장 최근에 열린 장 */
export function usSession(now: number): UsSession {
  for (let back = 0; back < 10; back++) {
    const p = nyParts(now - back * DAY);
    if (p.weekday === 0 || p.weekday === 6) continue;
    const open = nyTime(p.y, p.m, p.d, OPEN);
    if (open > now) continue;
    const close = nyTime(p.y, p.m, p.d, CLOSE);
    let prev = 0;
    for (let k = 1; k < 10; k++) {
      const q = nyParts(open - k * DAY);
      if (q.weekday === 0 || q.weekday === 6) continue;
      prev = nyTime(q.y, q.m, q.d, CLOSE);
      break;
    }
    return { prevClose: prev, open, close, live: now < close };
  }
  throw new Error("미국 정규장을 찾지 못했다");
}

export function frontTab(now: number): Tab {
  if (usSession(now).live) return "us";
  const kstMin = Math.floor(((now + KST) % DAY) / MIN);
  return kstMin >= 8 * 60 && kstMin < 18 * 60 ? "kr" : "night";
}

export const TAB_NAME: Record<Tab, string> = { kr: "국장", night: "대시보드", us: "미장" };

/** 요청 시각의 첫 화면(서버에서 그릴 때 쓴다) */
export function frontNow() {
  const now = Date.now();
  return { now, tab: frontTab(now) };
}
