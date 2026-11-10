import { KOSPI_STATS, contextFor } from "@/lib/kospi-stats";
import { Fold } from "./Fold";

const sgn = (v: number) => (v > 0 ? "+" : "");
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
const ymd = (d: string, year: number) => (d.startsWith(String(year)) ? md(d) : `${d.slice(0, 4)}년 ${md(d)}`);

/**
 * 크게 움직인 밤에만 붙는 '과거 통계' 한 줄. 지금 추정 등락률을 코스피200 일봉 하루 등락과 견주고,
 * 같은 방향으로 크게 갭 출발한 날 본장이 어땠는지 요약한다. 예측이 아니라 지나간 날의 집계다.
 */
export function NightContext({ pct, at }: { pct: number; at: number }) {
  const year = new Date(at + 9 * 3600_000).getUTCFullYear();
  const c = contextFor(pct, KOSPI_STATS, year);
  if (!c) return null;
  const up = pct > 0;
  const word = up ? "오른" : "내린";
  const g = c.gap;
  return (
    <div className="night-ctx">
      <p>
        <span className="night-ctx-tag">과거 통계</span>
        {c.n === 0 ? (
          <>
            코스피200이 하루 {sgn(pct)}
            {pct.toFixed(2)}% 넘게 {word} 날은 {c.sinceYear}년 이후 <b>한 번도 없었어요</b>
          </>
        ) : (
          <>
            코스피200이 하루 {sgn(pct)}
            {pct.toFixed(2)}% 이상 {word} 날은 {c.sinceYear}년 이후 <b>{c.n}번</b>
            {c.thisYear > 0 && ` (올해 ${c.thisYear}번)`}
            {c.latest && ` · 최근 ${ymd(c.latest, year)}`}
          </>
        )}
      </p>
      {g && g.upFromOpen != null && (
        <Fold small title={`전날보다 ${sgn(g.k)}${g.k}% 넘게 ${up ? "높게" : "낮게"} 시작한 날 본장은?`}>
          <p>
            {c.sinceYear}년 이후 코스피200이 전날 종가보다 {sgn(g.k)}
            {g.k}% {up ? "이상 높게" : "이상 낮게"} 시작한 날은 {g.n}일이었어요. 그날 종가가 시가보다 높았던 날은 {g.upFromOpen.toFixed(0)}%, 시가에서 종가까지
            평균 {sgn(g.ocAvg!)}
            {g.ocAvg!.toFixed(2)}%였고, 전날 종가보다 {up ? "높게" : "낮게"} 끝난 날은 {(up ? g.closeAbovePrev! : 100 - g.closeAbovePrev!).toFixed(0)}%(그날 평균{" "}
            {sgn(g.chgAvg!)}
            {g.chgAvg!.toFixed(2)}%)였습니다.
          </p>
          <p className="muted">
            지나간 날을 센 과거 통계이고 앞으로를 예측하지 않습니다. 지금 숫자는 해외 무기한선물로 계산한 추정치라 실제 코스피200 하루 등락과 정의가 다릅니다. 코스피200 일봉 기준
            · {KOSPI_STATS.last} 까지.
          </p>
        </Fold>
      )}
    </div>
  );
}
