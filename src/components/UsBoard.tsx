"use client";

import { useEffect, useRef, useState } from "react";
import { hhmm } from "@/lib/night";
import type { UsData } from "@/lib/us";

const fmt = (v: number, d = 2) => v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const sign = (v: number) => (v > 0 ? "+" : "");
const tone = (v: number | null) => (v == null ? "" : v > 0 ? "up" : v < 0 ? "down" : "");
const pctText = (v: number | null) => (v == null ? "-" : `${sign(v)}${fmt(v)}%`);

const PAD = { l: 8, r: 52, t: 14, b: 26 };

function Chart({ d }: { d: UsData }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 240 : 300;
  const pts = d.points;
  const x0 = d.session.open;
  const x1 = d.session.close;
  const ys = pts.flatMap((p) => [p[1], p[2]].filter((v): v is number => v != null)).concat(0);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  const pad = Math.max((hi - lo) * 0.08, 0.2);
  lo -= pad;
  hi += pad;
  const px = (t: number) => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const py = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = (i: 1 | 2) => {
    let s = "";
    let pen = false;
    for (const p of pts) {
      const v = p[i];
      if (v == null) {
        pen = false;
        continue;
      }
      s += `${pen ? "L" : "M"}${px(p[0]).toFixed(1)},${py(v).toFixed(1)}`;
      pen = true;
    }
    return s;
  };
  // 가로 눈금: 매시 정각(KST)
  const ticks: number[] = [];
  for (let k = Math.ceil(x0 / 3600_000) * 3600_000; k < x1; k += 3600_000) ticks.push(k);
  const ystep = (hi - lo) / 4;
  const yt = [0, 1, 2, 3, 4].map((i) => lo + ystep * i);
  const last = pts[pts.length - 1];
  const hp = hover != null ? pts[hover] : null;

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    const tt = x0 + ((x - PAD.l) / (W - PAD.l - PAD.r)) * (x1 - x0);
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i][0] - tt) < Math.abs(pts[best][0] - tt)) best = i;
    setHover(best);
  };

  return (
    <div className="nchart" ref={box}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="S&P 500·나스닥 100 정규장 등락 차트"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {yt.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} className="grid" />
            <text x={W - PAD.r + 6} y={py(v) + 4} className="ylab">
              {sign(v)}
              {fmt(v)}%
            </text>
          </g>
        ))}
        {ticks.map((k) => (
          <text key={k} x={px(k)} y={H - 8} className="xlab" textAnchor="middle">
            {hhmm(k)}
          </text>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={py(0)} y2={py(0)} className="base" />
        <path d={path(2)} className="us-nd" />
        <path d={path(1)} className="us-sp" />
        {last[1] != null && <circle cx={px(last[0])} cy={py(last[1])} r={3.5} className="us-sp-dot" />}
        {last[2] != null && <circle cx={px(last[0])} cy={py(last[2])} r={3.5} className="us-nd-dot" />}
        {hp && <line x1={px(hp[0])} x2={px(hp[0])} y1={PAD.t} y2={H - PAD.b} className="cross" />}
      </svg>
      <p className="nchart-read" aria-live="polite">
        {hp ? (
          <>
            {hhmm(hp[0])} · S&P 500 <b className={tone(hp[1])}>{pctText(hp[1])}</b> · 나스닥 100 <b className={tone(hp[2])}>{pctText(hp[2])}</b>
          </>
        ) : (
          <>
            <span className="key us-sp-key" /> S&P 500 <span className="key us-nd-key" /> 나스닥 100 <span className="key base-key" /> 전일 종가
          </>
        )}
      </p>
    </div>
  );
}

export function UsBoard() {
  const [d, setD] = useState<UsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const live = useRef(true);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/us", { cache: "no-store" });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? r.status);
          live.current = j.session?.live !== false;
          if (!stop) {
            setD(j);
            setErr(null);
          }
        } catch (e) {
          if (!stop) setErr(String(e));
        }
      }
      if (!stop) timer = setTimeout(tick, live.current ? 15_000 : 300_000);
    };
    tick();
    const vis = () => document.visibilityState === "visible" && (clearTimeout(timer), tick());
    document.addEventListener("visibilitychange", vis);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  if (!d) {
    return (
      <section className="card">
        <p className="muted">{err ? `자료를 불러오지 못했습니다. 잠시 뒤 다시 시도합니다. (${err})` : "불러오는 중…"}</p>
      </section>
    );
  }
  const s = d.session;
  return (
    <section className="card night">
      <div className="night-head">
        <div>
          <p className="muted">
            {s.live ? "정규장 진행 중 · 15초마다 갱신" : `지난 정규장 · ${hhmm(s.close)} 마감`} · 한국 시각 {hhmm(s.open)}~{hhmm(s.close)}
          </p>
          <dl className="us-price">
            <div>
              <dt>S&P 500</dt>
              <dd className={tone(d.sp)}>{pctText(d.sp)}</dd>
            </div>
            <div>
              <dt>나스닥 100</dt>
              <dd className={tone(d.nd)}>{pctText(d.nd)}</dd>
            </div>
          </dl>
        </div>
        <dl className="night-stats">
          <div>
            <dt>갱신</dt>
            <dd>{hhmm(d.updated)}</dd>
          </div>
        </dl>
      </div>
      <Chart d={d} />
      {err && <p className="muted small-note">마지막 갱신 뒤 자료를 받지 못했습니다.</p>}
      <p className="muted small-note">등락은 미국 직전 거래일 16:00(뉴욕) 대비입니다.</p>
    </section>
  );
}
