"use client";

import { useEffect, useRef, useState } from "react";
import { hhmm, type NightData } from "@/lib/night";

const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");
const sign = (v: number) => (v > 0 ? "+" : "");
const usd = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ITEMS = [
  { coin: "CL", name: "WTI 원유", short: "WTI" },
  { coin: "BRENTOIL", name: "브렌트유", short: "브렌트" },
] as const;

/**
 * 주말 유가. 야간 화면과 같은 /api/night 의 원자재 무기한선물(trade.xyz)을 쓴다.
 * 주말(금요일 CME 마감 뒤 ~ 월요일 국내 09:00)에는 금요일 마감 대비, 그 밖에는 24시간 전 대비.
 */
export function WeekendOil() {
  const [d, setD] = useState<NightData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const live = useRef(true);

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
      if (!stop) timer = setTimeout(tick, live.current ? 30_000 : 300_000);
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

  const weekend = ITEMS.some((it) => d?.extra?.[it.coin]?.wk);
  return (
    <section className="card night">
      <h1 className="night-title">주말 유가 실시간 · 주말에도 확인하는 WTI 추정치</h1>
      {!d ? (
        <p className="muted">{err ? `자료를 불러오지 못했습니다. 잠시 뒤 다시 시도합니다. (${err})` : "불러오는 중…"}</p>
      ) : (
        <>
          <p className="muted">
            {weekend ? "주말 거래 중 · 금요일 뉴욕 마감 대비 · 추정치" : "평일 · 24시간 전 대비"} · {hhmm(d.updated)} 갱신
          </p>
          {ITEMS.map((it) => {
            const x = d.extra?.[it.coin];
            if (!x) return <p key={it.coin} className="muted">{it.name} 가격을 받지 못했습니다.</p>;
            const base = x.wk?.close ?? x.prev;
            const chg = base ? (x.price / base - 1) * 100 : null;
            return (
              <div key={it.coin} className="woil">
                <div className="night-head">
                  <div>
                    <h2 className="woil-name">{it.name}</h2>
                    <p className="night-price">
                      <b className={tone(chg ?? 0)}>${usd(x.price)}</b>
                      {chg != null && base && (
                        <span className={tone(chg)}>
                          {sign(chg)}
                          {usd(x.price - base)} ({sign(chg)}
                          {chg.toFixed(2)}%)
                        </span>
                      )}
                    </p>
                  </div>
                  <dl className="night-stats">
                    <div>
                      <dt>{x.wk ? "금요일 마감" : "24시간 전"}</dt>
                      <dd>{base ? `$${usd(base)}` : "-"}</dd>
                    </div>
                    {x.wk && (
                      <div>
                        <dt>마감 시각</dt>
                        <dd>토 {hhmm(x.wk.at)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
                {x.spark && x.spark.length > 1 && <Line v={x.spark} t={x.sparkT} base={x.wk?.close} mark={x.wk?.atT} name={it.name} />}
              </div>
            );
          })}
          <p className="muted small-note">
            {weekend
              ? "가로축은 금요일 15:45부터 월요일 09:00(한국 시각)까지, 점선은 금요일 뉴욕 마감(한국 시각 토요일 새벽) 가격, 세로선은 그 시각입니다."
              : "가로축은 15:45부터 다음 국내 개장(09:00)까지입니다."}{" "}
            정규 거래소(CME) 시세가 아니라 주말에도 거래되는 해외 무기한선물 가격이라 실제 월요일 시가와 다를 수 있습니다.
          </p>
        </>
      )}
      {d && err && <p className="muted small-note">마지막 갱신 뒤 자료를 받지 못했습니다.</p>}
    </section>
  );
}

function Line({ v, t, base = v[0], mark, name }: { v: number[]; t?: number[]; base?: number; mark?: number; name: string }) {
  const W = 640;
  const H = 180;
  const P = { l: 8, r: 64, t: 12, b: 12 };
  const lo = Math.min(...v, base);
  const hi = Math.max(...v, base);
  const pad = (hi - lo) * 0.08 || base * 0.002;
  const y = (p: number) => P.t + (1 - (p - (lo - pad)) / (hi - lo + 2 * pad)) * (H - P.t - P.b);
  const xt = (f: number) => P.l + f * (W - P.l - P.r);
  const x = (n: number) => xt(t && t.length === v.length ? t[n] : n / (v.length - 1));
  const path = v.map((p, n) => `${n ? "L" : "M"}${x(n).toFixed(1)},${y(p).toFixed(1)}`).join("");
  const end = v[v.length - 1];
  return (
    <div className="nchart pchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} 가격 흐름`}>
        <line x1={P.l} x2={W - P.r} y1={y(base)} y2={y(base)} className="grid" strokeDasharray="4 4" />
        {mark != null && <line x1={xt(mark)} x2={xt(mark)} y1={P.t} y2={H - P.b} className="grid" />}
        <path d={path} className={`stroke ${tone(end - base) || "up"}`} />
        <text x={W - P.r + 6} y={y(hi) + 4} className="ylab">
          {usd(hi)}
        </text>
        <text x={W - P.r + 6} y={y(lo) + 4} className="ylab">
          {usd(lo)}
        </text>
      </svg>
    </div>
  );
}
