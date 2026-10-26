import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/app/layout";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { Fold } from "@/components/Fold";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { StockNight } from "@/components/StockNight";
import { NIGHT_STOCKS, findNightStock, nightStockFaq } from "@/lib/night-stocks";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return NIGHT_STOCKS.map((s) => ({ stock: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/night/[stock]">): Promise<Metadata> {
  const s = findNightStock((await params).stock);
  if (!s) return {};
  return pageMeta({
    title: `${s.name} 야간 시세 실시간 추정 - ${s.name} 야간선물·밤사이 주가`,
    description: `${s.name} 야간 주가 지금 얼마? 국내 장이 끝난 뒤부터 다음 날 아침까지 해외에서 24시간 거래되는 ${s.name} 무기한선물 가격을 원화로 바꿔 실시간으로 보여 줍니다. 15:45 대비 등락과 밤사이 흐름 차트.`,
    keywords: s.keywords,
    path: `/night/${s.slug}`,
  });
}

export default async function NightStockPage({ params }: PageProps<"/night/[stock]">) {
  const s = findNightStock((await params).stock);
  if (!s) notFound();
  const faq = nightStockFaq(s);
  const others = NIGHT_STOCKS.filter((o) => o.slug !== s.slug);
  return (
    <div className="shell">
      <SiteHeader active="night" />
      <main className="stack">
        <JsonLd
          data={breadcrumbLd(SITE_URL, [
            ["야간 코스피", "/night"],
            [`${s.name} 야간 시세`, `/night/${s.slug}`],
          ])}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
          }}
        />
        <Link href="/night" className="back">
          ← 코스피 야간선물 추정
        </Link>
        <StockNight coin={s.coin} name={s.name} />
        <p className="lead">
          {s.name} 주가가 밤사이 어디쯤인지, 국내 정규장이 끝난 15:45부터 다음 날 09:00 개장 전까지 해외 무기한선물 가격으로 실시간 추정합니다. 미국 장에서 나온
          반도체 뉴스나 실적 발표에 {s.name} 가격이 어떻게 반응했는지 아침 전에 가늠할 때 씁니다.
        </p>
        <AdSlot slot={AD_SLOTS.board} />
        <section className="card seo-text">
          <Fold title="어떻게 계산하나요">
            <p>
              Hyperliquid의 trade.xyz 시장에는 {s.name} 한 주를 따르는 무기한선물이 달러로 거래됩니다. 이 가격에 같은 시장의 원/달러 무기한선물 값을 곱해 원화로 바꾸고,
              국내 정규장이 끝난 15:45 무렵 가격과 비교해 등락률을 냅니다. 지수 전체의 밤사이 흐름은{" "}
              <Link href="/night">코스피 야간선물 실시간 추정</Link>에서, {s.name}가 속한 반도체 섹터의 최근 등락과 순위는{" "}
              <Link href={`/kr/sector/${s.sector}`}>반도체 섹터 페이지</Link>에서 볼 수 있습니다.
            </p>
          </Fold>
          <Fold title="유의할 점">
            <p>
              이 값은 한국거래소나 넥스트레이드 시세가 아니라 해외 무기한선물로 계산한 참고용 추정치입니다. 거래량이 적은 시간에는 몇 분씩 가격이 멈춰 있을 수 있고,
              다음 날 국내 시가와 다를 수 있습니다. 특정 종목의 매수·매도를 권하지 않습니다.
            </p>
          </Fold>
        </section>
        <section className="card seo-text">
          <Fold title="자주 묻는 질문">
            {faq.map(([q, a]) => (
              <div key={q}>
                <h3>{q}</h3>
                <p>{a}</p>
              </div>
            ))}
          </Fold>
        </section>
        <section className="card">
          <h2 className="card-title">함께 보기</h2>
          <ul className="guide-links">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/night/${o.slug}`}>{o.name} 야간 시세</Link>
              </li>
            ))}
            <li>
              <Link href="/night">코스피 야간선물 실시간 추정</Link>
            </li>
            <li>
              <Link href="/guide/ewy-kospi">EWY와 코스피는 어떻게 연결되나요</Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
