import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/app/layout";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { JsonLd } from "@/components/JsonLd";
import { Fold } from "@/components/Fold";
import { LiveQuoteView } from "@/components/LiveQuoteView";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { LIVE_QUOTES, findLiveQuote } from "@/lib/live-quotes";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return LIVE_QUOTES.map((q) => ({ slug: q.slug }));
}

export async function generateMetadata({ params }: PageProps<"/live/[slug]">): Promise<Metadata> {
  const q = findLiveQuote((await params).slug);
  if (!q) return {};
  return pageMeta({
    title: `${q.name} 실시간 - ${q.short} 24시간 시세와 등락률`,
    description: `${q.name} 지금 얼마? 주말·새벽에도 24시간 거래되는 무기한선물로 ${q.short} 실시간 가격과 ${q.basis} 등락률, 밤사이 흐름 차트를 보여 줍니다.`,
    keywords: q.keywords,
    path: `/live/${q.slug}`,
  });
}

export default async function LiveQuotePage({ params }: PageProps<"/live/[slug]">) {
  const q = findLiveQuote((await params).slug);
  if (!q) notFound();
  const others = LIVE_QUOTES.filter((o) => o.slug !== q.slug);
  return (
    <div className="shell">
      <SiteHeader />
      <main className="stack">
        <JsonLd data={breadcrumbLd(SITE_URL, [[`${q.name} 실시간`, `/live/${q.slug}`]])} />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: q.faq.map(([a, b]) => ({ "@type": "Question", name: a, acceptedAnswer: { "@type": "Answer", text: b } })),
          }}
        />
        <Link href="/" className="back">
          ← 대시보드
        </Link>
        <LiveQuoteView q={{ coin: q.coin, name: q.name, unit: q.unit, basis: q.basis }} />
        <p className="lead">{q.lead}</p>
        <AdSlot slot={AD_SLOTS.board} />
        <section className="card seo-text">
          <Fold title="어떻게 계산하나요">
            <p>
              Hyperliquid(trade.xyz) 시장에서 24시간 거래되는 {q.short} 무기한선물 가격을 30초마다 받아 보여 주고, {q.basis}의 같은 무기한선물 가격과 비교해 등락률을 냅니다.
              정규 시장에서는 {q.official}가 같은 흐름을 보여 줍니다. 밤사이 국내 시장 흐름은 <Link href="/night">코스피 야간선물 실시간 추정</Link>에서 볼 수 있습니다.
            </p>
          </Fold>
          <Fold title="유의할 점">
            <p>
              이 값은 거래소 공식 시세가 아니라 공개 시장의 무기한선물로 본 참고용 가격입니다. 거래가 적은 시간에는 가격이 한동안 멈춰 있거나 계단처럼 움직일 수 있습니다. 특정 상품이나
              종목의 매수·매도를 권하지 않습니다.
            </p>
          </Fold>
        </section>
        <section className="card seo-text">
          <Fold title="자주 묻는 질문">
            {q.faq.map(([a, b]) => (
              <div key={a}>
                <h3>{a}</h3>
                <p>{b}</p>
              </div>
            ))}
          </Fold>
        </section>
        <section className="card">
          <h2 className="card-title">함께 보기</h2>
          <ul className="guide-links">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={`/live/${o.slug}`}>{o.name} 실시간</Link>
              </li>
            ))}
            <li>
              <Link href="/night">코스피 야간선물 실시간 추정</Link>
            </li>
            <li>
              <Link href="/weekend-oil">국제유가 실시간 · 주말 유가</Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
