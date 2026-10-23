"use client";

import { useState } from "react";
import { TvWidget } from "./TvWidget";
import { US_SECTOR_ETFS as ETFS } from "@/lib/us-sector-etfs";

// 미국 종목 시세는 공개 사이트에 다시 실을 수 있는 원천이 아직 없어, 국장처럼 직접 계산하지 않고
// 트레이딩뷰 위젯(출처 표시 유지 조건으로 무료)으로 섹터 순환을 보여 준다.
const INDEXES = [
  { key: "SPX500", name: "S&P 500" },
  { key: "NASDAQ100", name: "나스닥 100" },
  { key: "DJDJI", name: "다우 30" },
];
// 국장과 같은 5·10·20·30·60일 단위. 트레이딩뷰 지도가 주는 기간은 1주(5거래일)·1달(약 20거래일)·3달(약 60거래일)뿐이라 10·30일은 없다
const PERIODS = [
  { key: "Perf.W", name: "5일" },
  { key: "Perf.1M", name: "20일" },
  { key: "Perf.3M", name: "60일" },
];

export function UsSectors() {
  const [index, setIndex] = useState("SPX500");
  const [period, setPeriod] = useState("Perf.1M");
  return (
    <>
      <section className="card">
        <h2 className="card-title">미장 섹터 순환매 지도</h2>
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
          칸 크기는 시가총액, 색은 고른 기간 등락률입니다. 섹터끼리 묶여 있어 어느 섹터가 지수를 끌어올리고 끌어내리는지 한눈에 보입니다. 5일은 1주, 20일은 1달, 60일은 3달 등락률이며, 트레이딩뷰 지도가 이 세 기간만 제공해 10·30일은 없습니다.
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
        <p className="muted small-note">
          미장 섹터:{" "}
          {ETFS.map(([sym, name]) => `${name}(${sym.split(":")[1]})`).join(" · ")}. 위 지도에서 섹터별 등락률을 비교하면 미국 증시의 순환매가 어느 섹터로
          옮겨 가는지 볼 수 있습니다.
        </p>
      </section>
    </>
  );
}
