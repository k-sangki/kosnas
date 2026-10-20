"use client";

import Link from "next/link";
import { useState } from "react";
import { QUADRANTS, signed, type Market, type Sector, type SectorData } from "@/lib/sectors";

const CHART = { w: 320, h: 240, pad: 18 };

/** 강도(x)·변화(y) 네 칸 그래프. 축 범위는 그 기간 값의 최대 절댓값에 맞춘다 */
function QuadrantChart({ sectors, period, market }: { sectors: Sector[]; period: number; market: Market }) {
  const mx = Math.max(1, ...sectors.map((s) => Math.abs(s.x[period]))) * 1.15;
  const my = Math.max(1, ...sectors.map((s) => Math.abs(s.y[period]))) * 1.15;
  const cx = CHART.w / 2;
  const cy = CHART.h / 2;
  const px = (v: number) => cx + (v / mx) * (cx - CHART.pad);
  const py = (v: number) => cy - (v / my) * (cy - CHART.pad);
  return (
    <svg className="quad" viewBox={`0 0 ${CHART.w} ${CHART.h}`} role="img" aria-label="섹터 강도와 변화 네 칸 그래프">
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
      {sectors.map((s) => (
        <Link key={s.id} href={`/${market}/sector/${s.id}`}>
          <circle cx={px(s.x[period])} cy={py(s.y[period])} r={5} className={`dot d-${s.q[period]}`} />
          {/* 오른쪽 끝 점은 이름을 왼쪽에 써서 잘리지 않게 */}
          <text
            x={px(s.x[period]) + (px(s.x[period]) > CHART.w * 0.75 ? -7 : 7)}
            y={py(s.y[period]) + 4}
            textAnchor={px(s.x[period]) > CHART.w * 0.75 ? "end" : "start"}
            className="dot-label"
          >
            {s.name}
          </text>
        </Link>
      ))}
    </svg>
  );
}

export function SectorBoard({ data }: { data: SectorData }) {
  const [period, setPeriod] = useState(20);
  const sorted = [...data.sectors].sort((a, b) => b.x[period] - a.x[period]);

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
        <QuadrantChart sectors={data.sectors} period={period} market={data.market} />
        <p className="muted small-note">
          가로는 강도(섹터 수익률 − 섹터 평균), 세로는 변화(앞 기간 대비 강도 변화)입니다. 점을 누르면 그 섹터 종목을 볼 수 있어요.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">{period}일 강도 순위</h2>
        <ol className="rank">
          {sorted.map((s, i) => {
            const q = QUADRANTS.find((x) => x.key === s.q[period])!;
            return (
              <li key={s.id}>
                <Link href={`/${data.market}/sector/${s.id}`}>
                  <span className="rank-no">{i + 1}</span>
                  <span className="rank-name">{s.name}</span>
                  <span className={`qtag t-${q.key}`}>{q.name}</span>
                  <span className={`num ${s.ret[period] >= 0 ? "up" : "down"}`}>{signed(s.ret[period])}%</span>
                  <span className="num muted">{signed(s.x[period])}%p</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
