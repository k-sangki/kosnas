import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SECTOR_KEYWORDS, breadcrumbLd, pageMeta } from "@/lib/seo";
import { SITE_URL } from "@/app/layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { SampleNotice } from "@/components/MarketPage";
import { Fold } from "@/components/Fold";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { StockList } from "@/components/StockList";
import { BASE_FILTER, MARKETS, QUADRANTS, findIndustry, findSector, industryPages, sectorData, signed, type Market } from "@/lib/sectors";

/**
 * 산업 페이지. 섹터 페이지 안에서 고르던 산업(메모리·변압기·전선 …)을 따로 열어
 * '메모리 관련주 등락률' 같은 좁은 검색어로 들어오게 한다. 숫자는 섹터 페이지와 같은 자료다.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return MARKETS.flatMap((market) => industryPages(market).map((i) => ({ market, id: i.id })));
}

function read(market: string, id: string) {
  if (!(MARKETS as string[]).includes(market)) return undefined;
  const m = market as Market;
  const ind = findIndustry(m, id);
  const sector = ind && findSector(m, ind.sector);
  return ind && sector ? { market: m, ind, sector } : undefined;
}

export async function generateMetadata({ params }: PageProps<"/[market]/industry/[id]">): Promise<Metadata> {
  const { market, id } = await params;
  const hit = read(market, id);
  if (!hit) return {};
  const { ind, sector } = hit;
  const names = sector.stocks
    .filter((s) => s.ind === ind.name)
    .slice(0, 3)
    .map((s) => s.name);
  return pageMeta({
    title: `${ind.name} 관련주 등락률·순위 - ${sector.name} 섹터 산업 순환매`,
    description: `국장 ${ind.name} 관련주(${sector.name} 섹터) ${ind.count ?? ""}종목의 5·10·20·30·60일 등락률과 전체 산업 중 순위, 순환매 흐름(주도·약화·소외·관찰)${
      names.length ? `, ${names.join("·")} 등 종목별 상대강도 순위` : ""
    }.`,
    keywords: [ind.name, `${ind.name} 관련주`, `${ind.name} 관련주 등락률`, `${ind.name} 주가`, `${ind.name} 순환매`, `${sector.name} 섹터`, ...SECTOR_KEYWORDS],
    path: `/${market}/industry/${id}`,
  });
}

export default async function IndustryPage({ params }: PageProps<"/[market]/industry/[id]">) {
  const { market, id } = await params;
  const hit = read(market, id);
  if (!hit) notFound();
  const { ind, sector } = hit;
  const data = sectorData(hit.market);
  const all = data.industries ?? [];
  const rankOf = (p: number) => {
    const v = ind.ret[p];
    if (v == null) return null;
    const pool = all.filter((s) => s.ret[p] != null);
    return { n: pool.filter((s) => s.ret[p]! > v).length + 1, of: pool.length };
  };
  const qName = (p: number) => QUADRANTS.find((q) => q.key === ind.q[p])?.name;
  const stocks = sector.stocks.filter((s) => s.ind === ind.name);
  const siblings = industryPages(hit.market).filter((i) => i.sector === sector.id && i.id !== ind.id);
  const r20 = rankOf(20);
  const r5 = rankOf(5);
  const lead = ind.leader?.shown ? ind.leader.name : null;

  return (
    <div className="shell">
      <SiteHeader active={hit.market} />
      <main className="stack">
        <JsonLd
          data={breadcrumbLd(SITE_URL, [
            ["국장 섹터 순환", `/${hit.market}`],
            [`${sector.name} 섹터`, `/${hit.market}/sector/${sector.id}`],
            [`${ind.name} 관련주`, `/${hit.market}/industry/${ind.id}`],
          ])}
        />
        <Link href={`/${hit.market}/sector/${sector.id}`} className="back">
          ← {sector.name} 섹터
        </Link>
        <h1 className="page-title">{ind.name} 관련주 등락률·순위</h1>
        {data.sample && <SampleNotice asof={data.asof} />}
        <p className="lead">
          국장 {sector.name} 섹터의 {ind.name} 산업에는 보통주 {ind.count ?? stocks.length}종목이 들어 있습니다.
          {r20 && ` ${data.asof} 종가 기준 최근 20거래일 등락률은 ${signed(ind.ret[20])}%로 전체 ${r20.of}개 산업 가운데 ${r20.n}위`}
          {r20 && qName(20) && `, 네 칸 위치는 '${qName(20)}'입니다.`}
          {r5 && ` 최근 5거래일은 ${signed(ind.ret[5])}%(${r5.n}위)였습니다.`}
          {lead && ` 시가총액이 가장 큰 종목은 ${lead}입니다.`}
        </p>
        <section className="card">
          <h2 className="card-title">
            기간별 등락률과 산업 순위 <span className="muted">{data.asof} 종가 기준</span>
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
              {data.periods.map((p) => {
                const r = rankOf(p);
                return (
                  <tr key={p}>
                    <td>{p}일</td>
                    <td className={(ind.ret[p] ?? 0) >= 0 ? "up" : "down"}>{signed(ind.ret[p])}%</td>
                    <td>{signed(ind.x[p])}%p</td>
                    <td>{r ? `${r.n}/${r.of}` : "-"}</td>
                    <td>{qName(p) ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small-note">
            강도는 전체 산업 평균 대비 %p입니다. 50일선 위 종목 {ind.above50 ?? "-"}% · 52주 신고가 {ind.newHighs ?? 0}종목
            {ind.rsLeaders != null ? ` · 상대강도 80 이상 ${ind.rsLeaders}종목` : ""}
          </p>
        </section>
        <AdSlot slot={AD_SLOTS.sector} />
        <section className="card">
          <h2 className="card-title">{ind.name} 관련주 · 상대강도 순</h2>
          {stocks.length ? (
            <StockList stocks={stocks} from={data.sparkFrom} asof={data.asof} />
          ) : (
            <p className="muted">지금은 기본 필터를 통과한 종목이 없습니다.</p>
          )}
          <p className="muted small-note">
            기본 필터({BASE_FILTER})를 통과한 종목만 보이며, 등락률·순위 계산에는 모든 보통주를 씁니다. 상대강도는 최근 12개월 수익률을 최근 3개월에 무게를 두어 전
            종목과 비교한 순위(1~99)입니다. 종목을 누르면 차트가 열립니다.
          </p>
        </section>
        <section className="card seo-text">
          <Fold title="이 숫자를 읽는 법">
            <p>
              산업은 같은 섹터 안에서도 실적이 함께 움직이는 회사끼리 다시 나눈 묶음입니다. 섹터 전체가 약해도 그 안의 한 산업만 먼저 강해지는 일이 많아, 순환매를 볼 때는
              섹터 다음에 산업을 봅니다. 네 칸(주도·약화·소외·관찰)의 뜻은 <Link href="/guide/quadrant">네 칸 읽는 법</Link>, 섹터와 산업을 나누는 기준은{" "}
              <Link href="/guide/industry">섹터와 산업은 어떻게 나누나요</Link>에 정리했습니다. 특정 종목의 매수·매도를 권하지 않습니다.
            </p>
          </Fold>
        </section>
        {siblings.length > 0 && (
          <section className="card">
            <h2 className="card-title">{sector.name} 섹터의 다른 산업</h2>
            <ul className="guide-links">
              {siblings.map((s) => (
                <li key={s.id}>
                  <Link href={`/${hit.market}/industry/${s.id}`}>{s.name} 관련주</Link>
                </li>
              ))}
              <li>
                <Link href={`/${hit.market}/sector/${sector.id}`}>{sector.name} 섹터 전체</Link>
              </li>
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
