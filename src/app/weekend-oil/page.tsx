import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/app/layout";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { WeekendOil } from "@/components/WeekendOil";
import { WEEKEND_OIL_FAQ, WEEKEND_OIL_KEYWORDS } from "@/lib/weekend-oil";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "주말 유가 실시간 - 주말 WTI·브렌트유 시세",
  description:
    "주말 유가 지금 얼마? 미국 원유 시장이 닫힌 토·일요일에도 24시간 거래되는 WTI·브렌트유 무기한선물 가격을 실시간으로 보여 줍니다. 금요일 뉴욕 마감 대비 등락과 주말 흐름 차트.",
  keywords: WEEKEND_OIL_KEYWORDS,
  path: "/weekend-oil",
});

export default function WeekendOilPage() {
  return (
    <div className="shell">
      <SiteHeader />
      <main className="stack">
        <JsonLd data={breadcrumbLd(SITE_URL, [["주말 유가", "/weekend-oil"]])} />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: WEEKEND_OIL_FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
          }}
        />
        <WeekendOil />
        <p className="lead">
          국제유가는 금요일 밤 미국 시장이 닫히면 월요일 아침까지 대부분의 화면에서 멈춥니다. 그 사이에도 해외에서 거래되는 WTI·브렌트유 무기한선물로 주말 유가가 금요일
          마감보다 오르고 있는지, 내리고 있는지 실시간으로 봅니다. 주말에 나온 중동 뉴스나 산유국 발표가 월요일 유가와 정유·화학·항공주에 어떻게 이어질지 미리 가늠할 때
          씁니다.
        </p>
        <AdSlot slot={AD_SLOTS.board} />
        <section className="card seo-text">
          <h2 className="card-title">어떻게 계산하나요</h2>
          <p>
            Hyperliquid의 trade.xyz 시장에는 WTI 원유와 브렌트유를 따르는 무기한선물이 달러로 24시간 거래됩니다. 이 가격을 30초마다 받아 보여 주고, 주말에는 CME가 닫힌
            금요일 오후 5시(뉴욕 시각) 무렵의 같은 무기한선물 가격과 비교해 등락률을 냅니다. 평일 밤 코스피 흐름은 <Link href="/night">코스피 야간선물 실시간 추정</Link>
            에서, 유가에 민감한 국내 업종의 최근 등락은 <Link href="/kr">국장 섹터 순위</Link>에서 볼 수 있습니다.
          </p>
          <h2 className="card-title">유의할 점</h2>
          <p>
            이 값은 CME 공식 시세나 증권사 CFD 가격이 아니라 공개 시장의 무기한선물로 본 참고용 추정치입니다. 주말에는 거래가 적어 가격이 한동안 멈춰 있거나 계단처럼 움직일
            수 있고, 월요일 정규 시장 시가와 다를 수 있습니다. 특정 상품이나 종목의 매수·매도를 권하지 않습니다.
          </p>
        </section>
        <section className="card seo-text">
          <h2 className="card-title">자주 묻는 질문</h2>
          {WEEKEND_OIL_FAQ.map(([q, a]) => (
            <div key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </section>
        <section className="card">
          <h2 className="card-title">함께 보기</h2>
          <ul className="guide-links">
            <li>
              <Link href="/night">코스피 야간선물 실시간 추정</Link>
            </li>
            <li>
              <Link href="/night/samsung-electronics">삼성전자 야간 시세</Link>
            </li>
            <li>
              <Link href="/night/sk-hynix">SK하이닉스 야간 시세</Link>
            </li>
            <li>
              <Link href="/us">미장 섹터 순환</Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
