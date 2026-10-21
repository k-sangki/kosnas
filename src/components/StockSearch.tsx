"use client";

import Link from "next/link";
import { useState } from "react";
import { loadKrStocks, searchStocks, type KrStock, type KrStocks } from "@/lib/kr-stocks";
import { signed } from "@/lib/sectors";
import { PriceChart } from "./StockList";

function StockCard({ s, d, sectorName }: { s: KrStock; d: KrStocks; sectorName: Record<string, string> }) {
  return (
    <div className="sc">
      <div className="sc-head">
        <div>
          <b className="sc-name">{s.name}</b>
          <span className="muted">
            {" "}
            {s.code} · {s.market === "KOSPI" ? "코스피" : "코스닥"}
          </span>
        </div>
        {s.rs != null && <span className={`rs${s.rs >= 80 ? " hi" : ""}`}>RS {s.rs}</span>}
      </div>
      <p className={`sc-price ${(s.chg ?? 0) >= 0 ? "up" : "down"}`}>
        {s.close.toLocaleString()}원 <small>{signed(s.chg, 2)}%</small>
      </p>
      {s.sector && (
        <p className="sc-line">
          <Link href={`/kr/sector/${s.sector}`} className="inline-link">
            {sectorName[s.sector] ?? s.sector}
          </Link>
          {s.industry && <span className="muted"> › {s.industry}</span>}
        </p>
      )}
      <div className="sc-rets">
        {Object.entries(s.r).map(([p, v]) => (
          <span key={p}>
            <small className="muted">{p}일</small>
            <b className={v != null && v >= 0 ? "up" : "down"}>{signed(v)}%</b>
          </span>
        ))}
      </div>
      <p className="sc-line">
        52주 고가 대비 {s.fromHigh != null ? `${signed(s.fromHigh)}%` : "-"} · 50일선 {s.above50 ? "위" : "아래"} · 시가총액 {s.capEok.toLocaleString()}억원
        {!s.base && <span className="muted"> · 기본 필터 밖(섹터 목록에는 보이지 않음)</span>}
      </p>
      <PriceChart
        s={{
          code: s.code,
          name: s.name,
          tv: `KRX:${s.code}`,
          rs: s.rs ?? 0,
          close: s.close,
          spark: s.spark,
        }}
        from={d.sparkFrom}
        asof={d.asof}
      />
    </div>
  );
}

/** neoScreen 시장 탭 위의 종목 검색. 이름·코드·초성(ㅅㅅㅈㅈ)으로 찾는다 */
export function StockSearch({ sectorName }: { sectorName: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [d, setD] = useState<KrStocks | null>(null);
  const [err, setErr] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const load = () => {
    if (!d) loadKrStocks().then(setD, () => setErr(true));
  };
  const hits = d ? searchStocks(d.list, q) : [];
  const sel = pick && d?.byCode.get(pick);
  return (
    <section className="card">
      <h2 className="card-title">종목 검색</h2>
      <input
        className="search"
        type="search"
        placeholder="종목 이름·코드·초성 (예: 삼성전자, 005930, ㅅㅅㅈㅈ)"
        value={q}
        onFocus={load}
        onChange={(e) => {
          load();
          setQ(e.target.value);
          setPick(null);
        }}
        aria-label="종목 검색"
      />
      {err && <p className="muted small-note">종목 자료를 받지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p>}
      {q && !sel && d && (
        <ul className="hits">
          {hits.map((s) => (
            <li key={s.code}>
              <button onClick={() => setPick(s.code)}>
                <span>
                  {s.name} <small className="muted">{s.code}</small>
                </span>
                <span className={(s.chg ?? 0) >= 0 ? "up" : "down"}>{signed(s.chg, 2)}%</span>
              </button>
            </li>
          ))}
          {!hits.length && <li className="muted small-note">찾는 종목이 없습니다. 보통주만 들어 있어요.</li>}
        </ul>
      )}
      {q && !d && !err && <p className="muted small-note">종목 자료를 불러오는 중…</p>}
      {sel && d && <StockCard s={sel} d={d} sectorName={sectorName} />}
    </section>
  );
}
