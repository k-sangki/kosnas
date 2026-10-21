"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { QUADRANTS, moveScores, ready, signed, type Dir, type Move, type Sector, type SectorData } from "@/lib/sectors";

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
  sectors: Sector[];
  period: number;
  moves: Map<string, Move>;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const pts = sectors.map((s) => ({ s, x: s.x[period]!, y: s.y[period]!, m: moves.get(s.id) }));
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
      <text x={CHART.w - 6} y={14} textAnchor="end" className="q-label">주도</text>
      <text x={CHART.w - 6} y={CHART.h - 6} textAnchor="end" className="q-label">약화</text>
      <text x={6} y={CHART.h - 6} className="q-label">소외</text>
      <text x={6} y={14} className="q-label">관찰</text>
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

export function SectorBoard({ data }: { data: SectorData }) {
  const [period, setPeriod] = useState(20);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const live = useMemo(() => data.sectors.filter((s) => ready(s, period)), [data.sectors, period]);
  const moves = useMemo(() => moveScores(live, period), [live, period]);
  const shown = live.filter((s) => filter === "all" || moves.get(s.id)?.dir === filter);
  const sorted = [...shown].sort((a, b) => b.x[period]! - a.x[period]!);
  const sel = shown.find((s) => s.id === selected);
  const selMove = sel && moves.get(sel.id);
  const top = (dir: Dir) =>
    live
      .map((s) => ({ s, m: moves.get(s.id) }))
      .filter((r): r is { s: Sector; m: Move } => r.m?.dir === dir)
      .sort((a, b) => b.m.score - a.m.score)
      .slice(0, 3);

  return (
    <>
      <section className="card">
        <div className="board-head">
          <h2 className="card-title">섹터 흐름</h2>
          <div className="seg" role="group" aria-label="기간">
            {data.periods.map((p) => (
              <button key={p} aria-pressed={p === period} onClick={() => setPeriod(p)}>
                {p}일
              </button>
            ))}
          </div>
        </div>
        <div className="seg filter" role="group" aria-label="이동 방향">
          {FILTERS.map((f) => (
            <button key={f.key} aria-pressed={f.key === filter} onClick={() => setFilter(f.key)}>
              {f.name}
            </button>
          ))}
        </div>
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
        <QuadrantChart sectors={shown} period={period} moves={moves} selected={sel ? selected : null} onSelect={setSelected} />
        {sel && selMove ? (
          <div className="sel-info">
            <p>
              <b>{sel.name}</b> · {period}일 동안 {selMove.dir === "up" ? "주도" : "소외"} 쪽으로 이동 · 이동 강도{" "}
              <MoveTag m={selMove} /> (직진도 {selMove.straight.toFixed(2)} · 거리 {selMove.dist.toFixed(1)}배)
            </p>
            <Link href={`/${data.market}/sector/${sel.id}`} className="inline-link">
              {sel.name} 종목 보기 →
            </Link>
          </div>
        ) : (
          <p className="muted small-note">
            가로는 강도(섹터 수익률 − 섹터 평균), 세로는 변화(바로 앞 같은 기간 대비 강도 변화)입니다. 점 색은 이동 강도로, 주도 쪽으로 가장 강하게 가는
            섹터가 가장 진한 빨강, 소외 쪽으로 가장 강하게 가는 섹터가 가장 진한 파랑이고 움직임이 약할수록 회색에 가까워요. 점을 누르면 그 기간 동안의 이동선이 보입니다.{" "}
            <Link href="/guide/quadrant" className="inline-link">
              네 칸 읽는 법
            </Link>
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">{period}일 강도 순위</h2>
        <ol className="rank">
          {sorted.map((s, i) => {
            const q = QUADRANTS.find((x) => x.key === s.q[period])!;
            const r = s.ret[period];
            return (
              <li key={s.id}>
                <Link href={`/${data.market}/sector/${s.id}`}>
                  <span className="rank-no">{i + 1}</span>
                  <span className="rank-name">{s.name}</span>
                  <span className={`qtag t-${q.key}`}>{q.name}</span>
                  <MoveTag m={moves.get(s.id)} />
                  <span className={`num ${r != null && r >= 0 ? "up" : "down"}`}>{signed(r)}%</span>
                  <span className="num muted">{signed(s.x[period])}%p</span>
                </Link>
              </li>
            );
          })}
        </ol>
        <p className="muted small-note">
          ▲▼ 숫자는 이동 강도(0~100)입니다. 기간 동안 한 방향으로 곧게, 다른 섹터보다 멀리 움직였을수록 큽니다.
        </p>
      </section>
    </>
  );
}
