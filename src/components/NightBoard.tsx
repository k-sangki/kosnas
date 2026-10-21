"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hhmm, usOpenIn, type NightData } from "@/lib/night";
import { CaptureSheet } from "./CaptureSheet";
import { Dashboard } from "./Dashboard";
import { LogoSvg } from "./Logo";

const fmt = (v: number, d = 2) => v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const sign = (v: number) => (v > 0 ? "+" : "");
const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");

const PAD = { l: 8, r: 58, t: 14, b: 26 };

function Chart({ d }: { d: NightData }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // 글자가 화면 크기와 상관없이 같은 크기로 보이도록 실제 폭으로 그린다
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
  const x0 = d.window.start;
  const x1 = d.window.end;
  const ys = pts.flatMap((p) => (p[2] != null ? [p[1], p[2]] : [p[1]])).concat(d.base);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  const pad = Math.max((hi - lo) * 0.08, d.base * 0.002);
  lo -= pad;
  hi += pad;
  const px = (t: number) => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const py = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = (get: (p: NightData["points"][number]) => number | null) => {
    let s = "";
    let pen = false;
    for (const p of pts) {
      const v = get(p);
      if (v == null) {
        pen = false;
        continue;
      }
      s += `${pen ? "L" : "M"}${px(p[0]).toFixed(1)},${py(v).toFixed(1)}`;
      pen = true;
    }
    return s;
  };
  const est = path((p) => p[1]);
  const kr = path((p) => p[2]);
  const last = pts[pts.length - 1];
  const t = tone(d.chg);
  // 가로 눈금: 3시간마다
  const ticks: number[] = [];
  const first = Math.ceil(x0 / 10_800_000) * 10_800_000;
  for (let k = first; k < x1; k += 10_800_000) ticks.push(k);
  // 세로 눈금 4개
  const ystep = (hi - lo) / 4;
  const yt = [0, 1, 2, 3, 4].map((i) => lo + ystep * i);
  const us = usOpenIn(d.window);
  const night = d.window.start + (2 * 60 + 15) * 60_000; // 18:00 야간 개장
  const nightEnd = d.window.end - 3 * 3600_000; // 06:00 야간 마감
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
        aria-label="코스피200 야간 추정 차트"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {yt.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(v)} y2={py(v)} className="grid" />
            <text x={W - PAD.r + 6} y={py(v) + 4} className="ylab">
              {fmt(v)}
            </text>
          </g>
        ))}
        {ticks.map((k) => (
          <text key={k} x={px(k)} y={H - 8} className="xlab" textAnchor="middle">
            {hhmm(k)}
          </text>
        ))}
        {[[night, "야간 개장"], ...(us ? [[us, "미국 개장"] as const] : []), [nightEnd, "야간 마감"]].map(([at, name]) => (
          <g key={name as string}>
            <line x1={px(at as number)} x2={px(at as number)} y1={PAD.t} y2={H - PAD.b} className="mark" />
            {/* 마감 표시는 선 왼쪽에 써서 오른쪽 눈금과 겹치지 않게 */}
            <text x={px(at as number) + (at === nightEnd ? -4 : 4)} y={PAD.t + 10} textAnchor={at === nightEnd ? "end" : "start"} className="mlab">
              {name}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={py(d.base)} y2={py(d.base)} className="base" />
        <path d={kr} className="kr" />
        <path d={est} className={`est ${t}`} />
        <circle cx={px(last[0])} cy={py(last[1])} r={3.5} className={`dot ${t}`} />
        <rect x={W - PAD.r + 2} y={py(last[1]) - 10} width={PAD.r - 2} height={20} rx={4} className={`tag ${t}`} />
        <text x={W - PAD.r + 6} y={py(last[1]) + 4} className="tagt">
          {fmt(last[1])}
        </text>
        {hp && (
          <g>
            <line x1={px(hp[0])} x2={px(hp[0])} y1={PAD.t} y2={H - PAD.b} className="cross" />
            <circle cx={px(hp[0])} cy={py(hp[1])} r={3} className={`dot ${tone(hp[1] - d.base)}`} />
          </g>
        )}
      </svg>
      <p className="nchart-read" aria-live="polite">
        {hp ? (
          <>
            {hhmm(hp[0])} · 추정 <b className={tone(hp[1] - d.base)}>{fmt(hp[1])}</b> ({sign(hp[1] - d.base)}
            {fmt(((hp[1] - d.base) / d.base) * 100)}%){hp[2] != null && <> · KR200 {fmt(hp[2])}</>}
          </>
        ) : (
          <>
            <span className="key est-key" /> 추정(EWY·KR200) <span className="key kr-key" /> KR200 무기한선물 <span className="key base-key" /> 15:45 기준
          </>
        )}
      </p>
    </div>
  );
}

export function NightBoard() {
  const [d, setD] = useState<NightData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const live = useRef(true);
  const capRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const target = useCallback(() => capRef.current, []);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch("/api/night", { cache: "no-store" });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? r.status);
          live.current = j.window?.live !== false;
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

  const stamp = new Date((d?.updated ?? 0) + 9 * 3600_000);
  const day = `${stamp.getUTCMonth() + 1}월 ${stamp.getUTCDate()}일`;
  return (
    <>
      {/* 캡처 범위: 추정 카드와 시세 카드. 캡처할 때만 머리·꼬리(로고·시각·주소)를 보인다 */}
      <div className="dash-cap" ref={capRef}>
        <div className="cap-only cap-head">
          <LogoSvg />
          {d && (
            <span>
              {day} {hhmm(d.updated)} 기준
            </span>
          )}
        </div>
        <section className="card night">
          <div className="night-top">
            <h1 className="night-title">코스피 야간선물 실시간 추정</h1>
            <button type="button" className="cap-btn no-capture" onClick={() => setCapturing(true)} aria-label="대시보드 캡처" disabled={!d}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              캡처
            </button>
          </div>
          {d ? <Main d={d} /> : <p className="muted">{err ? `자료를 불러오지 못했습니다. 잠시 뒤 다시 시도합니다. (${err})` : "불러오는 중…"}</p>}
          {d && err && <p className="muted small-note">마지막 갱신 뒤 자료를 받지 못했습니다.</p>}
        </section>
        <Dashboard d={d} />
        <div className="cap-only cap-foot">
          <span>해외 무기한선물로 계산한 참고용 추정치입니다</span>
          <b>kosnas.com</b>
        </div>
      </div>
      {capturing && (
        <CaptureSheet
          target={target}
          fileName={`kosnas-dashboard-${stamp.toISOString().slice(0, 16).replace(/[-:T]/g, "")}.png`}
          shareTitle={`코스피 야간선물 실시간 추정 ${day} ${d ? hhmm(d.updated) : ""}`}
          shareUrl="https://kosnas.com/night"
          onClose={() => setCapturing(false)}
        />
      )}
    </>
  );
}

function Main({ d }: { d: NightData }) {
  const t = tone(d.chg);
  return (
    <>
      <div className="night-head">
        <div>
          <p className="muted">{d.window.live ? "실시간 · 15초마다 갱신" : `지난밤 · ${hhmm(d.window.end)} 마감`}</p>
          <p className="night-price">
            <b className={t}>{fmt(d.est)}</b>
            <span className={t}>
              {sign(d.chg)}
              {fmt(d.chg)} ({sign(d.chgPct)}
              {fmt(d.chgPct)}%)
            </span>
          </p>
        </div>
        <dl className="night-stats">
          <div>
            <dt>기준(15:45)</dt>
            <dd>{fmt(d.base)}</dd>
          </div>
          {d.at0600 != null && (
            <div>
              <dt>06:00</dt>
              <dd className={tone(d.at0600 - d.base)}>{fmt(d.at0600)}</dd>
            </div>
          )}
          <div>
            <dt>고가</dt>
            <dd className="up">{fmt(d.high)}</dd>
          </div>
          <div>
            <dt>저가</dt>
            <dd className="down">{fmt(d.low)}</dd>
          </div>
          <div>
            <dt>갱신</dt>
            <dd>{hhmm(d.updated)}</dd>
          </div>
        </dl>
      </div>
      <Chart d={d} />
    </>
  );
}
