"use client";

import { useEffect, useRef, useState } from "react";
import { hhmm, type NightData } from "@/lib/night";
import type { LiveQuote } from "@/lib/live-quotes";
import { PriceLine } from "./PriceLine";

const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");
const sign = (v: number) => (v > 0 ? "+" : "");
const num = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KST = 9 * 3600_000;
/** 기준 시각을 한국 시각 'M/D HH:MM'으로 */
const at = (ms: number) => {
  const d = new Date(ms + KST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hhmm(ms)}`;
};

/** 24시간 시세 한 종목(/api/night 의 extra). 30초마다(장중·주말처럼 구간이 끝났으면 5분마다) 다시 읽는다 */
export function LiveQuoteView({ q }: { q: Pick<LiveQuote, "coin" | "name" | "unit" | "basis"> }) {
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

  const x = d?.extra?.[q.coin];
  const base = x?.prev ?? null;
  const chg = x && base ? (x.price / base - 1) * 100 : null;
  const u = q.unit ?? "";
  return (
    <section className="card night">
      <h1 className="night-title">{q.name} 실시간</h1>
      {!d ? (
        <p className="muted">{err ? `자료를 불러오지 못했습니다. 잠시 뒤 다시 시도합니다. (${err})` : "불러오는 중…"}</p>
      ) : !x ? (
        <p className="muted">지금은 {q.name} 가격을 받지 못했습니다.</p>
      ) : (
        <>
          <div className="night-head">
            <div>
              <p className="muted">실시간 · 30초마다 갱신 · 주말에도 거래</p>
              <p className="night-price">
                <b className={tone(chg ?? 0)}>
                  {u}
                  {num(x.price)}
                </b>
                {chg != null && base && (
                  <span className={tone(chg)}>
                    {sign(chg)}
                    {num(x.price - base)} ({sign(chg)}
                    {chg.toFixed(2)}%)
                  </span>
                )}
              </p>
            </div>
            <dl className="night-stats">
              <div>
                <dt>기준</dt>
                <dd>{x.prevAt ? q.basis : "24시간 전 대비"}</dd>
              </div>
              <div>
                <dt>기준 가격</dt>
                <dd>{base ? `${u}${num(base)}` : "-"}</dd>
              </div>
              {x.prevAt && (
                <div>
                  <dt>기준 시각</dt>
                  <dd>{at(x.prevAt)}</dd>
                </div>
              )}
              <div>
                <dt>갱신</dt>
                <dd>{hhmm(d.updated)}</dd>
              </div>
            </dl>
          </div>
          {x.spark && x.spark.length > 1 && <PriceLine v={x.spark} t={x.sparkT} base={base ?? undefined} name={q.name} label={(p) => `${u}${num(p)}`} />}
          <p className="muted small-note">
            가로축은 한국 시각 15:45부터 다음 국내 개장(09:00)까지이고, 점선은 등락률 기준 가격이에요. 점선 위는 빨강, 아래는 파랑입니다. 해외 무기한선물로 본 참고값이며 정규 거래소
            시세와 다를 수 있습니다.
          </p>
        </>
      )}
      {d && err && <p className="muted small-note">마지막 갱신 뒤 자료를 받지 못했습니다.</p>}
    </section>
  );
}
