/**
 * 주요일정: 국장(배당 막차·무상증자 권리락·공모주 청약·옵션 만기·휴장)과 미장(FOMC·물가·실적·휴장·옵션 만기).
 *
 * 국장 회사 일정은 collector/schedule.py가 DART 공시에서 뽑은 src/data/schedule-kr.json이고,
 * 정해진 날짜(제도·거시 일정)는 아래 표에 직접 적는다. 표의 날짜는 공식 발표로 확인한 것만 넣는다.
 * 날짜는 모두 한국 시각 기준 YYYY-MM-DD다.
 */
import krData from "@/data/schedule-kr.json";
import usData from "@/data/schedule-us.json";
import { HOLIDAYS } from "./poll";

export type Market = "kr" | "us";

/** 위쪽 거르기 단추의 묶음 */
export type Cat =
  | "ipo"
  | "dividend"
  | "bonus"
  | "earnings"
  | "macro"
  | "expiry"
  | "market"
  | "tax";

export const CATS: Record<Market, { id: Cat; label: string }[]> = {
  kr: [
    { id: "ipo", label: "🆕 공모주 청약" },
    { id: "dividend", label: "💰 배당" },
    { id: "bonus", label: "🎁 무상증자" },
    { id: "macro", label: "🏦 금리·지표" },
    { id: "expiry", label: "🎯 옵션 만기" },
    { id: "market", label: "🏖️ 휴장·장 시간" },
    { id: "tax", label: "🧾 세금·연말" },
  ],
  us: [
    { id: "earnings", label: "💼 실적 발표" },
    { id: "macro", label: "📊 지표·금리" },
    { id: "expiry", label: "🎯 옵션 만기" },
    { id: "market", label: "🏖️ 휴장" },
  ],
};

export interface Item {
  cat: Cat;
  date: string;
  emoji: string;
  title: string;
  detail: string;
  /** 같은 날 안에서 먼저 보일 순서(작을수록 위) */
  rank: number;
  href?: string;
}

type KrEvent =
  | {
      type: "dividend";
      code: string;
      name: string;
      rcept: string;
      record: string;
      perShare: number;
      yield: number | null;
      kind: string;
    }
  | {
      type: "bonus";
      code: string;
      name: string;
      rcept: string;
      record: string;
      ratio: number | null;
      listing: string | null;
    }
  | {
      type: "ipo";
      name: string;
      rcept: string;
      start: string;
      end: string;
      price: number | null;
      brokers: string[];
      spac: boolean;
    };

const DAY = 86_400_000;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromMs(toMs(d) + n * DAY);
export const weekday = (d: string) => new Date(toMs(d)).getUTCDay();
export const md = (d: string) =>
  `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
export const mdw = (d: string) => `${md(d)}(${WEEKDAY[weekday(d)]})`;

export function isKrTradingDay(d: string) {
  const w = weekday(d);
  return w >= 1 && w <= 5 && !HOLIDAYS.has(d);
}

/** d 이하 마지막 거래일에서 n거래일 앞 */
export function tradingDaysBefore(d: string, n: number) {
  let x = d;
  while (!isKrTradingDay(x)) x = addDays(x, -1);
  for (let i = 0; i < n; i++) {
    x = addDays(x, -1);
    while (!isKrTradingDay(x)) x = addDays(x, -1);
  }
  return x;
}

/** 오늘(한국 시각) */
export function kstToday(now = Date.now()) {
  return fromMs(now + 9 * 3600_000);
}

/** 그 주 월요일 */
export function monday(d: string) {
  return addDays(d, -((weekday(d) + 6) % 7));
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const dartUrl = (rcept: string) =>
  `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcept}`;

function krCompany(): Item[] {
  const out: Item[] = [];
  for (const e of (krData as { events: KrEvent[] }).events) {
    if (e.type === "dividend") {
      // 기준일에 주주명부에 있으려면 2거래일 전까지 사야 한다(T+2 결제). 다음 거래일이 배당락
      const last = tradingDaysBefore(e.record, 2);
      out.push({
        date: last,
        cat: "dividend",
        emoji: "💰",
        title: `배당 막차 · ${e.name}`,
        detail: `1주당 ${won(e.perShare)}${e.yield ? ` · 시가배당률 ${e.yield}%` : ""} · 기준일 ${md(e.record)}`,
        // 같은 날에는 시가배당률 높은 순
        rank: 2 + (1 - Math.min(e.yield ?? 0, 20) / 20) * 0.9,
        href: dartUrl(e.rcept),
      });
    } else if (e.type === "bonus") {
      const last = tradingDaysBefore(e.record, 2);
      out.push({
        date: last,
        cat: "bonus",
        emoji: "🎁",
        title: `무상증자 막차 · ${e.name}`,
        detail: `${e.ratio ? `1주당 ${e.ratio}주 · ` : ""}다음 거래일 권리락${e.listing ? ` · 새 주식 상장 ${md(e.listing)}` : ""}`,
        rank: 3,
        href: dartUrl(e.rcept),
      });
    } else if (e.type === "ipo") {
      out.push({
        date: e.start,
        cat: "ipo",
        emoji: e.spac ? "📦" : "🆕",
        title: `${e.spac ? "스팩 청약" : "공모주 청약"} · ${e.name}`,
        detail: [
          `${md(e.start)}~${md(e.end)}`,
          e.price ? `공모가 ${won(e.price)}` : "",
          e.brokers.length ? e.brokers.join("·") : "",
        ]
          .filter(Boolean)
          .join(" · "),
        rank: e.spac ? 5 : 1,
        href: dartUrl(e.rcept),
      });
    }
  }
  return out;
}

/** 국장 정해진 일정(거래소·국세 공지로 확인한 것만) */
const KR_FIXED: Item[] = [
  {
    date: "2026-11-12",
    cat: "macro",
    emoji: "🌐",
    title: "MSCI 11월 정기 변경 발표",
    detail:
      "아침 7:00쯤 · 한국 종목 편입·편출 명단 · 실제 반영은 11/30 장 마감",
    rank: 0.6,
  },
  {
    date: "2026-11-26",
    cat: "macro",
    emoji: "🏦",
    title: "한국은행 기준금리 결정(금통위)",
    detail: "오전 결정 발표 · 총재 기자간담회 · 올해 마지막 금리 결정",
    rank: 0.2,
  },
  {
    date: "2026-11-30",
    cat: "macro",
    emoji: "🌐",
    title: "MSCI 지수 변경 반영일",
    detail: "장 마감 동시호가에 편입·편출 종목 거래가 몰림",
    rank: 0.6,
  },
  {
    date: "2026-12-01",
    cat: "macro",
    emoji: "🚢",
    title: "11월 수출입동향",
    detail: "오전 9:00 산업통상자원부 발표 · 반도체 수출이 핵심",
    rank: 0.6,
  },
  {
    date: "2026-11-19",
    cat: "market",
    emoji: "⏰",
    title: "수능일 · 1시간 늦게 개장",
    detail: "정규장 10:00~16:30 · 프리마켓 없음",
    rank: 0,
  },
  {
    date: "2026-12-28",
    cat: "tax",
    emoji: "🧾",
    title: "올해 결제되는 마지막 매도일",
    detail:
      "오늘 판 주식까지 12/30에 결제돼 올해 손익·대주주 판정(12/31 보유 기준)에 반영",
    rank: 1,
  },
  {
    date: "2026-12-30",
    cat: "market",
    emoji: "🔔",
    title: "올해 마지막 거래일(폐장)",
    detail: "12/31은 휴장",
    rank: 0,
  },
  {
    date: "2026-12-31",
    cat: "tax",
    emoji: "🧾",
    title: "연금저축·IRP 세액공제 납입 마감",
    detail: "올해 연말정산 공제는 오늘 납입분까지",
    rank: 1,
  },
];

/** 매달 둘째 목요일 = 국내 옵션 만기(3·6·9·12월은 선물·옵션 동시 만기) */
function krExpiries(from: string, to: string): Item[] {
  const out: Item[] = [];
  for (let m = toMs(`${from.slice(0, 7)}-01`); fromMs(m) <= to; ) {
    const first = fromMs(m);
    const d0 = (4 - weekday(first) + 7) % 7;
    let d = addDays(first, d0 + 7);
    while (!isKrTradingDay(d)) d = addDays(d, -1);
    const quarter = [3, 6, 9, 12].includes(Number(first.slice(5, 7)));
    out.push({
      date: d,
      cat: "expiry",
      emoji: "🎯",
      title: quarter ? "선물·옵션 동시 만기일" : "옵션 만기일",
      detail: quarter
        ? "장 막판 변동이 커질 수 있는 날(코스피200 선물·옵션 함께 만기)"
        : "장 막판 변동이 커질 수 있는 날",
      rank: 0.5,
    });
    const nx = new Date(m);
    nx.setUTCMonth(nx.getUTCMonth() + 1);
    m = nx.getTime();
  }
  return out;
}

function krHolidays(): Item[] {
  return [...HOLIDAYS]
    .filter((d) => weekday(d) >= 1 && weekday(d) <= 5)
    .map((d) => ({
      date: d,
      cat: "market",
      emoji: "🏖️",
      title: "국장 휴장",
      detail: "주식·파생 시장 모두 쉼",
      rank: 0,
    }));
}

/**
 * 미장 일정. 시각은 한국 시각으로 적고, 밤 늦게 나오면 다음 날 새벽 날짜에 둔다.
 * 확인: FOMC(연준 2026 일정), CPI·고용(BLS 발표 일정), 엔비디아(회사 발표 2026-10).
 */
const US_FIXED: Item[] = [
  {
    date: "2026-11-14",
    cat: "macro",
    emoji: "🏭",
    title: "미국 10월 생산자물가(PPI)",
    detail:
      "11/13(금) 한국 시각 밤 10:30 발표 · 소비자물가보다 먼저 움직이는 도매 물가",
    rank: 1,
  },
  {
    date: "2026-11-17",
    cat: "macro",
    emoji: "🛒",
    title: "미국 10월 소매판매(근원 소매판매 포함)",
    detail: "한국 시각 밤 10:30 발표 · 미국 소비가 얼마나 버티는지",
    rank: 1,
  },
  {
    date: "2026-11-19",
    cat: "macro",
    emoji: "📝",
    title: "FOMC 의사록(10월 회의)",
    detail: "한국 시각 새벽 4:00 공개 · 위원들이 금리를 두고 나눈 이야기",
    rank: 1,
  },
  {
    date: "2026-11-25",
    cat: "macro",
    emoji: "💵",
    title: "미국 10월 PCE 물가·3분기 GDP(2차)",
    detail: "한국 시각 밤 10:30 발표 · 연준이 가장 중시하는 물가 지표",
    rank: 1,
  },
  {
    date: "2026-12-15",
    cat: "macro",
    emoji: "🏭",
    title: "미국 11월 생산자물가(PPI)",
    detail: "한국 시각 밤 10:30 발표",
    rank: 1,
  },
  {
    date: "2026-12-16",
    cat: "macro",
    emoji: "🛒",
    title: "미국 11월 소매판매(근원 소매판매 포함)",
    detail: "한국 시각 밤 10:30 발표",
    rank: 1,
  },
  {
    date: "2026-11-10",
    cat: "macro",
    emoji: "📊",
    title: "미국 10월 소비자물가(CPI)",
    detail: "한국 시각 밤 10:30 발표 · 금리 기대를 바꾸는 물가 지표",
    rank: 1,
  },
  {
    date: "2026-11-26",
    cat: "market",
    emoji: "🦃",
    title: "미장 휴장 · 추수감사절",
    detail: "다음 날(11/27)은 새벽 3:00 조기 폐장",
    rank: 0,
  },
  {
    date: "2026-11-28",
    cat: "market",
    emoji: "⏱️",
    title: "미장 조기 폐장(블랙프라이데이)",
    detail: "한국 시각 새벽 3:00 마감",
    rank: 0,
  },
  {
    date: "2026-12-04",
    cat: "macro",
    emoji: "👷",
    title: "미국 11월 고용보고서",
    detail: "한국 시각 밤 10:30 발표 · 일자리·실업률",
    rank: 1,
  },
  {
    date: "2026-12-10",
    cat: "macro",
    emoji: "🏦",
    title: "FOMC 금리 결정",
    detail: "한국 시각 새벽 4:00 발표 · 의장 기자회견 4:30 · 점도표 함께",
    rank: 0,
  },
  {
    date: "2026-12-10",
    cat: "macro",
    emoji: "📊",
    title: "미국 11월 소비자물가(CPI)",
    detail: "한국 시각 밤 10:30 발표",
    rank: 1,
  },
  {
    date: "2026-12-25",
    cat: "market",
    emoji: "🎄",
    title: "미장 휴장 · 크리스마스",
    detail: "",
    rank: 0,
  },
  {
    date: "2027-01-01",
    cat: "market",
    emoji: "🎍",
    title: "미장 휴장 · 새해 첫날",
    detail: "",
    rank: 0,
  },
  {
    date: "2027-01-13",
    cat: "macro",
    emoji: "📊",
    title: "미국 12월 소비자물가(CPI)",
    detail: "한국 시각 밤 10:30 발표",
    rank: 1,
  },
];

type UsEarning = {
  symbol: string;
  name: string;
  date: string;
  when: "pre" | "after" | "";
  capB: number | null;
};

/** 미장 실적 발표(나스닥 달력, 미국 날짜). 장 마감 뒤 발표는 한국 날짜로 다음 날 아침이다 */
function usEarnings(): Item[] {
  return (usData as { events: UsEarning[] }).events.map((e) => {
    const after = e.when === "after";
    return {
      date: after ? addDays(e.date, 1) : e.date,
      cat: "earnings" as const,
      emoji: "💼",
      title: `${e.name === e.symbol ? e.name : `${e.name}(${e.symbol})`} 실적 발표`,
      detail: after
        ? "한국 시각 아침(미장 마감 뒤 발표)"
        : e.when === "pre"
          ? "한국 시각 밤(미장 개장 전 발표)"
          : "발표 시각 미정",
      // 같은 날에는 시가총액 큰 순
      rank: 1 + (1 - Math.min(e.capB ?? 0, 4000) / 4000) * 0.9,
    };
  });
}

/** 매달 셋째 금요일 = 미국 월간 옵션 만기(3·6·9·12월은 지수 선물·옵션 동시 만기) */
function usExpiries(from: string, to: string): Item[] {
  const out: Item[] = [];
  for (let m = toMs(`${from.slice(0, 7)}-01`); fromMs(m) <= to; ) {
    const first = fromMs(m);
    const d = addDays(first, ((5 - weekday(first) + 7) % 7) + 14);
    const quarter = [3, 6, 9, 12].includes(Number(first.slice(5, 7)));
    out.push({
      date: d,
      cat: "expiry",
      emoji: "🎯",
      title: quarter
        ? "미국 쿼드러플 위칭(선물·옵션 동시 만기)"
        : "미국 월간 옵션 만기",
      detail: "장 막판 거래량이 크게 늘 수 있는 날",
      rank: 0.5,
    });
    const nx = new Date(m);
    nx.setUTCMonth(nx.getUTCMonth() + 1);
    m = nx.getTime();
  }
  return out;
}

export interface Week {
  label: string;
  from: string;
  to: string;
  days: { date: string; items: Item[] }[];
  count: number;
}

export function itemsFor(market: Market, from: string, to: string): Item[] {
  const all =
    market === "kr"
      ? [...krCompany(), ...KR_FIXED, ...krExpiries(from, to), ...krHolidays()]
      : [...US_FIXED, ...usEarnings(), ...usExpiries(from, to)];
  return all
    .filter((x) => x.date >= from && x.date <= to)
    .sort((a, b) =>
      a.date === b.date ? a.rank - b.rank : a.date < b.date ? -1 : 1,
    );
}

/** 이번 주·다음 주(월~일) */
export function weeks(market: Market, today: string, only?: Set<Cat>): Week[] {
  const m0 = monday(today);
  return [
    { label: "이번 주", from: m0, to: addDays(m0, 6) },
    { label: "다음 주", from: addDays(m0, 7), to: addDays(m0, 13) },
  ].map((w) => {
    const items = itemsFor(market, w.from, w.to).filter(
      (x) => !only || only.has(x.cat),
    );
    const days: Week["days"] = [];
    for (const it of items) {
      const last = days[days.length - 1];
      if (last?.date === it.date) last.items.push(it);
      else days.push({ date: it.date, items: [it] });
    }
    return { ...w, days, count: items.length };
  });
}

/** 띠에 보일 한 줄: 오늘부터 이번 주 끝까지(nextWeek면 다음 주 끝까지) 가장 가까운 일정 */
export function nextUp(today: string, nextWeek = false) {
  const to = addDays(monday(today), nextWeek ? 13 : 6);
  const kr = itemsFor("kr", today, to);
  const us = itemsFor("us", today, to);
  const all = [...kr, ...us].sort((a, b) =>
    a.date === b.date ? a.rank - b.rank : a.date < b.date ? -1 : 1,
  );
  return { first: all[0] ?? null, count: all.length };
}

export const krUpdated = (krData as { updated: string }).updated;
