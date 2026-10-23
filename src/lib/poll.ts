/**
 * 첫 화면 '오늘의 한 표': 다음 장 코스피가 오를지 내릴지 한 번 누르는 투표.
 *
 * 회차는 국내 거래일 D 하나다. 직전 거래일 15:45부터 D 09:00까지 받고, D 15:45에 판정한다.
 * 판정은 코스피200 무기한선물(trade.xyz KR200)의 D 15:45 가격과 직전 거래일 15:45 가격 비교다
 * (코스피 지수 시세는 상업 이용 원천이 없다). 매수·매도 권유가 아니라 참여형 놀이다.
 */

const KST = 9 * 3600_000;
const MIN = 60_000;
const DAY = 86_400_000;

/** 판정을 미룰 여유: 15:45 봉이 원천에 확정될 시간 */
export const SETTLE_DELAY = 5 * MIN;
/** 이보다 작게 움직이면 보합으로 보고 적중을 세지 않는다(%) */
export const FLAT_PCT = 0.02;
/** 같은 IP(그날 해시)에서 한 회차에 받을 표 수 */
export const PER_TAG = 3;

/**
 * 평일 휴장일(KRX). 해마다 거래소 공지로 확인해 덧붙인다.
 * 여기 없는 휴장일이 있으면 그 회차는 판정 가격이 거의 안 움직여 대개 보합으로 끝난다.
 */
export const HOLIDAYS = new Set([
  "2026-12-25",
  "2026-12-31",
  "2027-01-01",
  "2027-02-08",
  "2027-02-09",
  "2027-03-01",
  "2027-05-05",
  "2027-05-13",
  "2027-08-16",
  "2027-09-14",
  "2027-09-15",
  "2027-09-16",
  "2027-10-04",
  "2027-10-11",
  "2027-12-27",
  "2027-12-31",
]);

/** KST 날짜 YYYY-MM-DD */
export function kstDate(ms: number) {
  return new Date(ms + KST).toISOString().slice(0, 10);
}

/** KST 그날 00:00 (UTC ms) */
function midnight(ms: number) {
  return Math.floor((ms + KST) / DAY) * DAY - KST;
}

export function isTradingDay(ms: number) {
  const wd = new Date(ms + KST).getUTCDay();
  return wd >= 1 && wd <= 5 && !HOLIDAYS.has(kstDate(ms));
}

const at = (day: number, h: number, m: number) => day + (h * 60 + m) * MIN;

export type Round = {
  /** 회차 거래일 YYYY-MM-DD */
  target: string;
  /** 비교 기준: 직전 거래일 15:45 */
  start: number;
  /** 투표 마감: D 09:00 */
  closes: number;
  /** 판정 시각: D 15:45 */
  end: number;
};

function roundOf(day: number): Round {
  let prev = day - DAY;
  while (!isTradingDay(prev)) prev -= DAY;
  return { target: kstDate(day), start: at(prev, 15, 45), closes: at(day, 9, 0), end: at(day, 15, 45) };
}

/** 지금의 회차: 판정(15:45)이 아직 오지 않은 가장 가까운 거래일 */
export function currentRound(now: number): Round {
  let day = midnight(now);
  for (let i = 0; i < 30; i++, day += DAY) {
    if (isTradingDay(day) && at(day, 15, 45) > now) return roundOf(day);
  }
  throw new Error("다음 거래일을 찾지 못했다");
}

/** YYYY-MM-DD 회차의 시각들 */
export function roundFor(target: string): Round {
  return roundOf(Date.parse(`${target}T00:00:00+09:00`));
}

export type Side = "up" | "down";

/** 등락률(%)로 결과 방향. 보합이면 null */
export function outcome(pct: number | null): Side | null {
  if (pct == null || Math.abs(pct) < FLAT_PCT) return null;
  return pct > 0 ? "up" : "down";
}

/** 다수 쪽. 같으면 null */
export function majority(up: number, down: number): Side | null {
  return up === down ? null : up > down ? "up" : "down";
}

/** 15:45에 끝난 봉의 종가: 시작 시각이 기준 15분 전 이하인 봉 중 마지막 */
export function closeAt(candles: { t: number; c: number }[], when: number, span = 15 * MIN) {
  let hit: number | null = null;
  for (const k of [...candles].sort((a, b) => a.t - b.t)) {
    if (k.t <= when - span) hit = k.c;
    else break;
  }
  return hit;
}

export type PastRound = { target: string; up: number; down: number; pct: number | null };

export type PollState = {
  round: { target: string; open: boolean; closes: number; end: number; up: number; down: number; mine: Side | null };
  /** 판정이 끝난 회차, 최근 것부터 */
  past: PastRound[];
};

/** 다수 적중: 보합·동률은 빼고 센다 */
export function hitRate(past: PastRound[]) {
  let n = 0;
  let hit = 0;
  for (const r of past) {
    const o = outcome(r.pct);
    const m = majority(r.up, r.down);
    if (!o || !m) continue;
    n++;
    if (o === m) hit++;
  }
  return { n, hit };
}

export function isSide(v: unknown): v is Side {
  return v === "up" || v === "down";
}

/** 브라우저마다 만드는 익명 투표자 번호 형식 */
export function isVoter(v: unknown): v is string {
  return typeof v === "string" && /^[a-z0-9-]{8,64}$/.test(v);
}
