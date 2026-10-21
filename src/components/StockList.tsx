"use client";

import { useEffect, useState } from "react";
import { loadKrStocks } from "@/lib/kr-stocks";
import { signed, type Stock } from "@/lib/sectors";
import { TvMini } from "./TvWidget";

/** 수정 종가 열로 그리는 선 차트. 국내 종목은 트레이딩뷰 위젯이 외부 사이트에 열리지 않아 직접 그린다 */
export function PriceChart({ s, from, asof }: { s: Stock; from?: string; asof: string }) {
  const pts = (s.spark ?? []).map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return null;
  const W = 320;
  const H = 140;
  const lo = Math.min(...pts.map((p) => p[1]));
  const hi = Math.max(...pts.map((p) => p[1]));
  const n = (s.spark?.length ?? 1) - 1 || 1;
  const px = (i: number) => (i / n) * W;
  const py = (v: number) => 8 + (1 - (v - lo) / (hi - lo || 1)) * (H - 16);
  const line = pts.map(([i, v], k) => `${k ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join("");
  const first = pts[0][1];
  const up = s.close != null && s.close >= first;
  const code = s.code.replace(/^[A-Z]+:/, "");
  return (
    <div className="pchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.name} 최근 종가 차트`}>
        <path d={`${line}L${W},${H}L0,${H}Z`} className={`area ${up ? "up" : "down"}`} />
        <path d={line} className={`stroke ${up ? "up" : "down"}`} />
      </svg>
      <p className="muted small-note">
        {from ?? ""} ~ {asof} 종가 · 최고 {hi.toLocaleString()} · 최저 {lo.toLocaleString()}원 ·{" "}
        <a href={`https://finance.naver.com/item/main.naver?code=${code}`} target="_blank" rel="noopener nofollow" className="inline-link">
          네이버 증권
        </a>{" "}
        ·{" "}
        <a href={`https://kr.tradingview.com/symbols/KRX-${code}/`} target="_blank" rel="noopener nofollow" className="inline-link">
          트레이딩뷰
        </a>
      </p>
    </div>
  );
}

/** 국내 종목 차트: 종목 자료에 차트 열이 없으면 검색 자료에서 받아 그린다 */
function KrChart({ s, from, asof }: { s: Stock; from?: string; asof: string }) {
  const [spark, setSpark] = useState(s.spark);
  const [range, setRange] = useState({ from, asof });
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (s.spark) return;
    loadKrStocks()
      .then((d) => {
        setSpark(d.byCode.get(s.code)?.spark);
        setRange({ from: d.sparkFrom, asof: d.asof });
      })
      .catch(() => setErr(true));
  }, [s.code, s.spark]);
  if (err) return <p className="muted small-note">차트 자료를 받지 못했습니다.</p>;
  if (!spark) return <p className="muted small-note">차트를 불러오는 중…</p>;
  return <PriceChart s={{ ...s, spark }} from={range.from} asof={range.asof} />;
}

/**
 * 섹터 종목 목록. 누른 종목만 차트를 연다(한꺼번에 띄우면 모바일에서 느려진다).
 * 국내는 금융위 시세로 직접 그리고, 미국은 트레이딩뷰 위젯을 쓴다.
 */
export function StockList({
  stocks,
  from,
  asof = "",
  period,
  showInd = false,
}: {
  stocks: Stock[];
  from?: string;
  asof?: string;
  /** 주면 종목 아래에 그 기간 수익률·52주 고가 대비를 적는다 */
  period?: number;
  showInd?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="stocks">
      {stocks.map((s) => (
        <li key={s.code}>
          <button className="stock-row" aria-expanded={open === s.code} onClick={() => setOpen(open === s.code ? null : s.code)}>
            <span className="stock-name">
              {s.name}
              {period != null && s.r && (
                <small className="muted stock-sub">
                  {showInd && s.ind ? `${s.ind} · ` : ""}
                  {period}일 {signed(s.r[period])}%{s.fromHigh != null ? ` · 52주 고점 ${signed(s.fromHigh)}%` : ""}
                </small>
              )}
            </span>
            {s.close != null ? (
              <span className={`num ${(s.chg ?? 0) >= 0 ? "up" : "down"}`}>
                {s.close.toLocaleString()} {s.chg != null && `${s.chg > 0 ? "+" : ""}${s.chg.toFixed(2)}%`}
              </span>
            ) : (
              <span className="muted">{s.code.replace(/^[A-Z]+:/, "")}</span>
            )}
            <span className={`rs${s.rs >= 80 ? " hi" : ""}`}>RS {s.rs}</span>
            <i className="tri" aria-hidden />
          </button>
          {/* 트레이딩뷰 무료 위젯은 국내(KRX) 심볼을 외부 사이트에 보여주지 않으므로 국내 종목에는 쓰지 않는다 */}
          {open === s.code && (s.tv.startsWith("KRX:") ? <KrChart s={s} from={from} asof={asof} /> : <TvMini symbol={s.tv} />)}
        </li>
      ))}
    </ul>
  );
}
