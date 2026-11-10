"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  boardState,
  nextNightStart,
  chartEnd,
  dayBounds,
  untilText,
  type BoardState,
  hhmm,
  timeTicks,
  usOpenIn,
  type NightData,
} from "@/lib/night";
import { InstallButton } from "./InstallButton";
import { CaptureSheet } from "./CaptureSheet";
import { Chat } from "./Chat";
import { Dashboard } from "./Dashboard";
import { Poll } from "./Poll";
import { NightPnl } from "./NightPnl";
import { TestBand } from "./TestBand";
import { ScheduleBand } from "./ScheduleBand";
import { LogoSvg } from "./Logo";

const fmt = (v: number, d = 2) =>
  v.toLocaleString("ko-KR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const sign = (v: number) => (v > 0 ? "+" : "");
const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");

const PAD = { l: 8, r: 58, t: 14, b: 26 };

/** 등락률 기준값 이름: KRX 주간 종가를 받았으면 그것, 아니면 15:45 추정값 */
const baseName = (d: NightData) =>
  d.baseKind === "close" ? "주간 종가" : "15:45 기준";

function Chart({ d }: { d: NightData }) {
  const [hover, setHover] = useState<number | null>(null);
  const cid = `nc${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ref = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // 글자가 화면 크기와 상관없이 같은 크기로 보이도록 실제 폭으로 그린다
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(280, Math.round(e.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 240 : 300;
  const pts = d.points;
  const x0 = d.window.start;
  const x1 = chartEnd(d.window, pts[pts.length - 1][0]);
  const ys = pts
    .flatMap((p) => (p[2] != null ? [p[1], p[2]] : [p[1]]))
    .concat(d.base);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  const pad = Math.max((hi - lo) * 0.08, d.base * 0.002);
  lo -= pad;
  hi += pad;
  const px = (t: number) =>
    PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const py = (v: number) =>
    PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
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
  // 가로 눈금: 글자가 겹치지 않는 간격으로
  const ticks = timeTicks(x0, x1, W - PAD.l - PAD.r);
  // 세로 눈금 4개
  const ystep = (hi - lo) / 4;
  const yt = [0, 1, 2, 3, 4].map((i) => lo + ystep * i);
  const us = usOpenIn(d.window);
  const night = d.window.start + (2 * 60 + 15) * 60_000; // 18:00 야간 개장
  const nightEnd = d.nightClose ?? d.window.end - 3 * 3600_000; // 06:00 야간 마감(금요일 밤은 토요일)
  // 표시선 이름: 마감은 선 왼쪽, 나머지는 오른쪽에 쓰고, 앞 이름과 겹치면 한 줄 아래로 내린다
  const marks: { at: number; name: string; row: number }[] = [];
  let edge = -Infinity;
  let row = 0;
  // 주말을 낀 구간(하루보다 긴 축)은 개장 표시 대신 토·일·월 날짜 경계를 표시한다(2026-11-10 SK)
  const long = x1 - x0 > 86_400_000;
  for (const [at, name] of [
    ...(long ? [] : [[night, "야간 개장"] as const, ...(us ? [[us, "미국 개장"] as const] : [])]),
    [nightEnd, "야간 마감"] as const,
    ...(long ? dayBounds(x0, x1).map((b) => [b.at, b.label] as const) : []),
  ]) {
    if (at <= x0 || at >= x1) continue;
    const w = name.length * 10;
    const from = at === nightEnd ? px(at) - 4 - w : px(at) + 4;
    row = from < edge + 4 ? row + 1 : 0;
    edge = Math.max(edge, from + w);
    marks.push({ at, name, row });
  }
  const hp = hover != null ? pts[hover] : null;

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    const tt = x0 + ((x - PAD.l) / (W - PAD.l - PAD.r)) * (x1 - x0);
    let best = 0;
    for (let i = 1; i < pts.length; i++)
      if (Math.abs(pts[i][0] - tt) < Math.abs(pts[best][0] - tt)) best = i;
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
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={py(v)}
              y2={py(v)}
              className="grid"
            />
            <text x={W - PAD.r + 6} y={py(v) + 4} className="ylab">
              {fmt(v)}
            </text>
          </g>
        ))}
        {ticks.map((k) => (
          <text
            key={k.at}
            x={px(k.at)}
            y={H - 8}
            className="xlab"
            textAnchor="middle"
          >
            {k.label}
          </text>
        ))}
        {marks.map(({ at, name, row }) => (
          <g key={name}>
            <line
              x1={px(at)}
              x2={px(at)}
              y1={PAD.t}
              y2={H - PAD.b}
              className="mark"
            />
            {/* 마감 표시는 선 왼쪽에 써서 오른쪽 눈금과 겹치지 않게 */}
            <text
              x={px(at) + (at === nightEnd ? -4 : 4)}
              y={PAD.t + 10 + row * 13}
              textAnchor={at === nightEnd ? "end" : "start"}
              className="mlab"
            >
              {name}
            </text>
          </g>
        ))}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={py(d.base)}
          y2={py(d.base)}
          className="base"
        />
        <path d={kr} className="kr" />
        {/* 추정선은 기준선 위는 빨강, 아래는 파랑으로 나눠 그린다 */}
        <defs>
          <clipPath id={`${cid}u`}>
            <rect x={0} y={0} width={W} height={py(d.base)} />
          </clipPath>
          <clipPath id={`${cid}d`}>
            <rect x={0} y={py(d.base)} width={W} height={H - py(d.base)} />
          </clipPath>
        </defs>
        <path d={est} className="est up" clipPath={`url(#${cid}u)`} />
        <path d={est} className="est down" clipPath={`url(#${cid}d)`} />
        <circle
          cx={px(last[0])}
          cy={py(last[1])}
          r={3.5}
          className={`dot ${t}`}
        />
        <rect
          x={W - PAD.r + 2}
          y={py(last[1]) - 10}
          width={PAD.r - 2}
          height={20}
          rx={4}
          className={`tag ${t}`}
        />
        <text x={W - PAD.r + 6} y={py(last[1]) + 4} className="tagt">
          {fmt(last[1])}
        </text>
        {hp && (
          <g>
            <line
              x1={px(hp[0])}
              x2={px(hp[0])}
              y1={PAD.t}
              y2={H - PAD.b}
              className="cross"
            />
            <circle
              cx={px(hp[0])}
              cy={py(hp[1])}
              r={3}
              className={`dot ${tone(hp[1] - d.base)}`}
            />
          </g>
        )}
      </svg>
      <p className="nchart-read" aria-live="polite">
        {hp ? (
          <>
            {hhmm(hp[0])} · 추정{" "}
            <b className={tone(hp[1] - d.base)}>{fmt(hp[1])}</b> (
            {sign(hp[1] - d.base)}
            {fmt(((hp[1] - d.base) / d.base) * 100)}%)
            {hp[2] != null && <> · KR200 {fmt(hp[2])}</>}
          </>
        ) : (
          <>
            <span className="key est-key" /> 추정{" "}
            <span className="key kr-key" /> KR200 무기한선물{" "}
            <span className="key base-key" /> {baseName(d)}
          </>
        )}
      </p>
    </div>
  );
}

/** 캡처 공유에서 처음 골라 둘 카드(2026-11-10 SK) */
const CAP_PICK = ["night", "SMSN", "SKHX"];

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
      if (!stop) timer = setTimeout(tick, live.current ? 5_000 : 300_000);
    };
    tick();
    const vis = () =>
      document.visibilityState === "visible" && (clearTimeout(timer), tick());
    document.addEventListener("visibilitychange", vis);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const state: BoardState = d ? boardState(d.window, d.updated) : "night";
  const weekend = state === "weekend";
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
        {/* 주말에는 다음 주 일정이 평일보다 쓸모가 커서 맨 위에 둔다 */}
        {weekend && <ScheduleBand weekend />}
        <section
          className="card night"
          data-cap="night"
          data-cap-label="코스피 야간선물"
        >
          <div className="night-top">
            <h1 className="night-title">{titleOf(d, state)}</h1>
            {d && <span className="night-upd">{hhmm(d.updated)} 갱신</span>}
          </div>
          {weekend && (
            <p className="muted small-note night-wk">
              주말은 거래가 얇아 월요일 시가와의 오차가 평일보다 커질 수 있어요.
            </p>
          )}
          {d ? (
            <Main d={d} />
          ) : (
            <p className="muted">
              {err
                ? `자료를 불러오지 못했습니다. 잠시 뒤 다시 시도합니다. (${err})`
                : "불러오는 중…"}
            </p>
          )}
          {d && err && (
            <p className="muted small-note">
              마지막 갱신 뒤 자료를 받지 못했습니다.
            </p>
          )}
        </section>
        <Poll weekend={weekend} />
        <NightPnl d={d} />
        <Chat />
        <Dashboard d={d} />
        <TestBand />
        {!weekend && <ScheduleBand />}
        <div className="cap-only cap-foot">
          <span>해외 무기한선물로 계산한 참고용 추정치입니다</span>
          <b>kosnas.com</b>
        </div>
      </div>
      {d && !capturing && (
        // 트립날씨와 같은 떠 있는 버튼: 스크롤과 상관없이 화면 아래에 있다
        <div className="fab-bar">
          <InstallButton />
          <button
            type="button"
            className="fab"
            onClick={() => setCapturing(true)}
          >
            <i className="logo-dot" aria-hidden /> 캡처해서 공유
          </button>
        </div>
      )}
      {capturing && (
        <CaptureSheet
          target={target}
          fileName={`kosnas-dashboard-${stamp.toISOString().slice(0, 16).replace(/[-:T]/g, "")}.png`}
          shareTitle={`코스피 야간선물 실시간 추정 ${day} ${d ? hhmm(d.updated) : ""}`}
          // t: 카톡이 같은 주소의 미리보기(그 순간 추정값 그림)를 오래 기억하지 않게 자료 시각의 5분 단위로 바꾼다
          shareUrl={`https://kosnas.com/night?t=${Math.floor((d?.updated ?? 0) / 300_000).toString(36)}`}
          onClose={() => setCapturing(false)}
          pick={CAP_PICK}
        />
      )}
    </>
  );
}

/** 맨 위 카드 제목(2026-11-10 SK 사양표: 야간·장중·주말) */
function titleOf(d: NightData | null, state: BoardState) {
  if (state === "weekend") return "월요일 시작 추정가";
  if (state === "day" && d) return `${fromFriday(d) ? "주말 추정 vs 월요일" : "어젯밤 추정 vs 오늘"} 시가`;
  return "코스피 야간선물 실시간 추정";
}

/** 금요일 15:45에 시작한(주말을 낀) 구간인가 */
const fromFriday = (d: NightData) => new Date(d.window.start + 9 * 3600_000).getUTCDay() === 5;

function Main({ d }: { d: NightData }) {
  const state = boardState(d.window, d.updated);
  if (state === "day") return <DayMain d={d} />;
  const t = tone(d.chg);
  const basis = d.baseKind === "close" ? (state === "weekend" ? "금요일 종가 대비" : "주간 종가 대비") : "15:45 추정 대비";
  return (
    <>
      <div className="night-head">
        <div>
          <p className="muted">
            {basis} · 개장까지 {untilText(d.window.end, d.updated)}
          </p>
          <p className="night-price">
            <b className={t}>{fmt(d.est)}</b>
            {/* 사람들이 말하고 공유하는 건 등락률이라 가격과 같은 크기로 */}
            <b className={t}>
              {sign(d.chgPct)}
              {fmt(d.chgPct)}%
            </b>
            <span className={t}>
              {sign(d.chg)}
              {fmt(d.chg)}
            </span>
          </p>
        </div>
        <dl className="night-stats">
          <div>
            <dt>{state === "weekend" && d.baseKind === "close" ? "금요일 종가" : baseName(d)}</dt>
            <dd>{fmt(d.base)}</dd>
          </div>
          {d.at0600 != null && (
            <div>
              <dt>야간장 마감</dt>
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
        </dl>
      </div>
      <Chart d={d} />
      <p className="muted small-note">
        {d.method === "blend"
          ? "기준값은 15:45의 KR200 무기한선물 가격입니다. 기준가 자료를 받지 못해 이전 방식으로 계산했습니다. KRX 주간 선물 종가와는 평균 0.3% 안팎 차이가 날 수 있습니다."
          : d.baseKind === "close"
            ? "등락률은 KRX 코스피200 선물 주간 종가 대비입니다. 06:00까지는 KR200 무기한선물 기준가를 선물 수준으로 환산한 값이고, 그 뒤로는 EWY·KR200 무기한선물의 움직임을 반반 섞어 이어 갑니다."
            : "등락률은 15:45 추정값 대비입니다. KRX 주간 선물 종가가 반영되기 전(16:10쯤까지)이거나 분기 만기일, 또는 종가를 받지 못한 때입니다."}
      </p>
    </>
  );
}

/**
 * 장중(09:00~15:45): 지난밤(주말) 마지막 추정값과 오늘 KRX 코스피200 선물 주간 시가를 나란히.
 * 기준은 추정 오차(추정 − 시가). 시가는 네이버 시세가 20분 늦어 09:20쯤부터 보인다
 */
function DayMain({ d }: { d: NightData }) {
  const open = d.open ?? null;
  const err = open != null ? d.est - open : null;
  const errPct = open != null ? (d.est / open - 1) * 100 : null;
  // 방향: 추정과 시가가 전일 종가 대비 같은 쪽이었나(전일 종가를 받았을 때만)
  const hit = open != null && d.baseKind === "close" ? Math.sign(d.est - d.base) === Math.sign(open - d.base) : null;
  const night = fromFriday(d) ? "주말" : "어젯밤";
  return (
    <>
      <div className="night-head">
        <div>
          <p className="muted">
            추정 오차 · 오늘 밤 추정은 {hhmm(nextNightStart(d.updated))} 시작
          </p>
          <p className="night-price">
            {err != null && errPct != null ? (
              <>
                <b>
                  {sign(err)}
                  {fmt(err)}
                </b>
                <b>
                  {sign(errPct)}
                  {fmt(errPct)}%
                </b>
                {hit != null && <span className={hit ? "up" : "down"}>{hit ? "방향 맞음" : "방향 틀림"}</span>}
              </>
            ) : (
              <span className="muted">오늘 시가 집계 중 · 09:20쯤 반영</span>
            )}
          </p>
        </div>
        <dl className="night-stats">
          <div>
            <dt>{night} 추정</dt>
            <dd className={tone(d.est - d.base)}>{fmt(d.est)}</dd>
          </div>
          <div>
            <dt>오늘 시가</dt>
            <dd className={open != null ? tone(open - d.base) : ""}>{open != null ? fmt(open) : "-"}</dd>
          </div>
          <div>
            <dt>{d.baseKind === "close" ? (fromFriday(d) ? "금요일 종가" : "전일 종가") : baseName(d)}</dt>
            <dd>{fmt(d.base)}</dd>
          </div>
        </dl>
      </div>
      <Chart d={d} />
      <p className="muted small-note">
        추정 오차 = {night} {hhmm(d.window.end)} 추정값 − 오늘 KRX 코스피200 선물 주간 시가. 차트는 {night} 추정선이고, 오늘 밤 15:45부터 새 추정을 시작합니다.
      </p>
    </>
  );
}
