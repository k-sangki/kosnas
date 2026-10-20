import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { SampleNotice } from "@/components/MarketPage";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { StockList } from "@/components/StockList";
import { MARKETS, QUADRANTS, findSector, sectorData, signed, type Market } from "@/lib/sectors";

export const dynamicParams = false;

export function generateStaticParams() {
  return MARKETS.flatMap((market) => sectorData(market).sectors.map((s) => ({ market, id: s.id })));
}

function read(market: string, id: string) {
  if (!(MARKETS as string[]).includes(market)) return undefined;
  const sector = findSector(market as Market, id);
  return sector && { market: market as Market, sector };
}

export async function generateMetadata({ params }: PageProps<"/[market]/sector/[id]">): Promise<Metadata> {
  const { market, id } = await params;
  const hit = read(market, id);
  if (!hit) return {};
  const where = hit.market === "kr" ? "국내" : "미국";
  return {
    title: `${where} ${hit.sector.name} 섹터 흐름`,
    description: `${where} ${hit.sector.name} 섹터의 기간별 강도와 종목별 상대강도 순위.`,
    alternates: { canonical: `/${market}/sector/${id}` },
  };
}

export default async function SectorPage({ params }: PageProps<"/[market]/sector/[id]">) {
  const { market, id } = await params;
  const hit = read(market, id);
  if (!hit) notFound();
  const { sector } = hit;
  const data = sectorData(hit.market);

  return (
    <div className="shell">
      <SiteHeader active={hit.market} />
      <main className="stack">
        <Link href={hit.market === "kr" ? "/" : "/us"} className="back">
          ← 섹터 흐름
        </Link>
        <h1 className="page-title">{sector.name}</h1>
        {data.sample && <SampleNotice asof={data.asof} />}
        {sector.intro && (
          <p className="lead">
            {sector.intro}
            {sector.count ? ` 보통주 ${sector.count}종목이 이 섹터에 들어 있습니다.` : ""}
          </p>
        )}
        <section className="card">
          <h2 className="card-title">기간별 흐름 <span className="muted">{data.asof} 종가 기준</span></h2>
          <table className="ptable">
            <thead>
              <tr>
                <th>기간</th>
                <th>수익률</th>
                <th>강도</th>
                <th>칸</th>
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p}>
                  <td>{p}일</td>
                  <td className={(sector.ret[p] ?? 0) >= 0 ? "up" : "down"}>{signed(sector.ret[p])}%</td>
                  <td>{signed(sector.x[p])}%p</td>
                  <td>{QUADRANTS.find((q) => q.key === sector.q[p])?.name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small-note">
            50일선 위 종목 {sector.above50}% · 52주 신고가 {sector.newHighs}종목
          </p>
        </section>
        <AdSlot slot={AD_SLOTS.sector} />
        <section className="card">
          <h2 className="card-title">종목 · 상대강도 순</h2>
          <p className="muted">
            상대강도는 최근 12개월 수익률을 최근 3개월에 무게를 두어 전 종목과 비교한 순위(1~99)입니다. 시가총액 1,000억원 이상만 보이며, 종목을 누르면
            차트가 열립니다.
          </p>
          <StockList stocks={sector.stocks} from={data.sparkFrom} asof={data.asof} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
