import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { TvMini, TvWidget } from "@/components/TvWidget";

export const metadata: Metadata = {
  title: "위젯 시험",
  robots: { index: false, follow: false },
};

// 0단계 확인용: 국내 종목·지수가 외부 사이트 위젯에서 나오는지, 미국은 문제없는지 본다
const KR = [
  ["KRX:005930", "삼성전자 (코스피)"],
  ["KRX:000660", "SK하이닉스 (코스피)"],
  ["KRX:247540", "에코프로비엠 (코스닥)"],
];
const US = [
  ["NASDAQ:NVDA", "NVIDIA"],
  ["NASDAQ:AAPL", "Apple"],
];

export default function WidgetLab() {
  return (
    <div className="shell">
      <SiteHeader />
      <main className="stack">
        <h1 className="page-title">트레이딩뷰 위젯 시험</h1>
        <p className="notice">
          국내 종목·지수가 &quot;트레이딩뷰에서만 볼 수 있음&quot;으로 막히는지 확인하는 화면입니다. 검색에는 나오지 않습니다.
        </p>
        <section className="card">
          <h2 className="card-title">지수 시세 묶음</h2>
          <TvWidget
            kind="market-quotes"
            height={420}
            config={{
              width: "100%",
              height: 420,
              locale: "kr",
              colorTheme: "light",
              isTransparent: true,
              showSymbolLogo: true,
              symbolsGroups: [
                {
                  name: "국내",
                  symbols: [
                    { name: "KRX:KOSPI", displayName: "코스피" },
                    { name: "KRX:KOSDAQ", displayName: "코스닥" },
                    { name: "KRX:KOSPI200", displayName: "코스피200" },
                  ],
                },
                {
                  name: "미국",
                  symbols: [
                    { name: "NASDAQ:IXIC", displayName: "나스닥 종합" },
                    { name: "NASDAQ:NDX", displayName: "나스닥100" },
                    { name: "SP:SPX", displayName: "S&P 500" },
                  ],
                },
              ],
            }}
          />
        </section>
        {[...KR, ...US].map(([symbol, label]) => (
          <section className="card" key={symbol}>
            <h2 className="card-title">
              {label} <span className="muted">{symbol}</span>
            </h2>
            <TvMini symbol={symbol} />
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
