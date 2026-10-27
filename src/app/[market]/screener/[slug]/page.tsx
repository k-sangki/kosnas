import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { Fold } from "@/components/Fold";
import { JsonLd } from "@/components/JsonLd";
import { KrTabs } from "@/components/KrTabs";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { StockList } from "@/components/StockList";
import { SITE_URL } from "@/app/layout";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { BASE_FILTER, sectorData } from "@/lib/sectors";
import { krScreenStocks } from "@/lib/screen-data";
import { SCREENS, SHOW, findScreen, runScreen, toListStock } from "@/lib/screens";

/**
 * 고정 조건 페이지(52주 신고가 근처·상대강도 상위 …). 목록을 서버에서 미리 그려
 * '신고가 종목' 같은 검색어로 들어온 사람과 검색엔진이 바로 읽게 한다. 자료가 바뀌면 다시 배포된다.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return SCREENS.map((s) => ({ market: "kr", slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[market]/screener/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = findScreen(slug);
  if (!s) return {};
  return pageMeta({ title: s.title, description: s.description, keywords: s.keywords, path: `/kr/screener/${s.slug}` });
}

export default async function ScreenPage({ params }: PageProps<"/[market]/screener/[slug]">) {
  const { market, slug } = await params;
  const screen = findScreen(slug);
  if (market !== "kr" || !screen) notFound();
  const data = sectorData("kr");
  const names = new Map(data.sectors.map((s) => [s.id, s.name]));
  const list = runScreen(krScreenStocks(), screen);
  const top = list.slice(0, 3);
  const [y, m, d] = data.asof.split("-").map(Number);
  const others = SCREENS.filter((s) => s.slug !== screen.slug);

  return (
    <div className="shell">
      <SiteHeader active="kr" />
      <main className="stack">
        <JsonLd
          data={breadcrumbLd(SITE_URL, [
            ["국장 종목 검색", "/kr/screener"],
            [screen.h1, `/kr/screener/${screen.slug}`],
          ])}
        />
        <KrTabs active="screener" />
        <Link href="/kr/screener" className="back">
          ← 종목 검색
        </Link>
        <h1 className="page-title">{screen.h1}</h1>
        <p className="lead">
          {y}년 {m}월 {d}일 종가 기준, 기본 필터를 통과한 코스피·코스닥 보통주를 {screen.what}로 {SHOW}종목까지 모았습니다.
          {top.length > 0 &&
            ` 맨 위는 ${top.map((s) => `${s.name}(${names.get(s.sector ?? "") ?? "기타"}, ${screen.value(s)})`).join(", ")}입니다.`}
        </p>
        <section className="card">
          <h2 className="card-title">
            {screen.h1} <span className="muted">{data.asof} 종가</span>
          </h2>
          {list.length ? (
            <StockList stocks={list.map(toListStock)} from={data.sparkFrom} asof={data.asof} period={screen.period} showInd />
          ) : (
            <p className="muted">지금은 조건에 맞는 종목이 없습니다.</p>
          )}
          <p className="muted small-note">
            기본 필터({BASE_FILTER})를 통과한 종목만 보입니다. 종목을 누르면 차트가 열립니다. 다른 조건을 함께 걸려면{" "}
            <Link href="/kr/screener" className="inline-link">
              종목 검색
            </Link>
            에서 고르세요.
          </p>
        </section>
        <AdSlot slot={AD_SLOTS.sector} />
        <section className="card seo-text">
          <Fold title="이 목록을 읽는 법">
            <p>
              {screen.description} 상대강도(RS)는 최근 12개월 수익률을 최근 3개월에 무게를 두어 전 종목과 비교한 순위(1~99)이고, 52주 고점 대비는 최근 252거래일 최고
              종가에서 얼마나 떨어져 있는지입니다. 숫자는 금융위원회 주식시세정보로 직접 계산했으며 지나간 시세를 정리한 것일 뿐, 특정 종목의 매수·매도를 권하지
              않습니다.
            </p>
          </Fold>
        </section>
        <section className="card">
          <h2 className="card-title">다른 조건</h2>
          <ul className="guide-links">
            {others.map((s) => (
              <li key={s.slug}>
                <Link href={`/kr/screener/${s.slug}`}>{s.h1}</Link>
              </li>
            ))}
            <li>
              <Link href="/kr">국장 섹터 순환</Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
