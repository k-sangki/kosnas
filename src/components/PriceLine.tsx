"use client";

import { useId } from "react";

/**
 * 상세 페이지의 가격 선. 점선(base)은 등락률 기준이고, 선은 점선 위 빨강·아래 파랑으로 나눠 그린다.
 * mark = 세로선 위치(0~1), label = 오른쪽 위·아래 끝 값 글자
 */
export function PriceLine({ v, t, base = v[0], mark, name, label }: { v: number[]; t?: number[]; base?: number; mark?: number; name: string; label: (p: number) => string }) {
  const W = 640;
  const H = 190;
  const P = { l: 8, r: 72, t: 12, b: 12 };
  const id = `pl${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const lo = Math.min(...v, base);
  const hi = Math.max(...v, base);
  const pad = (hi - lo) * 0.08 || base * 0.002;
  const y = (p: number) => P.t + (1 - (p - (lo - pad)) / (hi - lo + 2 * pad)) * (H - P.t - P.b);
  const xt = (f: number) => P.l + f * (W - P.l - P.r);
  const x = (n: number) => xt(t && t.length === v.length ? t[n] : n / (v.length - 1));
  const path = v.map((p, n) => `${n ? "L" : "M"}${x(n).toFixed(1)},${y(p).toFixed(1)}`).join("");
  const yb = y(base);
  return (
    <div className="nchart pchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} 가격 흐름`}>
        <defs>
          <clipPath id={`${id}u`}>
            <rect x={0} y={0} width={W} height={yb} />
          </clipPath>
          <clipPath id={`${id}d`}>
            <rect x={0} y={yb} width={W} height={H - yb} />
          </clipPath>
        </defs>
        <line x1={P.l} x2={W - P.r} y1={yb} y2={yb} className="grid" strokeDasharray="4 4" />
        {mark != null && <line x1={xt(mark)} x2={xt(mark)} y1={P.t} y2={H - P.b} className="grid" />}
        <path d={path} className="stroke up" clipPath={`url(#${id}u)`} />
        <path d={path} className="stroke down" clipPath={`url(#${id}d)`} />
        <text x={W - P.r + 6} y={y(hi) + 4} className="ylab">
          {label(hi)}
        </text>
        <text x={W - P.r + 6} y={y(lo) + 4} className="ylab">
          {label(lo)}
        </text>
      </svg>
    </div>
  );
}
