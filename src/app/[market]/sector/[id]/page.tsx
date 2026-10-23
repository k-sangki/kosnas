import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SECTOR_KEYWORDS, breadcrumbLd, pageMeta } from "@/lib/seo";
import { SITE_URL } from "@/app/layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { SampleNotice } from "@/components/MarketPage";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { SectorDetail, type MoveBy } from "@/components/SectorDetail";
import { StockList } from "@/components/StockList";
import { SECTOR_NOTES } from "@/lib/sector-notes";
import { MARKETS, QUADRANTS, findSector, moveScores, ready, sectorData, signed, type Market } from "@/lib/sectors";

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
  const where = hit.market === "kr" ? "국장" : "미장";
  const name = hit.sector.name;
  const inds = (sectorData(hit.market).industries ?? []).filter((i) => i.sector === hit.sector.id).map((i) => i.name);
  return pageMeta({
    title: `${name} 섹터 등락률·순위 - ${where} 섹터 순환매`,
    description: `${where} ${name} 섹터의 5·10·20·30·60일 등락률과 섹터 순위, 순환매 흐름(주도·약화·소외·관찰)${inds.length ? `, ${inds.join("·")} 산업` : ""}과 종목별 상대강도 순위.`,
    keywords: [name, `${name} 섹터`, `${name} 섹터 등락`, `${name} 관련주`, ...inds, ...SECTOR_KEYWORDS],
    path: `/${market}/sector/${id}`,
  });
}

export default async function SectorPage({ params }: PageProps<"/[market]/sector/[id]">) {
  const { market, id } = await params;
  const hit = read(market, id);
  if (!hit) notFound();
  const { sector } = hit;
  const data = sectorData(hit.market);
  const note = hit.market === "kr" ? SECTOR_NOTES[sector.id] : undefined;
  const industries = (data.industries ?? []).filter((i) => i.sector === sector.id);
  const strip = (m: { dir: "up" | "down"; score: number; straight: number; dist: number }) => ({
    dir: m.dir,
    score: m.score,
    straight: m.straight,
    dist: m.dist,
  });
  const moves: Record<string, MoveBy[string]> = {};
  const indMoves: Record<string, MoveBy> = {};
  for (const p of data.periods) {
    const m = moveScores(
      data.sectors.filter((s) => ready(s, p)),
      p,
    ).get(sector.id);
    moves[p] = m && strip(m);
    const all = moveScores(
      (data.industries ?? []).filter((s) => ready(s, p)),
      p,
    );
    indMoves[p] = Object.fromEntries(industries.map((i) => [i.id, all.get(i.id) && strip(all.get(i.id)!)]));
  }
  const detailed = sector.stocks.some((s) => s.r);
  // 같은 시장 섹터 가운데 그 기간 등락률 순위
  const rank = (p: number) => {
    const v = sector.ret[p];
    if (v == null) return "-";
    const all = data.sectors.filter((s) => s.ret[p] != null);
    return `${all.filter((s) => s.ret[p]! > v).length + 1}/${all.length}`;
  };

  return (
    <div className="shell">
      <SiteHeader active={hit.market} />
      <main className="stack">
        <JsonLd
          data={breadcrumbLd(SITE_URL, [
            [hit.market === "kr" ? "국장 섹터 순환" : "미장", `/${hit.market}`],
            [`${sector.name} 섹터`, `/${hit.market}/sector/${sector.id}`],
          ])}
        />
        <Link href={`/${hit.market}`} className="back">
          ← 섹터 순환
        </Link>
        <h1 className="page-title">{sector.name} 섹터</h1>
        {data.sample && <SampleNotice asof={data.asof} />}
        {sector.intro && (
          <p className="lead">
            {sector.intro}
            {sector.count ? ` 보통주 ${sector.count}종목이 이 섹터에 들어 있습니다.` : ""}
          </p>
        )}
        <section className="card">
          <h2 className="card-title">
            기간별 등락률과 섹터 순위 <span className="muted">{data.asof} 종가 기준</span>
          </h2>
          <table className="ptable">
            <thead>
              <tr>
                <th>기간</th>
                <th>등락률</th>
                <th>강도</th>
                <th>순위</th>
                <th>칸</th>
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p}>
                  <td>{p}일</td>
                  <td className={(sector.ret[p] ?? 0) >= 0 ? "up" : "down"}>{signed(sector.ret[p])}%</td>
                  <td>{signed(sector.x[p])}%p</td>
                  <td>{rank(p)}</td>
                  <td>{QUADRANTS.find((q) => q.key === sector.q[p])?.name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small-note">
            50일선 위 종목 {sector.above50}% · 52주 신고가 {sector.newHighs}종목
          </p>
        </section>
        {note && (
          <section className="card seo-text">
            <h2 className="card-title">{sector.name} 섹터를 움직이는 것</h2>
            <p>{note.drivers}</p>
            <h2 className="card-title">흐름을 볼 때 참고할 점</h2>
            <p>{note.watch}</p>
            <p className="muted small-note">
              섹터 강도와 네 칸의 뜻은 <Link href="/guide/quadrant">네 칸 읽는 법</Link>, 종목 순위는{" "}
              <Link href="/guide/relative-strength">상대강도 가이드</Link>에서 볼 수 있습니다.
            </p>
          </section>
        )}
        <AdSlot slot={AD_SLOTS.sector} />
        {detailed ? (
          <SectorDetail
            sector={sector}
            industries={industries}
            periods={data.periods}
            moves={moves}
            indMoves={indMoves}
            from={data.sparkFrom}
            asof={data.asof}
          />
        ) : (
          <section className="card">
            <h2 className="card-title">종목 · 상대강도 순</h2>
            <StockList stocks={sector.stocks} from={data.sparkFrom} asof={data.asof} />
            <p className="muted small-note">
              상대강도는 최근 12개월 수익률을 최근 3개월에 무게를 두어 전 종목과 비교한 순위(1~99)입니다. 시가총액 1,000억원 이상만 보이며, 종목을 누르면 차트가
              열립니다.
            </p>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
