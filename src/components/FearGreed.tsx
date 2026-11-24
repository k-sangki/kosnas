"use client";

import { useState } from "react";
import data from "@/data/fear-greed.json";
import { bandOf, BANDS, type FgSummary } from "@/lib/fear-greed";

type Market = { all: FgSummary; semi: FgSummary };
const D = data as unknown as { updated: string; kr: Market; us: Market };

const CX = 100;
const CY = 100;
const R_OUT = 94;
const R_IN = 66;

/** 값(0~100) → 원 위의 점. 0은 왼쪽 끝, 100은 오른쪽 끝 */
function pt(v: number, r: number): [number, number] {
  const a = Math.PI * (1 - v / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}

function arc(a: number, b: number) {
  const [x1, y1] = pt(a, R_OUT);
  const [x2, y2] = pt(b, R_OUT);
  const [x3, y3] = pt(b, R_IN);
  const [x4, y4] = pt(a, R_IN);
  const f = (n: number) => n.toFixed(2);
  return `M${f(x1)},${f(y1)}A${R_OUT},${R_OUT} 0 0 1 ${f(x2)},${f(y2)}L${f(x3)},${f(y3)}A${R_IN},${R_IN} 0 0 0 ${f(x4)},${f(y4)}Z`;
}

/** 왼쪽(0)을 가리키는 바늘. 값만큼 시계 방향으로 돌린다 */
const NEEDLE = `M${CX},${CY - 4.5}L${CX - 80},${CY}L${CX},${CY + 4.5}Z`;

function Gauge({ s, label }: { s: FgSummary; label: string }) {
  const band = bandOf(s.score);
  return (
    <svg viewBox="0 0 200 104" className="fg-gauge" role="img" aria-label={`${label} 공포·탐욕 추정 ${s.score}, ${band.name}. 1주 전 ${s.week}`}>
      {BANDS.map((b) => (
        <path key={b.name} d={arc(b.from + 0.8, b.to - 0.8)} className={`fg-band fg-${b.tone}${b === band ? " on" : ""}`} />
      ))}
      {/* 1주 전 바늘(흐리게) → 지금 바늘. 둘을 같이 보면 어느 쪽으로 움직였는지 보인다 */}
      <path d={NEEDLE} className="fg-needle ghost" style={{ transform: `rotate(${s.week * 1.8}deg)` }} />
      <path d={NEEDLE} className="fg-needle" style={{ transform: `rotate(${s.score * 1.8}deg)` }} />
      <circle cx={CX} cy={CY} r={7} className="fg-hub" />
    </svg>
  );
}

/** 막대형(시안 B): 0~100 띠 위에 지금(진한 점)과 1주 전(흐린 점) */
function Bar({ s }: { s: FgSummary }) {
  return (
    <span className="fg-bar" aria-hidden>
      <i className="fg-bar-mark ghost" style={{ left: `${s.week}%` }} />
      <i className="fg-bar-mark" style={{ left: `${s.score}%` }} />
    </span>
  );
}

function Panel({ name, s, kind, bar }: { name: string; s: FgSummary; kind: string; bar: boolean }) {
  const band = bandOf(s.score);
  const diff = s.score - s.week;
  const md = `${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8, 10))}`;
  const change = (
    <span className="fg-sub" title={`${md} 기준`}>
      1주 전 {s.week}{" "}
      <b className={diff > 0 ? "up" : diff < 0 ? "down" : ""}>
        {diff > 0 ? "▲" : diff < 0 ? "▼" : "−"}
        {Math.abs(diff) || ""}
      </b>
    </span>
  );
  if (bar)
    return (
      <div className="fg-row">
        <b className="fg-mkt">{name}</b>
        <Bar s={s} />
        <span className="fg-val">
          <b className={`fg-num fg-t-${band.tone}`}>{s.score}</b> <span className={`fg-name fg-t-${band.tone}`}>{band.name}</span>
        </span>
        {change}
      </div>
    );
  return (
    <div className="fg-panel">
      <Gauge s={s} label={`${name} ${kind}`} />
      <div className="fg-text">
        <span className="fg-val">
          <b className="fg-mkt">{name}</b> <b className={`fg-num fg-t-${band.tone}`}>{s.score}</b>
        </span>
        <span className={`fg-name fg-t-${band.tone}`}>{band.name}</span>
        {change}
      </div>
    </div>
  );
}

/** 시안 B(막대형)를 보려면 true */
const BAR = false;

/**
 * 국장·미장 공포·탐욕 지수 추정. 전체가 기본이고 오른쪽 단추로 반도체를 고른다(2026-11-24 SK: 자동 전환 없이).
 * 계산 방법은 아래 설명 글(NightContent)에 접어 두었다.
 */
export function FearGreed() {
  const [semi, setSemi] = useState(false);
  if (!D?.kr?.all || !D?.us?.all) return null;
  const k = semi ? "semi" : "all";
  const kind = semi ? "반도체" : "전체";
  return (
    <section className={`card fg${BAR ? " fg-b" : ""}`} data-cap="fg" data-cap-label="공포·탐욕 지수">
      <div className="fg-top">
        <h2 className="fg-title">
          공포·탐욕 지수 <span className="muted">자체 추정</span>
        </h2>
        <span className="fg-kind" role="group" aria-label="전체·반도체">
          {(["all", "semi"] as const).map((x) => (
            <button key={x} type="button" className={k === x ? "on" : ""} aria-pressed={k === x} onClick={() => setSemi(x === "semi")}>
              {x === "all" ? "전체" : "반도체"}
            </button>
          ))}
        </span>
      </div>
      <div className="fg-grid">
        <Panel name="국장" s={D.kr[k]} kind={kind} bar={BAR} />
        <Panel name="미장" s={D.us[k]} kind={kind} bar={BAR} />
      </div>
    </section>
  );
}
