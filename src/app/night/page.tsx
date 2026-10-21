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
            추정값은 15:45 기준점에 두 무기한선물의 15:45 대비 등락을 반반 섞어(기하평균) 곱한 값입니다. 하나는 한국 대형주를 담은 미국 상장 ETF(iShares
            MSCI South Korea)를 따르는 EWY 무기한선물로, 밤에도 거래가 활발해 해외 투자자의 판단이 바로 반영됩니다. 다른 하나는 코스피200을 직접 따르는 KR200
            무기한선물로, 거래는 적지만 지수 자체를 따라갑니다. 기준점은 15:45의 KR200 무기한선물 가격입니다.
          </p>
          <p>
            2026년 10월 7일부터 21일까지 열 번의 밤을 한국거래소 야간선물 종가(06:00)와 비교하면, 15:45 대비 등락률의 평균 오차는 0.2%포인트였고 오르내린
            방향은 열 번 모두 맞았습니다. 다음 날 09:00 시가와 비교한 평균 오차는 0.5%포인트로, 야간선물 종가를 그대로 시가 예상으로 쓸 때(1.0%포인트)보다
            작았습니다. 06:00 이후 움직임까지 반영하기 때문입니다.
          </p>
          <p>
            회색 선은 KR200 무기한선물의 실제 거래가입니다. 점선은 차례로 야간선물 개장(18:00), 미국 정규장 개장, 야간선물 마감(06:00) 시각입니다. 야간선물과
            비교하려면 06:00 값을, 다음 날 시초가를 가늠하려면 09:00 직전 값을 보세요.
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
