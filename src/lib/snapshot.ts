/**
 * 실시간 화면의 '불러오는 중…' 자리에 서버가 미리 넣는 최근 값 한 줄(2026-11-25 외부 검색 진단).
 * 검색 로봇·AI 검색·네이버·빙은 자바스크립트로 받아 오는 값을 보지 못해, 제목이 묻는 '지금 얼마?'의 답이 HTML에 없었다.
 * 화면에서는 지금처럼 실시간 값이 이 줄을 덮어쓴다.
 *
 * - 야간·24시간 시세·주말 유가·미국 증시: Worker가 페이지를 내보낼 때 [data-snap] 요소의 글자를 바꾼다(엣지 캐시 1분).
 * - 경제지표·주요 일정: 바탕 자료가 정적 파일이라 빌드할 때 서버 렌더링으로 넣는다(자료가 바뀌면 다시 배포된다).
 * 숫자는 모두 '추정'·'참고' 값이며 기준 시각을 함께 적는다.
 */
import { boardState, hhmm, type NightData } from "./night";
import type { UsData } from "./us";

const KST = 9 * 3600_000;
const sign = (v: number) => (v > 0 ? "+" : "");
const two = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `${sign(v)}${v.toFixed(2)}%`;

/** 한국 시각 'M/D HH:MM' */
export function stamp(ms: number) {
  const d = new Date(ms + KST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hhmm(ms)}`;
}

const tail = (ms: number) => ` · ${stamp(ms)} 기준 · 실시간 값을 불러오는 중…`;

/** 맨 위 코스피200 선물 추정 카드 */
export function nightSnap(d: NightData) {
  const state = boardState(d.window, d.updated);
  const label = state === "weekend" ? "월요일 시작 추정가(코스피200 선물)" : state === "day" ? "코스피200 선물 장중 추정" : "코스피200 야간선물 추정";
  const basis =
    d.baseKind === "close" ? (state === "weekend" ? "금요일 종가 대비" : state === "day" ? "전일 종가 대비" : "주간 종가 대비") : "15:45 추정 대비";
  return `${label} ${two(d.est)} (${pct(d.chgPct)}, ${basis})${tail(d.updated)}`;
}

/** 삼성전자·SK하이닉스 밤사이 원화 환산 추정 */
export function stockSnap(d: NightData, coin: string, name: string) {
  const i = d.inputs.find((x) => x.coin === coin);
  if (!i || i.krw == null) return null;
  const chg = i.chg != null ? ` (${pct(i.chg)}, KRX 종가 대비)` : "";
  return `${name} 야간 추정 ${i.krw.toLocaleString("en-US")}원${chg}${tail(d.updated)}`;
}

/** 24시간 시세 한 종목(/live/*). 등락 기준은 화면(LiveQuoteView)과 같다 */
export function liveSnap(d: NightData, coin: string, name: string, unit: string, basis: string) {
  const x = d.extra?.[coin];
  if (!x) return null;
  const fri = x.fri;
  const base = x.wk?.close ?? fri?.prev ?? x.prev ?? null;
  const shown = fri ? fri.close : x.price;
  const why = x.wk ? "금요일 CME 마감 대비" : fri ? "금요일 미국 마감 · 전 거래일 대비" : x.prevAt ? basis : "24시간 전 대비";
  const chg = base ? ` (${pct((shown / base - 1) * 100)}, ${why})` : "";
  return `${name} ${unit}${two(shown)}${chg}${tail(d.updated)}`;
}

/** 주말·실시간 유가 */
export function oilSnap(d: NightData) {
  const items = [
    ["CL", "WTI 원유"],
    ["BRENTOIL", "브렌트유"],
  ] as const;
  const parts = items.flatMap(([coin, name]) => {
    const x = d.extra?.[coin];
    if (!x) return [];
    const base = x.wk?.close ?? x.prev;
    return [`${name} $${two(x.price)}${base ? ` (${pct((x.price / base - 1) * 100)})` : ""}`];
  });
  if (!parts.length) return null;
  const weekend = items.some(([c]) => d.extra?.[c]?.wk);
  return `${parts.join(" · ")} · ${weekend ? "금요일 뉴욕 마감 대비(주말 추정)" : "전일 CME 정산 대비"}${tail(d.updated)}`;
}

/** 미국 정규장 S&P 500·나스닥 100 등락 */
export function usSnap(u: UsData) {
  if (u.sp == null && u.nd == null) return null;
  const s = u.session;
  const when = s.live ? "정규장 진행 중" : `지난 정규장(${stamp(s.close)} 마감)`;
  const v = (x: number | null) => (x == null ? "-" : pct(x));
  return `S&P 500 ${v(u.sp)} · 나스닥 100 ${v(u.nd)} · ${when}, 전일 마감 대비${tail(u.updated)}`;
}

/** Worker가 [data-snap] 요소에 넣을 글자. 자료가 없으면 null(원래 '불러오는 중…' 그대로) */
export function snapFor(kind: string, attr: (name: string) => string | null, night: NightData | null, us: UsData | null): string | null {
  if (kind === "night") return night && nightSnap(night);
  if (kind === "stock") return night && stockSnap(night, attr("data-coin") ?? "", attr("data-name") ?? "");
  if (kind === "live") return night && liveSnap(night, attr("data-coin") ?? "", attr("data-name") ?? "", attr("data-unit") ?? "", attr("data-basis") ?? "");
  if (kind === "oil") return night && oilSnap(night);
  if (kind === "us") return us && usSnap(us);
  return null;
}

/** 그 주소가 어떤 자료를 미리 넣는지(없으면 그대로 내보낸다) */
export function snapNeeds(path: string): { night: boolean; us: boolean } | null {
  if (path === "/" || path === "/night" || path.startsWith("/night/") || path.startsWith("/live/") || path === "/weekend-oil") return { night: true, us: false };
  if (path === "/us") return { night: false, us: true };
  return null;
}
