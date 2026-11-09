import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import {
  SECTOR_KEYWORDS,
  breadcrumbLd,
  datasetLd,
  industryKeywords,
  industryLabel,
  pageMeta,
} from "@/lib/seo";
import { SITE_URL } from "@/app/layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ad-slots";
import { SampleNotice } from "@/components/MarketPage";
import { Fold } from "@/components/Fold";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { StockList } from "@/components/StockList";
import {
  BASE_FILTER,
  MARKETS,
  QUADRANTS,
  findIndustry,
  findSector,
  industryIndexable,
  industryPages,
  sectorData,
  signed,
  type Market,
} from "@/lib/sectors";
import { INDUSTRY_NOTES } from "@/lib/industry-notes";

/**
 * 산업 페이지. 섹터 페이지 안에서 고르던 산업(메모리·변압기·전선 …)을 따로 열어
 * '메모리 관련주 등락률' 같은 좁은 검색어로 들어오게 한다. 숫자는 섹터 페이지와 같은 자료다.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return MARKETS.flatMap((market) =>
    industryPages(market).map((i) => ({ market, id: i.id })),
  );
}

function read(market: string, id: string) {
  if (!(MARKETS as string[]).includes(market)) return undefined;
  const m = market as Market;
  const ind = findIndustry(m, id);
  const sector = ind && findSector(m, ind.sector);
  return ind && sector ? { market: m, ind, sector } : undefined;
}

export async function generateMetadata({
  params,
}: PageProps<"/[market]/industry/[id]">): Promise<Metadata> {
  const { market, id } = await params;
  const hit = read(market, id);
  if (!hit) return {};
  const { ind, sector } = hit;
  const names = sector.stocks
    .filter((s) => s.ind === ind.name)
    .slice(0, 3)
    .map((s) => s.name);
  const note = INDUSTRY_NOTES[ind.name];
  const meta = pageMeta({
    title: `${industryLabel(ind.name)} 관련주 등락률·순위 - ${sector.name} 섹터 산업 순환매`,
    description: `${note ? `${note.what} ` : ""}국장 ${industryLabel(ind.name)} 관련주(${sector.name} 섹터) ${ind.count ?? ""}종목의 5·10·20·30·60일 등락률과 전체 산업 중 순위, 순환매 흐름(주도·약화·소외·관찰)${
      names.length ? `, ${names.join("·")} 등 종목별 상대강도 순위` : ""
    }.`,
    keywords: [
      ...industryKeywords(ind.name),
      `${ind.name} 관련주 등락률`,
      `${ind.name} 순환매`,
      `${sector.name} 섹터`,
      ...SECTOR_KEYWORDS,
    ],
    path: `/${market}/industry/${id}`,
  });
  return industryIndexable(hit.market, ind)
    ? meta
    : { ...meta, robots: { index: false, follow: true } };
}

export default async function IndustryPage({
  params,
}: PageProps<"/[market]/industry/[id]">) {
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
  const siblings = industryPages(hit.market).filter(
    (i) => i.sector === sector.id && i.id !== ind.id,
  );
  const r20 = rankOf(20);
  const r5 = rankOf(5);
  const lead = ind.leader?.shown ? ind.leader.name : null;
  const note = INDUSTRY_NOTES[ind.name];

  return (
    <div className="shell">
      <SiteHeader active={hit.market} />
      <main className="stack">
        {!data.sample && (
          <JsonLd
            data={datasetLd(SITE_URL, {
              name: `${industryLabel(ind.name)} 관련주 등락률·순위`,
              description: `국장 ${sector.name} 섹터 ${ind.name} 산업 보통주 ${ind.count ?? stocks.length}종목의 기간별 등락률, 산업 순위, 종목별 상대강도.`,
              path: `/${hit.market}/industry/${ind.id}`,
              asof: data.asof,
              keywords: industryKeywords(ind.name),
            })}
          />
        )}
        <JsonLd
          data={breadcrumbLd(SITE_URL, [
            ["국장 섹터 순환", `/${hit.market}`],
            [`${sector.name} 섹터`, `/${hit.market}/sector/${sector.id}`],
            [
              `${industryLabel(ind.name)} 관련주`,
              `/${hit.market}/industry/${ind.id}`,
            ],
          ])}
        />
        <Link href={`/${hit.market}/sector/${sector.id}`} className="back">
          ← {sector.name} 섹터
        </Link>
        <h1 className="page-title">
          {industryLabel(ind.name)} 관련주 등락률·순위
        </h1>
        {data.sample && <SampleNotice asof={data.asof} />}
        <p className="lead">
          국장 {sector.name} 섹터의 {ind.name} 산업에는 보통주{" "}
          {ind.count ?? stocks.length}종목이 들어 있습니다.
          {r20 &&
            ` ${data.asof} 종가 기준 최근 20거래일 등락률은 ${signed(ind.ret[20])}%로 전체 ${r20.of}개 산업 가운데 ${r20.n}위`}
          {r20 && qName(20) && `, 네 칸 위치는 '${qName(20)}'입니다.`}
          {r5 && ` 최근 5거래일은 ${signed(ind.ret[5])}%(${r5.n}위)였습니다.`}
          {lead && ` 시가총액이 가장 큰 종목은 ${lead}입니다.`}
        </p>
        {note && (
          <section className="card seo-text">
            <Fold title={`${ind.name} 산업은`}>
              <p>{note.what}</p>
              <p>{note.drivers}</p>
            </Fold>
          </section>
        )}
        <section className="card">
          <h2 className="card-title">
            기간별 등락률과 산업 순위{" "}
            <span className="muted">{data.asof} 종가 기준</span>
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
                    <td className={(ind.ret[p] ?? 0) >= 0 ? "up" : "down"}>
                      {signed(ind.ret[p])}%
                    </td>
                    <td>{signed(ind.x[p])}%p</td>
                    <td>{r ? `${r.n}/${r.of}` : "-"}</td>
                    <td>{qName(p) ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small-note">
            강도는 전체 산업 평균 대비 %p입니다. 50일선 위 종목{" "}
            {ind.above50 ?? "-"}% · 52주 신고가 {ind.newHighs ?? 0}종목
            {ind.rsLeaders != null
              ? ` · 상대강도 80 이상 ${ind.rsLeaders}종목`
              : ""}
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
            기본 필터({BASE_FILTER}) 통과 종목만 보입니다. 계산 방법은{" "}
            <Link href="/guide/relative-strength">상대강도</Link>·
            <Link href="/guide/quadrant">네 칸 읽는 법</Link>·
            <Link href="/guide/industry">섹터와 산업 나누기</Link>에 있습니다.
          </p>
        </section>
        {siblings.length > 0 && (
          <section className="card">
            <h2 className="card-title">{sector.name} 섹터의 다른 산업</h2>
            <ul className="guide-links">
              {siblings.map((s) => (
                <li key={s.id}>
                  <Link href={`/${hit.market}/industry/${s.id}`}>
                    {s.name} 관련주
                  </Link>
                </li>
              ))}
              <li>
                <Link href={`/${hit.market}/sector/${sector.id}`}>
                  {sector.name} 섹터 전체
                </Link>
              </li>
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
