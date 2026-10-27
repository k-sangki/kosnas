"use client";

import { useEffect, useMemo, useState } from "react";
import { loadKrStocks, type KrStocks } from "@/lib/kr-stocks";
import { DEFAULT_FILTERS, GROUPS, SORTS, applyFilters, searchStocks, toListStock, type Filters, type ScreenStock } from "@/lib/screens";
import { StockList } from "./StockList";

const PAGE = 50;
const RS_STEPS = [0, 70, 80, 90];

/**
 * 국장 종목 검색. 종목 자료(kr-stocks.json, 섹터 화면이 차트용으로 받는 것과 같은 파일)를 한 번 받아
 * 이름 검색과 조건 거르기를 브라우저에서 한다(서버 계산 없음).
 */
export function Screener({ sectors }: { sectors: [string, string][] }) {
  const [data, setData] = useState<KrStocks | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    loadKrStocks()
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  const all: ScreenStock[] = useMemo(() => (data ? data.list.map((s) => ({ ...s, ind: s.industry })) : []), [data]);
  const searching = q.trim().length > 0;
  const result = useMemo(() => (searching ? searchStocks(all, q) : applyFilters(all, f)), [all, f, q, searching]);
  const set = (p: Partial<Filters>) => {
    setF((x) => ({ ...x, ...p }));
    setShown(PAGE);
  };
  const toggle = (keys: string[], on: boolean) => set({ on: on ? [...new Set([...f.on, ...keys])] : f.on.filter((k) => !keys.includes(k)) });
  const changed = JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS);
  const period = f.sort === "chg" ? 5 : f.sort === "rs" ? 60 : 20;

  return (
    <>
      <section className="card">
        <input
          className="search"
          type="search"
          inputMode="search"
          placeholder="종목 이름·코드·초성 (예: ㅅㅅㅈㅈ)"
          aria-label="종목 검색"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
          }}
        />
        {!searching && (
          <div className="screen-filters">
            <div className="seg filter" role="group" aria-label="시장">
              {(["", "KOSPI", "KOSDAQ"] as const).map((m) => (
                <button key={m} aria-pressed={f.market === m} onClick={() => set({ market: m })}>
                  {m === "" ? "전체" : m === "KOSPI" ? "코스피" : "코스닥"}
                </button>
              ))}
            </div>
            <div className="screen-row">
              <span className="screen-label">상대강도</span>
              <div className="seg small" role="group" aria-label="상대강도 하한">
                {RS_STEPS.map((v) => (
                  <button key={v} aria-pressed={f.rsMin === v} onClick={() => set({ rsMin: v })}>
                    {v ? `${v}+` : "전체"}
                  </button>
                ))}
              </div>
            </div>
            <div className="screen-row">
              <span className="screen-label">섹터</span>
              <select className="screen-select" value={f.sector} onChange={(e) => set({ sector: e.target.value })} aria-label="섹터">
                <option value="">전체 섹터</option>
                {sectors.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            {GROUPS.map((g) => {
              const keys = g.items.map((t) => t.key);
              const n = keys.filter((k) => f.on.includes(k)).length;
              return (
                <details key={g.key} className="screen-group" open={g.key === "base"}>
                  <summary>
                    <b>{g.name}</b> <span className={n ? "rs-count" : "muted"}>{n ? `${n}개 켜짐` : "꺼짐"}</span>
                  </summary>
                  <p className="muted small-note">{g.hint}</p>
                  <div className="chips">
                    {g.items.map((t) => (
                      <button key={t.key} className="rs-toggle" aria-pressed={f.on.includes(t.key)} onClick={() => toggle([t.key], !f.on.includes(t.key))}>
                        {t.name}
                      </button>
                    ))}
                    {g.key === "trend" && (
                      <button className="rs-toggle all" onClick={() => toggle(keys, n < keys.length)}>
                        {n < keys.length ? "모두 켜기" : "모두 끄기"}
                      </button>
                    )}
                  </div>
                </details>
              );
            })}
            <div className="screen-row">
              <span className="screen-label">정렬</span>
              <div className="seg small" role="group" aria-label="정렬">
                {SORTS.map((s) => (
                  <button key={s.key} aria-pressed={f.sort === s.key} onClick={() => set({ sort: s.key })}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            {changed && (
              <button className="text-btn" onClick={() => set(DEFAULT_FILTERS)}>
                조건 처음으로
              </button>
            )}
          </div>
        )}
      </section>
      <section className="card">
        {err ? (
          <p className="error">종목 자료를 받지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>
        ) : !data ? (
          <p className="muted">종목 자료를 불러오는 중…</p>
        ) : (
          <>
            <h2 className="card-title">
              {searching ? `'${q.trim()}' 검색 결과` : "조건에 맞는 종목"} <span className="rs-count">{result.length.toLocaleString()}종목</span>{" "}
              <span className="muted">{data.asof} 종가 기준</span>
            </h2>
            {result.length ? (
              <StockList stocks={result.slice(0, shown).map(toListStock)} from={data.sparkFrom} asof={data.asof} period={period} showInd />
            ) : (
              <p className="muted">{searching ? "찾는 종목이 없습니다. 보통주만 들어 있어요." : "조건에 맞는 종목이 없습니다. 조건을 하나씩 풀어 보세요."}</p>
            )}
            {result.length > shown && (
              <button className="more-btn" onClick={() => setShown(shown + PAGE)}>
                {Math.min(PAGE, result.length - shown)}종목 더 보기
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
