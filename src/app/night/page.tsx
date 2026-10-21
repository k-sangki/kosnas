import type { Metadata } from "next";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { NightBoard } from "@/components/NightBoard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "코스피200 야간 추정",
  description: "국내 장이 닫힌 밤사이 해외에서 거래되는 한국 관련 무기한선물로 계산한 코스피200 추정 흐름을 실시간 차트로 보여줍니다.",
  alternates: { canonical: "/night" },
};

export default function Night() {
  return (
    <div className="shell">
      <SiteHeader active="night" />
      <main className="stack">
        <h1 className="page-title">코스피200 야간 추정</h1>
        <p className="lead">
          국내 장이 끝난 15:45부터 다음 날 09:00까지, 해외에서 24시간 거래되는 한국 관련 무기한선물로 코스피200이 지금 어디쯤인지 추정합니다.
        </p>
        <NightBoard />
        <AdSlot slot={AD_SLOTS.board} />
        <section className="card seo-text">
          <h2 className="card-title">어떻게 계산하나요</h2>
          <p>
            추정값 = 15:45 기준점 × (지금 EWY 무기한선물 가격 ÷ 15:45 EWY 무기한선물 가격)입니다. EWY는 한국 대형주를 담은 미국 상장 ETF(iShares MSCI
            South Korea)이고, 이를 따르는 무기한선물은 밤에도 거래가 활발해 한국 증시에 대한 해외 투자자의 판단이 바로 반영됩니다. 기준점은 15:45의
            KR200 무기한선물 가격으로, 국내 장중에는 코스피200 지수를 따라 움직입니다.
          </p>
          <p>
            회색 선은 KR200 무기한선물의 실제 거래가입니다. 거래량이 적어 밤에는 띄엄띄엄 움직이므로 추정선은 더 많이 거래되는 EWY로 그립니다. 점선은 미국
            정규장 개장 시각이고, 이때부터 움직임이 커지는 날이 많습니다.
          </p>
          <h2 className="card-title">유의할 점</h2>
          <p>
            이 값은 한국거래소의 코스피200 야간선물 시세가 아니라 KosNas가 해외 시세로 계산한 참고용 추정치입니다. 실제 야간선물 가격, 다음 날 시가와 다를
            수 있고 해외 시장이 쉬는 주말에는 거의 움직이지 않습니다. 원천 시세는 Hyperliquid의 trade.xyz 시장(공개 API)이며, 특정 종목이나 선물의 매수·매도를
            권하지 않습니다.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
