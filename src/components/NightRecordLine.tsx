"use client";

import { useEffect, useState } from "react";
import type { RecordSummary } from "@/lib/night-record";
import { Fold } from "./Fold";

const sgn = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
const p2 = (v: number) => `${sgn(v)}${Math.abs(v).toFixed(2)}`;
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/**
 * 추정 적중 기록 한 줄: 최근 30거래일 '09:00 직전 추정 vs KRX 코스피200 선물 주간 시가'의 평균 차이와 방향.
 * 맞은 날도 틀린 날도 그대로 공개한다(추정치라 유동성이 얇은 밤에는 크게 어긋날 수 있다).
 */
export function NightRecordLine({ refresh }: { refresh: number }) {
  const [s, setS] = useState<RecordSummary | null>(null);
  useEffect(() => {
    let stop = false;
    fetch("/api/night-record")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !stop && j && setS(j as RecordSummary))
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [refresh]);
  if (!s) return null;
  return (
    <div className="night-rec">
      <Fold
        small
        title={
          s.n === 0 ? (
            <>
              <span className="night-ctx-tag">적중 기록</span>11월 10일부터 매일 09:20쯤 추정과 실제 시가를 비교해 공개합니다
            </>
          ) : (
            <>
              <span className="night-ctx-tag">적중 기록</span>
              최근 {s.n}거래일 추정과 실제 시가 차이 평균 <b>{s.mae!.toFixed(2)}%p</b>
              {s.dirN > 0 && ` · 방향 ${s.dirHit}/${s.dirN} 맞음`}
            </>
          )
        }
      >
        {s.n > 0 && (
          <table className="night-rec-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>09:00 추정</th>
                <th>실제 시가</th>
                <th>차이</th>
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r) => {
                const e = ((r.est / r.base) - 1) * 100;
                const o = ((r.open / r.base) - 1) * 100;
                return (
                  <tr key={r.day}>
                    <td>
                      {md(r.day)}
                      {r.weekend && <small className="muted"> 주말</small>}
                    </td>
                    <td className={e > 0 ? "up" : e < 0 ? "down" : ""}>{p2(e)}%</td>
                    <td className={o > 0 ? "up" : o < 0 ? "down" : ""}>{p2(o)}%</td>
                    <td>
                      {Math.abs(r.err).toFixed(2)}%p{r.hit === false && <small className="muted"> 방향 틀림</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="muted">
          09:00 직전 추정값과 그날 한국거래소 코스피200 선물 주간 시가를, 전일 주간 종가 대비 등락률로 견준 차이입니다(종가를 못 받은 날·만기 다음 날은 15:45
          추정 대비). 해외 무기한선물은 거래가 얇은 밤·주말에 실제와 크게 어긋날 수 있어 맞은 날과 틀린 날을 모두 그대로 남깁니다. 지나간 기록이며 앞으로의 정확도를
          보장하지 않습니다.
        </p>
      </Fold>
    </div>
  );
}
