"use client";

import { useEffect, useState } from "react";
import data from "@/data/fear-greed.json";
import { Fold } from "./Fold";
import { bandOf, BANDS, type FgSummary } from "@/lib/fear-greed";

type Market = { all: FgSummary; semi: FgSummary };
const D = data as unknown as { updated: string; kr: Market; us: Market };

/** 전체 ↔ 반도체를 번갈아 보이는 간격(2026-11-24 SK: 3초씩) */
const ROTATE_MS = 3000;

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
  const diff = s.score - s.week;
  return (
    <svg viewBox="0 0 200 124" role="img" aria-label={`${label} 공포·탐욕 추정 ${s.score}, ${band.name}. 1주 전 ${s.week}`}>
      {BANDS.map((b) => (
        <path key={b.name} d={arc(b.from + 0.6, b.to - 0.6)} className={`fg-band fg-${b.tone}${b === band ? " on" : ""}`} />
      ))}
      {[0, 50, 100].map((v) => {
        const [x, y] = pt(v, R_IN - 9);
        return (
          <text key={v} x={x} y={y + 3} className="fg-tick" textAnchor={v === 0 ? "start" : v === 100 ? "end" : "middle"}>
            {v}
          </text>
        );
      })}
      {/* 1주 전 바늘(흐리게) → 지금 바늘. 둘을 같이 보면 어느 쪽으로 움직였는지 보인다 */}
      <path d={NEEDLE} className="fg-needle ghost" style={{ transform: `rotate(${s.week * 1.8}deg)` }} />
      <path d={NEEDLE} className="fg-needle" style={{ transform: `rotate(${s.score * 1.8}deg)` }} />
      <circle cx={CX} cy={CY} r={21} className="fg-hub" />
      <text x={CX} y={CY + 8} className="fg-num" textAnchor="middle">
        {s.score}
      </text>
      <title>{`1주 전 ${s.week} → 지금 ${s.score} (${diff > 0 ? "+" : ""}${diff})`}</title>
    </svg>
  );
}

function Panel({ name, m, semi, onTap }: { name: string; m: Market; semi: boolean; onTap: () => void }) {
  const s = semi ? m.semi : m.all;
  if (!s) return null;
  const band = bandOf(s.score);
  const diff = s.score - s.week;
  const md = `${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8, 10))}`;
  return (
    <button type="button" className="fg-panel" onClick={onTap} aria-label={`${name} ${semi ? "반도체" : "전체"} — 눌러서 바꾸기`}>
      <span className="fg-head">
        <b>{name}</b>
        <span className="fg-kind">
          <i className={semi ? "" : "on"}>전체</i>
          <i className={semi ? "on" : ""}>반도체</i>
        </span>
      </span>
      <Gauge s={s} label={`${name} ${semi ? "반도체" : "전체"}`} />
      <span className={`fg-name fg-t-${band.tone}`}>{band.name}</span>
      <span className="fg-sub">
        <i className="fg-ghost-key" aria-hidden />1주 전 {s.week}{" "}
        <b className={diff > 0 ? "up" : diff < 0 ? "down" : ""}>
          {diff > 0 ? "▲" : diff < 0 ? "▼" : "−"}
          {Math.abs(diff) || ""}
        </b>{" "}
        · {md}
      </span>
    </button>
  );
}

/** 국장·미장 공포·탐욕 지수 추정 계기판. 전체와 반도체를 3초씩 번갈아 보인다(누르면 바로 바뀜) */
export function FearGreed() {
  const [semi, setSemi] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSemi((v) => !v), ROTATE_MS);
    return () => clearInterval(t);
  }, [tick]);
  if (!D?.kr?.all || !D?.us?.all) return null;
  const tap = () => {
    setSemi((v) => !v);
    setTick((n) => n + 1); // 누른 뒤 다시 3초를 센다
  };
  return (
    <section className="card fg" data-cap="fg" data-cap-label="공포·탐욕 지수">
      <h2 className="fg-title">
        공포·탐욕 지수 <span className="muted">추정</span>
      </h2>
      <div className="fg-grid">
        <Panel name="국장" m={D.kr} semi={semi} onTap={tap} />
        <Panel name="미장" m={D.us} semi={semi} onTap={tap} />
      </div>
      <Fold small title="계산 방법">
        <p className="muted small-note">
          KosNas가 일봉으로 직접 계산한 추정치이며 CNN 공포·탐욕 지수와 같은 값이 아닙니다. 다섯 항목을 0~100으로 바꿔 평균합니다(높을수록 탐욕). ① 종가의
          125일 이동평균 대비 괴리 ② 52주 고저 사이 위치 ③ RSI 14일 ④ 변동성(미장 전체는 VIX, 나머지는 20일 실현 변동성 — 낮을수록 탐욕) ⑤ 20일 수익률에서
          국채 ETF 20일 수익률을 뺀 값. ①④⑤는 지난 1년 안의 백분위입니다. 국장 전체는 코스피200, 국장 반도체는 TIGER 반도체TOP10, 미장 전체는 S&amp;P 500,
          미장 반도체는 iShares 반도체 ETF(SOXX)로 계산합니다. 흐린 바늘은 1주(5거래일) 전 값이고, 하루 두 번(16:20·07:20쯤) 종가로 다시 계산합니다.
          과거 통계로 만든 참고 지표이며 매수·매도를 권하지 않습니다.
        </p>
      </Fold>
    </section>
  );
}
