import { AD_SLOTS, AdSlot } from "./AdSlot";
import { SectorBoard } from "./SectorBoard";
import { SiteFooter, SiteHeader } from "./SiteHeader";
import { MARKET_NAME, sectorData, type Market } from "@/lib/sectors";

export function SampleNotice({ asof }: { asof: string }) {
  return (
    <p className="notice">
      지금 숫자는 화면 확인용 표본입니다({asof} 기준 가짜 값). 종목 이름과 트레이딩뷰 차트만 실제예요.
    </p>
  );
}

export function MarketPage({ market }: { market: Market }) {
  const data = sectorData(market);
  return (
    <div className="shell">
      <SiteHeader active={market} />
      <main className="stack">
        <h1 className="page-title">{market === "kr" ? "코스피·코스닥" : "미국 증시"} 섹터 흐름</h1>
        {data.sample && <SampleNotice asof={data.asof} />}
        <SectorBoard data={data} />
        <AdSlot slot={AD_SLOTS.board} />
        <p className="muted">{MARKET_NAME[market]} 섹터 강도는 장 마감 뒤 하루 한 번 계산합니다.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
