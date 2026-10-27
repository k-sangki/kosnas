import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { KrTabs } from "@/components/KrTabs";
import { Screener } from "@/components/Screener";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Fold } from "@/components/Fold";
import { SITE_URL } from "@/app/layout";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { BASE_FILTER } from "@/lib/sectors";
import { krSectorNames } from "@/lib/screen-data";
import { SCREENS } from "@/lib/screens";

/** 국장 종목 검색(스크리너). 미장은 아직 없다 */
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ market: "kr" }];
}

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({
    title: "국장 종목 검색 - 코스피·코스닥 주식 스크리너(상대강도·신고가·등락률)",
    description:
      "코스피·코스닥 보통주를 이름·초성으로 찾고, 상대강도(RS)·추세 템플릿(이동평균 정배열)·52주 신고가·섹터 조건으로 걸러 보는 무료 주식 스크리너. 매일 장 마감 자료로 갱신합니다.",
    keywords: ["주식 스크리너", "국장 스크리너", "종목 검색", "종목 스크리너", "코스피 스크리너", "코스닥 스크리너", "조건 검색", "상대강도", "RS 순위", "추세 템플릿", "미너비니", "이동평균 정배열"],
    path: "/kr/screener",
  });
}

export default async function ScreenerPage({ params }: PageProps<"/[market]/screener">) {
  const { market } = await params;
  if (market !== "kr") notFound();
  return (
    <div className="shell">
      <SiteHeader active="kr" />
      <main className="stack">
        <JsonLd data={breadcrumbLd(SITE_URL, [["국장 종목 검색", "/kr/screener"]])} />
        <KrTabs active="screener" />
        <h1 className="page-title">국장 종목 검색</h1>
        <p className="lead">코스피·코스닥 보통주를 이름으로 찾거나 기본 필터·추세 템플릿·상대강도·섹터 조건으로 걸러 봅니다. 종목을 누르면 차트가 열립니다.</p>
        <Screener sectors={krSectorNames()} />
        <section className="card">
          <h2 className="card-title">자주 보는 조건</h2>
          <ul className="guide-links">
            {SCREENS.map((s) => (
              <li key={s.slug}>
                <Link href={`/kr/screener/${s.slug}`}>{s.h1}</Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card seo-text">
          <Fold title="조건의 뜻">
            <p>
              상대강도(RS)는 최근 12개월 수익률을 최근 3개월에 무게를 두어 전 종목과 비교한 순위(1~99)로, 90이면 상위 10% 안에 든다는 뜻입니다. 52주 고가·저가는
              최근 252거래일 최고·최저 종가이고, 50·150·200일선은 그 기간 종가 평균입니다.
            </p>
            <p>
              기본 필터({BASE_FILTER})는 처음부터 켜져 있어 거래가 너무 적거나 작은 종목을 뺍니다. 항목마다 끌 수 있습니다. 추세 템플릿은 마크 미너비니가 상승
              추세(2단계)에 있는 종목을 고를 때 쓰는 조건으로, 모두 켜면 이동평균이 정배열이고 52주 고가 가까이 있는 종목만 남습니다. 이름 검색은 조건과 상관없이 모든
              보통주에서 찾습니다. 시세는 금융위원회 주식시세정보(공공데이터포털)로, 다음 영업일 오후에 갱신됩니다. 특정 종목의 매수·매도를 권하지 않습니다.
            </p>
          </Fold>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
