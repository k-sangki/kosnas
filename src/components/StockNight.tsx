"use client";

import { useEffect, useRef, useState } from "react";
import { hhmm, type NightData } from "@/lib/night";

const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");
const sign = (v: number) => (v > 0 ? "+" : "");

/**
 * 한 종목의 밤사이 가격(무기한선물 원화 환산). 야간 화면과 같은 /api/night 를 받는다.
 * 원천이 엣지 캐시라 15초마다(장중·주말처럼 구간이 끝났으면 5분마다) 다시 읽는다.
 */
export function StockNight({ coin, name }: { coin: string; name: string }) {
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

  const i = d?.inputs.find((x) => x.coin === coin);
  return (
    <section className="card night">
      <h1 className="night-title">{name} 야간 시세 실시간 추정</h1>
      {!d ? (
        <p className="muted">{err ? `자료를 불러오지 못했습니다. 잠시 뒤 다시 시도합니다. (${err})` : "불러오는 중…"}</p>
      ) : !i || i.krw == null ? (
        <p className="muted">지금은 {name} 무기한선물 가격을 받지 못했습니다.</p>
      ) : (
        <>
          <div className="night-head">
            <div>
              <p className="muted">{d.window.live ? "실시간 · 15초마다 갱신" : `지난밤 · ${hhmm(d.window.end)} 국내 개장 전까지`}</p>
              <p className="night-price">
                <b className={tone(i.chg ?? 0)}>{i.krw.toLocaleString()}원</b>
                {i.chg != null && (
                  <span className={tone(i.chg)}>
                    {sign(i.chg)}
                    {Math.round(i.krw - i.krw / (1 + i.chg / 100)).toLocaleString()}원 ({sign(i.chg)}
                    {i.chg.toFixed(2)}%)
                  </span>
                )}
              </p>
            </div>
            <dl className="night-stats">
              <div>
                <dt>달러 가격</dt>
                <dd>${i.price.toFixed(2)}</dd>
              </div>
              <div>
                <dt>기준</dt>
                <dd>15:45 대비</dd>
              </div>
              <div>
                <dt>갱신</dt>
                <dd>{hhmm(d.updated)}</dd>
              </div>
            </dl>
          </div>
          {i.spark && i.spark.length > 1 && <Line v={i.spark} t={i.sparkT} k={i.krw / i.price} name={name} />}
          <p className="muted small-note">
            가로축은 15:45부터 다음 국내 개장(09:00)까지이고, 점선은 15:45 가격입니다. 해외 무기한선물로 계산한 참고값이며 실제 주가와 다를 수 있습니다.
          </p>
        </>
      )}
      {d && err && <p className="muted small-note">마지막 갱신 뒤 자료를 받지 못했습니다.</p>}
    </section>
  );
}

/** 15:45부터의 가격 선(원화). k = 원화 ÷ 달러 */
function Line({ v, t, k, name }: { v: number[]; t?: number[]; k: number; name: string }) {
  const W = 640;
  const H = 200;
  const P = { l: 8, r: 72, t: 12, b: 12 };
  const base = v[0];
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const pad = (hi - lo) * 0.08 || base * 0.002;
  const y = (p: number) => P.t + (1 - (p - (lo - pad)) / (hi - lo + 2 * pad)) * (H - P.t - P.b);
  const x = (n: number) => P.l + (t && t.length === v.length ? t[n] : n / (v.length - 1)) * (W - P.l - P.r);
  const path = v.map((p, n) => `${n ? "L" : "M"}${x(n).toFixed(1)},${y(p).toFixed(1)}`).join("");
  const end = v[v.length - 1];
  const won = (p: number) => `${Math.round(p * k).toLocaleString()}`;
  return (
    <div className="nchart pchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} 15:45 이후 가격 흐름`}>
        <line x1={P.l} x2={W - P.r} y1={y(base)} y2={y(base)} className="grid" strokeDasharray="4 4" />
        <path d={path} className={`stroke ${tone(end - base) || "up"}`} />
        <text x={W - P.r + 6} y={y(hi) + 4} className="ylab">
          {won(hi)}
        </text>
        <text x={W - P.r + 6} y={y(lo) + 4} className="ylab">
          {won(lo)}
        </text>
      </svg>
    </div>
  );
}
