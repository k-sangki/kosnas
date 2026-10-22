"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ACCEL,
  QUADRANTS,
  RS_LEADER,
  accelOf,
  halfDays,
  moveScores,
  ready,
  signed,
  type Dir,
  type Industry,
  type Move,
  type SectorData,
  type Unit,
} from "@/lib/sectors";

const CHART = { w: 320, h: 240, pad: 18 };

// 점 색: 이동 강도(▲ +, ▼ −)를 그 기간 가장 큰 값에 맞춰 빨강(--up) ↔ 회색 ↔ 파랑(--down)으로 잇는다
const RED = [240, 68, 82];
const GRAY = [196, 202, 209];
const BLUE = [49, 130, 246];
function moveColor(m: Move | undefined, max: number) {
  if (!m) return `rgb(${GRAY})`;
  const t = Math.min(1, m.score / (max || 1));
  const to = m.dir === "up" ? RED : BLUE;
  return `rgb(${GRAY.map((g, i) => Math.round(g + (to[i] - g) * t))})`;
}
type Filter = "all" | Dir;
const FILTERS: { key: Filter; name: string }[] = [
  { key: "all", name: "전체" },
  { key: "up", name: "강해지는 중" },
  { key: "down", name: "약해지는 중" },
];

/** 강도(x)·변화(y) 네 칸 그래프. 점 색은 이동 방향(빨강 주도 쪽, 파랑 소외 쪽), 누르면 그 기간의 이동선 */
function QuadrantChart({
  sectors,
  period,
  moves,
  selected,
  onSelect,
}: {
  sectors: Unit[];
  period: number;
  moves: Map<string, Move>;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const pts = sectors.map((s) => ({
    s,
    x: s.x[period]!,
    y: s.y[period]!,
    m: moves.get(s.id),
  }));
  const maxScore = Math.max(1, ...[...moves.values()].map((m) => m.score));
  const sel = pts.find((p) => p.s.id === selected);
  const line = sel?.m?.line ?? [];
  const all = [...pts.map((p) => [p.x, p.y]), ...line];
  const mx = Math.max(1, ...all.map((p) => Math.abs(p[0]))) * 1.15;
  const my = Math.max(1, ...all.map((p) => Math.abs(p[1]))) * 1.15;
  const cx = CHART.w / 2;
  const cy = CHART.h / 2;
  const px = (v: number) => cx + (v / mx) * (cx - CHART.pad);
  const py = (v: number) => cy - (v / my) * (cy - CHART.pad);
  const d = line.map(([x, y], i) => `${i ? "L" : "M"}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join("");
  const dirCls = sel?.m?.dir === "down" ? "down" : "up";
  return (
    <svg className="quad" viewBox={`0 0 ${CHART.w} ${CHART.h}`} role="img" aria-label="섹터 강도와 변화 네 칸 그래프" onClick={() => onSelect(null)}>
      <defs>
        <marker id="arr-up" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" className="m-up" />
        </marker>
        <marker id="arr-down" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" className="m-down" />
        </marker>
      </defs>
      <rect className="q-lead" x={cx} y={0} width={cx} height={cy} />
      <rect className="q-weaken" x={cx} y={cy} width={cx} height={cy} />
      <rect className="q-lag" x={0} y={cy} width={cx} height={cy} />
      <rect className="q-watch" x={0} y={0} width={cx} height={cy} />
      <line x1={cx} y1={0} x2={cx} y2={CHART.h} className="axis" />
      <line x1={0} y1={cy} x2={CHART.w} y2={cy} className="axis" />
      <text x={CHART.w - 6} y={14} textAnchor="end" className="q-label">
        주도
      </text>
      <text x={CHART.w - 6} y={CHART.h - 6} textAnchor="end" className="q-label">
        약화
      </text>
      <text x={6} y={CHART.h - 6} className="q-label">
        소외
      </text>
      <text x={6} y={14} className="q-label">
        관찰
      </text>
      {line.length > 1 && (
        <g className={`trail ${dirCls}`}>
          <path d={d} markerEnd={`url(#arr-${dirCls})`} />
          <circle cx={px(line[0][0])} cy={py(line[0][1])} r={2.5} className="start" />
        </g>
      )}
      {pts.map(({ s, x, y, m }) => {
        // 오른쪽 끝 점은 이름을 왼쪽에 써서 잘리지 않게
        const left = px(x) > CHART.w * 0.75;
        const dim = sel && sel.s.id !== s.id;
        return (
          <g
            key={s.id}
            className={`pt${dim ? " dim" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(selected === s.id ? null : s.id);
            }}
          >
            <circle cx={px(x)} cy={py(y)} r={9} className="hit" />
            <circle cx={px(x)} cy={py(y)} r={2.5} className="dot" style={{ fill: moveColor(m, maxScore) }} />
            <text x={px(x) + (left ? -5 : 5)} y={py(y) + 2.5} textAnchor={left ? "end" : "start"} className="dot-label">
              {s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MoveTag({ m }: { m?: Move }) {
  if (!m) return null;
  return (
    <span className={`mv ${m.dir}`}>
      {m.dir === "up" ? "▲" : "▼"}
      {m.score}
    </span>
  );
}

type Level = "sector" | "industry";

function RsCount({ u }: { u: Unit }) {
  if (u.rsLeaders == null) return null;
  return <small className={`rs-count${u.rsLeaders ? "" : " none"}`}>RS↑{u.rsLeaders}</small>;
}

const CARD_PERIODS = [5, 10, 20, 30, 60];

/** 아래 카드(시총 비중·거래대금 비중·하락일 버팀)는 카드마다 따로 기간을 고른다 */
function CardSeg({ value, onChange, label }: { value: number; onChange: (p: number) => void; label: string }) {
  return (
    <div className="seg small" role="group" aria-label={`${label} 기간`}>
      {CARD_PERIODS.map((p) => (
        <button key={p} aria-pressed={p === value} onClick={() => onChange(p)}>
          {p}일
        </button>
      ))}
    </div>
  );
}

function TwoCols({
  units,
  value,
  up,
  down,
  fmt,
  href,
  extra,
}: {
  units: Unit[];
  value: (u: Unit) => number | null | undefined;
  up: string;
  down: string;
  fmt: (v: number) => string;
  href: (u: Unit) => string;
  extra?: (u: Unit) => string;
}) {
  const list = units.filter((u) => value(u) != null).sort((a, b) => value(b)! - value(a)!);
  const row = (u: Unit, cls: string) => (
    <Link key={u.id} href={href(u)} className="flow-row">
      <span>
        {u.name}
        {extra && <small className="muted"> {extra(u)}</small>}
      </span>
      <b className={cls}>{fmt(value(u)!)}</b>
    </Link>
  );
  const ups = list.filter((u) => value(u)! > 0).slice(0, 6);
  const downs = list
    .filter((u) => value(u)! < 0)
    .slice(-6)
    .reverse();
  return (
    <div className="flow-cols">
      <div>
        <b className="up">{up}</b>
        {ups.length ? ups.map((u) => row(u, "up")) : <p className="muted">없음</p>}
      </div>
      <div>
        <b className="down">{down}</b>
        {downs.length ? downs.map((u) => row(u, "down")) : <p className="muted">없음</p>}
      </div>
    </div>
  );
}

export function SectorBoard({ data }: { data: SectorData }) {
  const [level, setLevel] = useState<Level>("sector");
  const [period, setPeriod] = useState(20);
  const [filter, setFilter] = useState<Filter>("all");
  const [rsOnly, setRsOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [allRank, setAllRank] = useState(false);
  const [rankP, setRankP] = useState(20);
  const [cp, setCp] = useState({ cap: 20, flow: 20, hold: 20 });
  const industries = data.industries ?? [];
  const units: Unit[] = level === "industry" && industries.length ? industries : data.sectors;
  const word = level === "industry" ? "산업" : "섹터";
  const sectorName = new Map(data.sectors.map((s) => [s.id, s.name]));
  const href = (u: Unit) => ("sector" in u ? `/${data.market}/sector/${(u as Industry).sector}#ind-${u.id}` : `/${data.market}/sector/${u.id}`);
  const live = useMemo(() => units.filter((s) => ready(s, period)), [units, period]);
  const moves = useMemo(() => moveScores(live, period), [live, period]);
  const hasRs = live.some((u) => u.rsLeaders != null);
  const shown = live.filter((s) => (filter === "all" || moves.get(s.id)?.dir === filter) && (!rsOnly || (s.rsLeaders ?? 0) > 0));
  const rankLive = units.filter((s) => ready(s, rankP) && shown.some((x) => x.id === s.id));
  const sorted = [...rankLive].sort((a, b) => b.x[rankP]! - a.x[rankP]!);
  const rankMoves = moveScores(units.filter((s) => ready(s, rankP)), rankP);
  const sel = shown.find((s) => s.id === selected);
  const selMove = sel && moves.get(sel.id);
  const selAccel = sel && accelOf(sel, period);
  const nUp = live.filter((s) => moves.get(s.id)?.dir === "up").length;
  const top = (dir: Dir) =>
    shown
      .map((s) => ({ s, m: moves.get(s.id) }))
      .filter((r): r is { s: Unit; m: Move } => r.m?.dir === dir)
      .sort((a, b) => b.m.score - a.m.score)
      .slice(0, 3);
  const score = (u: Unit) => moves.get(u.id)?.score ?? -1;
  const accels = shown.map((u) => ({ u, a: accelOf(u, period) })).filter((r) => r.a);
  const speedUp = accels.filter((r) => r.a!.v2 > 0 && r.a!.change > 0).sort((a, b) => b.a!.change - a.a!.change);
  const slowDown = accels.filter((r) => r.a!.v1 > 0 && r.a!.change < 0).sort((a, b) => a.a!.change - b.a!.change);
  const [d1, d2] = halfDays(period);
  const pick = (id: string) => {
    setSelected(id);
    document.getElementById("quad-chart")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const chip = (u: Unit) => {
    const m = moves.get(u.id);
    return (
      <button key={u.id} className={`chip${u.rsLeaders === 0 ? " no-leader" : ""}`} onClick={() => pick(u.id)}>
        {m && <span className={m.dir}>{m.dir === "up" ? "▲" : "▼"}</span>}
        {u.name}
        {m && <b> {m.score}</b>} <RsCount u={u} />
      </button>
    );
  };

  return (
    <>
      <section className="card">
        <div className="board-head">
          <h2 className="card-title">{word} 순환</h2>
          <div className="seg" role="group" aria-label="기간">
            {data.periods.map((p) => (
              <button key={p} aria-pressed={p === period} onClick={() => setPeriod(p)}>
                {p}일
              </button>
            ))}
          </div>
        </div>
        {industries.length > 0 && (
          <div className="seg filter" role="group" aria-label="분류 단계">
            {(["sector", "industry"] as Level[]).map((k) => (
              <button
                key={k}
                aria-pressed={k === level}
                onClick={() => {
                  setLevel(k);
                  setSelected(null);
                }}
              >
                {k === "sector" ? `섹터 ${data.sectors.length}` : `산업 ${industries.length}`}
              </button>
            ))}
          </div>
        )}
        <div className="seg filter" role="group" aria-label="이동 방향">
          {FILTERS.map((f) => (
            <button key={f.key} aria-pressed={f.key === filter} onClick={() => setFilter(f.key)}>
              {f.key === "all"
                ? `${f.name} ${live.length}`
                : `${f.key === "up" ? "▲" : "▼"} ${f.name.replace(" 중", "")} ${f.key === "up" ? nUp : live.length - nUp}`}
            </button>
          ))}
        </div>
        {hasRs && (
          <button className="rs-toggle" aria-pressed={rsOnly} onClick={() => setRsOnly(!rsOnly)}>
            RS {RS_LEADER}↑ 종목 있는 {word}만{rsOnly ? " ✓" : ""}
          </button>
        )}
        <div className="movers">
          <p>
            <b className="up">강해지는 중</b>{" "}
            {top("up").map(({ s, m }) => (
              <button key={s.id} onClick={() => setSelected(s.id)}>
                {s.name} <MoveTag m={m} />
              </button>
            ))}
          </p>
          <p>
            <b className="down">약해지는 중</b>{" "}
            {top("down").map(({ s, m }) => (
              <button key={s.id} onClick={() => setSelected(s.id)}>
                {s.name} <MoveTag m={m} />
              </button>
            ))}
          </p>
        </div>
        <div id="quad-chart">
          <QuadrantChart sectors={shown} period={period} moves={moves} selected={sel ? selected : null} onSelect={setSelected} />
        </div>
        {sel && selMove ? (
          <div className="sel-info">
            <p>
              <b>{sel.name}</b>
              {"sector" in sel && <span className="muted"> ({sectorName.get((sel as Industry).sector)})</span>} · {period}일 동안{" "}
              {selMove.dir === "up" ? "주도" : "소외"} 쪽으로 이동 · 이동 강도 <MoveTag m={selMove} /> (직진도 {Math.round(selMove.straight * 100)}% · 거리
              보통의 {selMove.dist.toFixed(1)}배)
            </p>
            {selAccel && (
              <p>
                {ACCEL[selAccel.kind].name} <span className="muted">({ACCEL[selAccel.kind].hint})</span> · 전반 {d1}일 {signed(selAccel.h1)}%p → 후반 {d2}일{" "}
                {signed(selAccel.h2)}%p
              </p>
            )}
            {sel.rsLeaders != null && (
              <p>
                RS {RS_LEADER}↑ <b>{sel.rsLeaders}종목</b>
                <span className="muted">
                  {" "}
                  (기본 필터 통과 중{sel.rsLeadersAll !== sel.rsLeaders ? `, 필터 없이 ${sel.rsLeadersAll}종목` : ""}) · RS 중간값 {sel.rsMedian ?? "-"}
                </span>
                {sel.rsLeaders === 0 && <span className="down"> · 움직였지만 RS 주도주가 없음</span>}
              </p>
            )}
            <Link href={href(sel)} className="inline-link">
              {sel.name} 종목 보기 →
            </Link>
          </div>
        ) : (
          <p className="muted small-note">
            가로는 강도({word} 수익률 − {word} 평균), 세로는 변화(바로 앞 같은 기간 대비 강도 변화)입니다. 점 색은 이동 강도로, 주도 쪽으로 가장 강하게 가는
            {word}가 가장 진한 빨강, 소외 쪽으로 가장 강하게 가는 {word}가 가장 진한 파랑이고 움직임이 약할수록 회색에 가까워요. 점을 누르면 그 기간 동안의
            이동선이 보입니다. RS↑n은 기본 필터를 통과한 종목 중 상대강도 {RS_LEADER} 이상인 종목 수예요(0이면 흐리게 — 움직였어도 이끄는 종목이 없다는 뜻).{" "}
            <Link href="/guide/quadrant" className="inline-link">
              네 칸 읽는 법
            </Link>
          </p>
        )}
      </section>

      <div className="quad-grid">
        {QUADRANTS.map((q) => {
          const list = shown.filter((u) => u.q[period] === q.key).sort((a, b) => score(b) - score(a));
          return (
            <section key={q.key} className={`card quad-list t-${q.key}`}>
              <h3>
                {q.name} <span className="muted">{list.length}</span>
              </h3>
              <div className="chips">{list.length ? list.slice(0, 10).map(chip) : <span className="muted">없음</span>}</div>
              {list.length > 10 && (
                <details>
                  <summary className="muted">나머지 {list.length - 10}개</summary>
                  <div className="chips">{list.slice(10).map(chip)}</div>
                </details>
              )}
              <p className="muted small-note">{q.hint}</p>
            </section>
          );
        })}
      </div>

      <section className="card">
        <h2 className="card-title">강도 순위</h2>
        <CardSeg value={rankP} onChange={setRankP} label="강도 순위" />
        <ol className="rank">
          {sorted.slice(0, level === "industry" && !allRank ? 30 : undefined).map((s, i) => {
            const q = QUADRANTS.find((x) => x.key === s.q[rankP])!;
            const r = s.ret[rankP];
            return (
              <li key={s.id}>
                <Link href={href(s)}>
                  <span className="rank-no">{i + 1}</span>
                  <span className="rank-name">
                    {s.name}
                    {"sector" in s && <small className="muted"> {sectorName.get((s as Industry).sector)}</small>}
                  </span>
                  <span className={`qtag t-${q.key}`}>{q.name}</span>
                  <MoveTag m={rankMoves.get(s.id)} />
                  <span className={`num ${r != null && r >= 0 ? "up" : "down"}`}>{signed(r)}%</span>
                  <span className="num muted">{signed(s.x[rankP])}%p</span>
                </Link>
              </li>
            );
          })}
        </ol>
        {level === "industry" && sorted.length > 30 && (
          <button className="rs-toggle" onClick={() => setAllRank(!allRank)}>
            {allRank ? "30위까지만 보기" : `나머지 ${sorted.length - 30}개 더 보기`}
          </button>
        )}
        <p className="muted small-note">▲▼ 숫자는 이동 강도(0~100)입니다. 기간 동안 한 방향으로 곧게, 다른 {word}보다 멀리 움직였을수록 큽니다.</p>
      </section>

      {accels.length > 0 && (
        <section className="card">
          <h2 className="card-title">
            가속·감속{" "}
            <span className="muted">
              {period}일 = 전반 {d1}일 + 후반 {d2}일
            </span>
          </h2>
          <div className="flow-cols">
            {[
              { title: "빨라짐", cls: "up", list: speedUp },
              { title: "느려짐·꺾임", cls: "down", list: slowDown },
            ].map((col) => (
              <div key={col.title}>
                <b className={col.cls}>{col.title}</b>
                {col.list.length ? (
                  col.list.slice(0, 6).map(({ u, a }) => (
                    <Link key={u.id} href={href(u)} className="flow-row">
                      <span>
                        {u.name}
                        <small className="muted">
                          {" "}
                          {signed(a!.h1)} → {signed(a!.h2)}%p
                        </small>
                      </span>
                      <b className={ACCEL[a!.kind].up ? "up" : "down"}>{ACCEL[a!.kind].name}</b>
                    </Link>
                  ))
                ) : (
                  <p className="muted">없음</p>
                )}
              </div>
            ))}
          </div>
          <p className="muted small-note">
            전반과 후반에 {word} 평균보다 얼마나 앞섰는지(%p)를 하루당 속도로 비교합니다. 가속 = 점점 빨리 강해짐, 반등 = 약하다가 강해짐, 감속 = 강해지지만
            느려짐, 꺾임 = 강해지다 약해짐. 위 기간 버튼을 따릅니다.
          </p>
        </section>
      )}

      {live.some((u) => u.capShareChg) && (
        <>
          <section className="card">
            <h2 className="card-title">시총 비중 변화</h2>
            <CardSeg value={cp.cap} onChange={(p) => setCp({ ...cp, cap: p })} label="시총 비중" />
            <TwoCols
              units={live}
              value={(u) => u.capShareChg?.[cp.cap]}
              up="늘어남"
              down="줄어듦"
              fmt={(v) => `${signed(v, 2)}%p`}
              href={href}
              extra={(u) => (u.capShare != null ? `${u.capShare.toFixed(1)}%` : "")}
            />
            <p className="muted small-note">
              {word} 시가총액 ÷ 전체 시가총액(옆 숫자 = 지금 비중)이 {cp.cap}일 동안 얼마나 바뀌었는지(%p)입니다. 주가 변화분만 계산해 신규 상장·증자로 커진
              몫은 뺍니다. 반도체처럼 큰 {word}가 움직이면 나머지 비중이 함께 반대로 움직여요.
            </p>
          </section>
          <section className="card">
            <h2 className="card-title">거래대금이 몰리는 {word}</h2>
            <CardSeg value={cp.flow} onChange={(p) => setCp({ ...cp, flow: p })} label="거래대금" />
            <TwoCols units={live} value={(u) => u.dShare?.[cp.flow]} up="늘어남" down="줄어듦" fmt={(v) => signed(v, 2)} href={href} />
            <p className="muted small-note">
              최근 {cp.flow}일 거래대금 비중 − 그 앞 {cp.flow}일 비중(%p)입니다.
            </p>
          </section>
          <section className="card">
            <h2 className="card-title">하락일에 버틴 {word}</h2>
            <CardSeg value={cp.hold} onChange={(p) => setCp({ ...cp, hold: p })} label="하락일 버팀" />
            {live.some((u) => u.hold?.[cp.hold] != null) ? (
              <TwoCols units={live} value={(u) => u.hold?.[cp.hold]} up="덜 빠짐" down="더 빠짐" fmt={(v) => signed(v, 2)} href={href} />
            ) : (
              <p className="muted">최근 {cp.hold}일에 평균이 내린 날이 3일 미만이라 계산하지 않았습니다.</p>
            )}
            <p className="muted small-note">
              최근 {cp.hold}일 중 {word} 평균이 내린 날들만 골라 ({word} − 평균)을 평균한 값(%p)입니다. 순환매 글에서 흔히 &lsquo;다음 주도 후보&rsquo;로
              꼽지만, 지나간 자료로 따져 보면 다음 주도라기보다 <b>방어 성격</b>에 가까웠습니다(시장이 오를 때는 뒤처지고 내릴 때만 버팀).
            </p>
          </section>
        </>
      )}
      <p className="muted small-note">
        이 화면은 지금 어디가 강하고 어디로 거래가 몰리는지 보는 곳입니다. 지나간 자료로 따져 보면 &lsquo;관찰&rsquo; 칸 섹터가 다음 20일에 평균보다 뚜렷하게
        앞서지 않았고, 이동 강도가 높았던 섹터나 시총·거래대금 비중이 늘어난 섹터도 다음 수익을 앞서 보여 주지 못했습니다. 다음 주도 섹터를 맞히는 신호가 아니라
        흐름을 읽는 참고 자료로 보세요.
      </p>
    </>
  );
}
