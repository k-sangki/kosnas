"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MASTERS,
  decodePcts,
  findMaster,
  findResult,
  type ResultId,
  type TypeId,
} from "@/lib/invest-test";
import { CaptureSheet } from "./CaptureSheet";
import { LogoSvg } from "./Logo";

/**
 * 결과 카드. 휴대폰 한 화면에 들어가게: 가장 닮은 대가를 크게, 나머지 7명은 게이지로.
 * 대가별 비중(%, 8명 합계 100)은 주소의 ?s= 에 실려 와서, 공유받은 사람도 같은 카드를 본다. 없으면 게이지 없이 대가만.
 */
export function TestResult({ id }: { id: ResultId }) {
  const m = findResult(id)!;
  const ant = id === "ant";
  const ref = useRef<HTMLDivElement>(null);
  const target = useCallback(() => ref.current, []);
  const [{ s, a }, setQ] = useState<{ s: string | null; a: number | null }>({
    s: null,
    a: null,
  });
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    // 주소의 ?s=(대가 비중)·?a=(개미력)는 화면이 뜬 뒤에만 읽는다(정적 페이지)
    const q = new URLSearchParams(location.search);
    const n = Number(q.get("a"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 위와 같은 이유
    setQ({
      s: q.get("s"),
      a:
        q.get("a") != null && Number.isFinite(n)
          ? Math.max(0, Math.min(100, Math.round(n)))
          : null,
    });
  }, []);

  const pcts = decodePcts(s);
  // 개미형은 칩에 개미력, 대가형은 그 대가 비중. 게이지는 0%인 대가를 뺀다
  const mine = ant ? a : pcts?.find((p) => p.id === id)?.pct;
  const best = ant ? findMaster(pcts?.[0]?.id ?? "") : findMaster(id);
  // 원형 차트: 0%가 아닌 대가 모두(가장 닮은 대가 포함, 합계 100%)
  const slices = (pcts ?? []).filter((p) => p.pct > 0);
  const query = [s && `s=${s}`, a != null && `a=${a}`]
    .filter(Boolean)
    .join("&");
  const shareUrl = `https://kosnas.com/test/${id}${query ? `?${query}` : ""}`;

  return (
    <>
      <div className="tr-wrap" ref={ref}>
        <section className="card tr-card">
          <div className="tr-head">
            <LogoSvg />
            <span>나의 투자 성향</span>
          </div>
          <div className="tr-hero">
            <span className="tr-emoji" aria-hidden>
              {m.emoji}
            </span>
            <h1 className="tr-name">
              {m.name}형
              {mine != null && (
                <span className="tr-pct">
                  {ant ? `개미력 ${mine}%` : `${mine}%`}
                </span>
              )}
            </h1>
            <p className="tr-nick">&ldquo;{m.nick}&rdquo;</p>
            <p className="tr-line">{m.line}</p>
            <p className="tr-traits">
              {m.traits.map((t) => (
                <span key={t}>{t}</span>
              ))}
              {!ant && a != null && a > 0 && <span>🐜 개미력 {a}%</span>}
            </p>
          </div>
          {slices.length > 0 && (
            <div className="tr-gauges">
              <p className="tr-sub">
                {ant ? "그래도 닮은 대가" : "대가별 비중"} · 합계 100%
              </p>
              <div className="tr-pie">
                <Pie slices={slices} />
                <ul className="tr-legend">
                  {slices.map((o) => {
                    const x = MASTERS.find((y) => y.id === o.id)!;
                    return (
                      <li key={o.id} className={o.id === id ? "on" : ""}>
                        <i
                          style={{ background: PIE_COLORS[o.id] }}
                          aria-hidden
                        />
                        <span className="tr-g-name">
                          {x.name.split(" ").pop()}
                        </span>
                        <b>{o.pct}%</b>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
          <p className="tr-foot">
            <span>나도 해보기</span>
            <b>kosnas.com/test</b>
          </p>
        </section>
      </div>
      <div className="tr-actions no-capture">
        <button
          type="button"
          className="it-start"
          onClick={() => setCapturing(true)}
        >
          📸 캡처해서 공유
        </button>
        <div className="tr-row">
          <Link href="/test" className="tr-btn">
            {s ? "다시 하기" : "나도 해보기"}
          </Link>
          <Link href="/" className="tr-btn">
            대시보드
          </Link>
        </div>
        {best && (
          <Link href={`/investors/${best.id}`} className="tr-btn tr-link">
            {ant
              ? `그래도 가장 닮은 ${best.name}의 포트폴리오 ›`
              : `${best.name}의 실제 포트폴리오 보기 ›`}
          </Link>
        )}
      </div>
      {capturing && (
        <CaptureSheet
          target={target}
          fileName={`kosnas-test-${id}.png`}
          shareTitle={`나는 ${m.name}형 · ${m.nick}`}
          shareUrl={shareUrl}
          onClose={() => setCapturing(false)}
        />
      )}
    </>
  );
}

/** 대가마다 정해 둔 조각 색(라이트·다크 모두 흰 글씨가 읽히는 진한 색) */
const PIE_COLORS: Record<TypeId, string> = {
  buffett: "#3b7bff",
  wood: "#f2711c",
  burry: "#7d8590",
  druckenmiller: "#e0a800",
  dalio: "#14a3c7",
  marks: "#20a464",
  ackman: "#e5484d",
  icahn: "#8e5cf0",
};

/** 원형 차트(SVG). 8% 이상인 조각에만 안쪽에 % 를 적는다 */
function Pie({ slices }: { slices: { id: TypeId; pct: number }[] }) {
  const R = 50;
  const total = slices.reduce((t, x) => t + x.pct, 0) || 1;
  // 조각마다 시작 비율(누적)
  const starts = slices.map(
    (_, i) => slices.slice(0, i).reduce((t, x) => t + x.pct, 0) / total,
  );
  const pt = (f: number, r: number) => {
    const t = 2 * Math.PI * f - Math.PI / 2;
    return [60 + r * Math.cos(t), 60 + r * Math.sin(t)];
  };
  return (
    <svg
      className="tr-pie-svg"
      viewBox="0 0 120 120"
      role="img"
      aria-label="대가별 비중 원형 차트"
    >
      {slices.map((x, i) => {
        const f0 = starts[i];
        const f1 = f0 + x.pct / total;
        const [mx, my] = pt((f0 + f1) / 2, R * 0.64);
        const shape =
          f1 - f0 >= 0.9999 ? (
            <circle cx={60} cy={60} r={R} fill={PIE_COLORS[x.id]} />
          ) : (
            (() => {
              const [x0, y0] = pt(f0, R);
              const [x1, y1] = pt(f1, R);
              return (
                <path
                  d={`M60 60 L${x0} ${y0} A${R} ${R} 0 ${f1 - f0 > 0.5 ? 1 : 0} 1 ${x1} ${y1} Z`}
                  fill={PIE_COLORS[x.id]}
                  stroke="var(--card)"
                  strokeWidth={1.2}
                />
              );
            })()
          );
        return (
          <g key={x.id}>
            {shape}
            {x.pct >= 8 && (
              <text
                x={mx}
                y={my}
                className="tr-pie-label"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {x.pct}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
