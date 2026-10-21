"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ACCEL, BASE_FILTER, QUADRANTS, RS_LEADER, accelOf, halfDays, signed, type Industry, type Sector, type Unit } from "@/lib/sectors";
import { StockList } from "./StockList";

/** 이동 강도(전체 섹터·산업 안에서 센 값)를 기간마다 서버에서 넘겨받는다 */
export type MoveBy = Record<string, { dir: "up" | "down"; score: number; straight: number; dist: number } | undefined>;

function Lines({ u, period, move, word }: { u: Unit; period: number; move?: MoveBy[string]; word: string }) {
  const a = accelOf(u, period);
  const [d1, d2] = halfDays(period);
  const warn: string[] = [];
  const ds = u.dShare?.[period];
  if (ds != null && ds < 0) warn.push(`거래대금 비중 감소(${signed(ds, 2)}%p)`);
  if (u.leader?.fromHigh != null && u.leader.fromHigh <= -10)
    warn.push(`대장주${u.leader.shown ? ` ${u.leader.name}` : "(시총 1위)"} 52주 고가 대비 ${signed(u.leader.fromHigh)}%`);
  return (
    <div className="sd-lines">
      {move && (
        <p>
          이동 강도{" "}
          <b className={move.dir}>
            {move.dir === "up" ? "▲" : "▼"}
            {move.score}점
          </b>{" "}
          · 직진도 {Math.round(move.straight * 100)}% · 이동 거리 보통의 {move.dist.toFixed(1)}배 <span className="muted">({period}일)</span>
        </p>
      )}
      {a && (
        <p>
          {ACCEL[a.kind].name} <span className="muted">({ACCEL[a.kind].hint})</span> · 전반 {d1}일 {signed(a.h1)}%p → 후반 {d2}일 {signed(a.h2)}%p
        </p>
      )}
      {u.rsLeaders != null && (
        <p>
          RS {RS_LEADER}↑ <b>{u.rsLeaders}종목</b>
          <span className="muted">
            {" "}
            (기본 필터 통과 중{u.rsLeadersAll !== u.rsLeaders ? `, 필터 없이 ${u.rsLeadersAll}종목` : ""}) · {word} RS 중간값 {u.rsMedian ?? "-"}
          </span>
          {u.rsLeaders === 0 && <span className="down"> · {word}는 움직였지만 RS 주도주가 없음</span>}
        </p>
      )}
      <p className="sd-warn">
        {warn.length ? `약화 신호: ${warn.join(" · ")}` : "약화 신호 없음"}
        <br />
        <span className="muted">거래대금 비중 감소 · 대장주가 고점에서 10% 넘게 밀림 (순환매 글에서 흔히 쓰는 기준, 검증된 신호는 아님)</span>
      </p>
    </div>
  );
}

export function SectorDetail({
  sector,
  industries,
  periods,
  moves,
  indMoves,
  from,
  asof,
}: {
  sector: Sector;
  industries: Industry[];
  periods: number[];
  moves: Record<string, MoveBy[string]>;
  indMoves: Record<string, MoveBy>;
  from?: string;
  asof: string;
}) {
  const [period, setPeriod] = useState(20);
  // 다른 화면에서 산업을 눌러 #ind-… 로 들어오면 그 산업을 고른다(직접 누르기 전까지)
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => decodeURIComponent(location.hash.replace(/^#ind-/, "")),
    () => "",
  );
  const [picked, setSub] = useState<string | null | undefined>(undefined);
  const sub = picked !== undefined ? picked : industries.some((i) => i.id === hash) ? hash : null;
  useEffect(() => {
    if (hash) document.getElementById(`ind-${hash}`)?.scrollIntoView({ block: "start" });
  }, [hash]);
  const ind = industries.find((i) => i.id === sub);
  const pool = sector.stocks.filter((s) => !ind || s.ind === ind.name);
  const key = String(period);
  const vals = pool
    .map((s) => s.r?.[key])
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  const mid = vals.length ? vals[Math.floor(vals.length / 2)] : null;
  const heads = pool.filter((s) => s.above50).slice(0, 3); // 이미 RS 순
  const ran = mid == null ? [] : pool.filter((s) => (s.r?.[key] ?? -1e9) >= mid).sort((a, b) => b.r![key]! - a.r![key]!);
  const lag = mid == null ? [] : pool.filter((s) => s.r?.[key] != null && s.r[key]! < mid && s.above50);
  const rows = [...industries].sort((a, b) => (b.ret[key] ?? -1e9) - (a.ret[key] ?? -1e9));
  const list = (xs: typeof pool) =>
    xs.length ? <StockList stocks={xs} from={from} asof={asof} period={period} showInd={!ind && industries.length > 1} /> : <p className="muted">없음</p>;

  return (
    <section className="card">
      <div className="board-head">
        <h2 className="card-title">흐름과 종목</h2>
        <div className="seg" role="group" aria-label="기간">
          {periods.map((p) => (
            <button key={p} aria-pressed={p === period} onClick={() => setPeriod(p)}>
              {p}일
            </button>
          ))}
        </div>
      </div>
      <Lines u={sector} period={period} move={moves[key]} word="섹터" />

      {industries.length > 1 && (
        <>
          <h3 className="sub-head">
            이 섹터의 산업{" "}
            <span className="muted">
              {period}일 수익률 순 · 누르면 그 산업의 종목
              {sub ? "(다시 누르면 섹터 전체)" : ""}
            </span>
          </h3>
          <div className="ind-rows">
            {rows.map((i) => {
              const q = QUADRANTS.find((x) => x.key === i.q[key]);
              const r = i.ret[key];
              return (
                <button key={i.id} id={`ind-${i.id}`} className="ind-row" aria-pressed={i.id === sub} onClick={() => setSub(i.id === sub ? null : i.id)}>
                  <span>
                    {i.name}
                    <small className="muted">
                      {i.count}종목 · RS↑{i.rsLeaders ?? 0}
                      {i.leader?.shown ? ` · 시총 1위 ${i.leader.name}` : ""}
                    </small>
                  </span>
                  {q ? <span className={`qtag t-${q.key}`}>{q.name}</span> : <span />}
                  <b className={r != null && r >= 0 ? "up" : "down"}>{signed(r)}%</b>
                </button>
              );
            })}
          </div>
          <p className="muted small-note">산업 칸(주도·약화·소외·관찰)은 전체 산업 평균 대비입니다.</p>
        </>
      )}

      {ind && (
        <>
          <h3 className="sub-head">{ind.name}</h3>
          <Lines u={ind} period={period} move={indMoves[key]?.[ind.id]} word="산업" />
        </>
      )}

      <p className="muted small-note">
        아래 목록은 기본 필터 통과 종목만 보입니다({BASE_FILTER}){!ind && sector.hidden ? ` · 제외 ${sector.hidden}종목` : ""}. 계산에는 모든 보통주를 씁니다.
      </p>
      <h3 className="sub-head">
        대장주 후보 <span className="muted">50일선 위 · RS 상위 3{!ind && sector.leader?.shown ? ` · 시총 1위 ${sector.leader.name}` : ""}</span>
      </h3>
      {list(heads)}
      <h3 className="sub-head">
        많이 오른 종목 <span className="muted">{period}일 수익률 상위</span>
      </h3>
      {list(ran.slice(0, 8))}
      <h3 className="sub-head">
        덜 올랐지만 50일선 위 <span className="muted">{ind ? "산업" : "섹터"} 중간값 아래 · RS 순</span>
      </h3>
      {list(lag.slice(0, 8))}
      <details className="sd-more">
        <summary>기본 필터 통과 전체 {pool.length}종목 (RS 순)</summary>
        {list(pool.slice(0, 80))}
        {pool.length > 80 && <p className="muted">RS 상위 80종목까지만 보입니다.</p>}
      </details>
    </section>
  );
}
