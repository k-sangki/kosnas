"use client";

import { useState } from "react";
import { TvWidget } from "./TvWidget";

// 미국 종목 시세는 공개 사이트에 다시 실을 수 있는 원천이 아직 없어, 국장처럼 직접 계산하지 않고
// 트레이딩뷰 위젯(출처 표시 유지 조건으로 무료)으로 섹터 흐름을 보여 준다.
const INDEXES = [
  { key: "SPX500", name: "S&P 500" },
  { key: "NASDAQ100", name: "나스닥 100" },
  { key: "DJDJI", name: "다우 30" },
];
const PERIODS = [
  { key: "change", name: "1일" },
  { key: "Perf.W", name: "1주" },
  { key: "Perf.1M", name: "1달" },
  { key: "Perf.3M", name: "3달" },
  { key: "Perf.6M", name: "6달" },
  { key: "Perf.Y", name: "1년" },
];
const ETFS: [string, string][] = [
  ["AMEX:XLK", "기술"],
  ["NASDAQ:SMH", "반도체"],
  ["AMEX:XLC", "커뮤니케이션"],
  ["AMEX:XLY", "임의소비재"],
  ["AMEX:XLF", "금융"],
  ["AMEX:XLV", "헬스케어"],
  ["AMEX:XLI", "산업재"],
  ["AMEX:XLE", "에너지"],
  ["AMEX:XLB", "소재"],
  ["AMEX:XLU", "유틸리티"],
  ["AMEX:XLRE", "부동산"],
  ["AMEX:XLP", "필수소비재"],
];

export function UsSectors() {
  const [index, setIndex] = useState("SPX500");
  const [period, setPeriod] = useState("Perf.1M");
  return (
    <>
      <section className="card">
        <h2 className="card-title">섹터 흐름 지도</h2>
        <div className="seg filter" role="group" aria-label="지수">
          {INDEXES.map((i) => (
            <button key={i.key} aria-pressed={i.key === index} onClick={() => setIndex(i.key)}>
              {i.name}
            </button>
          ))}
        </div>
        <div className="seg filter" role="group" aria-label="기간">
          {PERIODS.map((p) => (
            <button key={p.key} aria-pressed={p.key === period} onClick={() => setPeriod(p.key)}>
              {p.name}
            </button>
          ))}
        </div>
        <TvWidget
          kind="stock-heatmap"
          height={520}
          config={{
            exchanges: [],
            dataSource: index,
            grouping: "sector",
            blockSize: "market_cap_basic",
            blockColor: period,
            locale: "kr",
            symbolUrl: "",
            colorTheme: "light",
            hasTopBar: false,
            isDataSetEnabled: false,
            isZoomEnabled: true,
            hasSymbolTooltip: true,
            isMonoSize: false,
            width: "100%",
            height: 520,
          }}
        />
        <p className="muted small-note">
          칸 크기는 시가총액, 색은 고른 기간 등락률입니다. 섹터끼리 묶여 있어 어느 섹터가 지수를 끌어올리고 끌어내리는지 한눈에 보입니다. 기간을 길게 바꿔 보면 국장
          화면의 긴 기간 강도처럼 흐름을 읽을 수 있어요.
        </p>
      </section>
      <section className="card">
        <h2 className="card-title">섹터 ETF</h2>
        <TvWidget
          kind="market-quotes"
          height={560}
          config={{
            width: "100%",
            height: 560,
            symbolsGroups: [{ name: "미국 섹터", symbols: ETFS.map(([name, displayName]) => ({ name, displayName })) }],
            showSymbolLogo: true,
            isTransparent: true,
            colorTheme: "light",
            locale: "kr",
          }}
        />
        <p className="muted small-note">S&P 500 섹터별 SPDR ETF와 반도체 ETF(SMH)의 시세입니다.</p>
      </section>
    </>
  );
}
