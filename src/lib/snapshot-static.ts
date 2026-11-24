/**
 * 경제지표·주요 일정 화면의 '불러오는 중…' 자리에 빌드(서버 렌더링) 때 넣는 한 줄(2026-11-25 외부 검색 진단).
 * 바탕 자료가 정적 파일이라 자료가 바뀌면 다시 배포되고, 그때의 시각을 기준 시각으로 적는다.
 * 브라우저에서는 쓰지 않는다(화면이 곧바로 실제 목록으로 바꾼다). Worker에 싣지 않으려고 lib/snapshot.ts와 나눴다.
 */
import { VERDICT, dayLabel, kstDate, kstHm, type Release } from "./econ";
import { kstToday, mdw, weeks } from "./schedule";
import { stamp } from "./snapshot";

/** 서버 렌더링일 때만 그 글자, 브라우저에서는 원래 '불러오는 중…' */
export const onServer = (make: () => string | null) => (typeof window === "undefined" ? (make() ?? "불러오는 중…") : "불러오는 중…");

function releaseText(r: Release) {
  const m = r.metrics[0];
  const when = `${dayLabel(kstDate(r.at))} ${r.whenText ?? kstHm(r.at)}`;
  if (!m) return `${when} ${r.name}`;
  const label = m.label && m.label !== r.name ? ` ${m.label}` : "";
  if (r.out && m.a)
    return `${when} ${r.name}${label} 실제 ${m.a}${m.f ? ` (예상 ${m.f}${m.verdict ? `, ${VERDICT[m.verdict]}` : ""})` : ""}`;
  return `${when} ${r.name}${label} 예상 ${m.f || "-"}${m.p ? ` (${m.pLabel ?? "직전"} ${m.p})` : ""}`;
}

/** 경제지표 목록(/econ) 또는 한 지표·기업(/econ/cpi, /econ/earnings/nvda): 가장 최근 결과와 다음 발표 */
export function econSnap(list: Release[], now = Date.now(), pick?: (r: Release) => boolean) {
  const mine = pick ? list.filter(pick) : list.filter((r) => r.band);
  const last = [...mine].reverse().find((r) => r.out && r.at <= now);
  const next = mine.find((r) => !r.out && r.at > now);
  const parts = [next && `다음 발표 ${releaseText(next)}`, last && `가장 최근 결과 ${releaseText(last)}`].filter(Boolean);
  if (!parts.length) return null;
  return `${parts.join(" · ")} · ${stamp(now)} 기준 · 최신 값을 불러오는 중…`;
}

/** 주요 일정(/schedule): 오늘부터 이번 주 국장 일정 몇 개 */
export function scheduleSnap(now = Date.now(), max = 5) {
  const today = kstToday(now);
  const items = weeks("kr", today)[0].days.filter((d) => d.date >= today).flatMap((d) => d.items.map((it) => `${mdw(d.date)} ${it.title}`));
  if (!items.length) return null;
  const more = items.length > max ? ` 외 ${items.length - max}건` : "";
  return `이번 주 국장 일정: ${items.slice(0, max).join(" · ")}${more} · ${stamp(now)} 기준 · 전체 일정을 불러오는 중…`;
}
