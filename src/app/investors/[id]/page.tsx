import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { SITE_URL } from "@/app/layout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Holdings, Sold } from "@/components/Investors13F";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { INVESTORS, findInvestor, pieSlices, quarter, topText, usd } from "@/lib/investors13f";
import { koName } from "@/lib/ko-names";
import { PieChart } from "@/components/PieChart";
import { INVESTOR_NOTES } from "@/lib/investor-notes";
import { Fold } from "@/components/Fold";

export const dynamicParams = false;

export function generateStaticParams() {
  return INVESTORS.map((i) => ({ id: i.id }));
}

export async function generateMetadata({ params }: PageProps<"/investors/[id]">): Promise<Metadata> {
  const inv = findInvestor((await params).id);
  if (!inv) return {};
  const q = quarter(inv.period);
  const short = inv.person.split(" ").pop() ?? inv.person;
  const solid = inv.person.replace(/\s/g, "");
  return pageMeta({
    title: `${inv.person} 포트폴리오 - ${q} 보유 종목·비중 한눈에 (${inv.firm})`,
    description: `${inv.person}(${inv.firm}) ${q} 말 포트폴리오: ${topText(inv, 5)}. 보유 종목 ${inv.count}개의 비중을 파이차트로 보고, 이번 분기 새로 산 종목 ${inv.new_count}개·모두 판 종목 ${inv.sold_count}개까지 정리했습니다.`,
    keywords: [
      `${inv.person} 포트폴리오`,
      `${solid} 포트폴리오`,
      `${short} 포트폴리오`,
      `${inv.firm} 포트폴리오`,
      `${inv.person} 보유 종목`,
      `${short} 보유 종목`,
      `${short} 매수 종목`,
      `${inv.person} 13F`,
      `${inv.firm} 13F`,
      "13F",
      "유명 투자자 포트폴리오",
    ],
    path: `/investors/${inv.id}`,
  });
}

export default async function InvestorPage({ params }: PageProps<"/investors/[id]">) {
  const inv = findInvestor((await params).id);
  if (!inv) notFound();
  const note = INVESTOR_NOTES[inv.id];
  const fresh = inv.holdings.filter((h) => h.change === "new" && !h.put_call && !h.prn);
  return (
    <div className="shell">
      <SiteHeader active="us" />
      <main className="stack">
        <JsonLd data={breadcrumbLd(SITE_URL, [["유명 투자자", "/investors"], [`${inv.person} 포트폴리오`, `/investors/${inv.id}`]])} />
        <p className="muted">
          <Link href="/us#investors">← 유명 투자자 포트폴리오</Link>
        </p>
        <h1 className="page-title">{inv.person} 포트폴리오</h1>
        <p className="lead">
          {inv.person}({inv.firm})의 {quarter(inv.period)} 말 미국 주식 포트폴리오입니다. 보유 종목은 {inv.count}개이고, 비중 상위는{" "}
          {`${topText(inv, 5)}입니다.`}
        </p>
        <section className="card">
          <h2 className="card-title">
            포트폴리오 비중 <span className="muted">{quarter(inv.period)} 말 · 1% 미만은 기타</span>
          </h2>
          <PieChart slices={pieSlices(inv)} label={`${inv.person} 포트폴리오 비중`} />
        </section>
        {note && (
          <section className="card seo-text">
            <Fold title={`${inv.person}, 어떤 투자자인가`}>
              <p>{note.who}</p>
              <p>{note.read}</p>
            </Fold>
          </section>
        )}
        <section className="card">
          <dl className="inv-facts">
            <div>
              <dt>운용사</dt>
              <dd>{inv.firm}</dd>
            </div>
            <div>
              <dt>기준</dt>
              <dd>{quarter(inv.period)} 말</dd>
            </div>
            <div>
              <dt>신고 주식 총액</dt>
              <dd>{usd(inv.total)}</dd>
            </div>
            <div>
              <dt>종목 수</dt>
              <dd>{inv.count}개</dd>
            </div>
          </dl>
          <p className="small-note muted">
            {inv.filed} SEC 신고({inv.sec_name}){inv.prev_period && ` · 변화는 ${quarter(inv.prev_period)} 말 대비`}. 신규 {inv.new_count} · 추가{" "}
            {inv.add_count} · 축소 {inv.reduce_count} · 매도 {inv.sold_count}
          </p>
        </section>
        {fresh.length > 0 && (
          <section className="card">
            <h2 className="card-title">이번 분기 새로 산 종목</h2>
            <p className="inv-top">
              {fresh.map((h) => (
                <span key={h.cusip}>
                  {koName(h.ticker, h.name)} <small className="muted">{h.weight?.toFixed(1)}%</small>
                </span>
              ))}
            </p>
          </section>
        )}
        <Holdings inv={inv} />
        <Sold inv={inv} />
        <p className="small-note muted">
          SEC 13F 보고서는 분기 말 기준 미국 상장 주식 보유만 담고, 분기가 끝나고 최대 45일 뒤에 공개됩니다. 읽는 법은{" "}
          <Link href="/us#investors">미장 탭 유명 투자자 포트폴리오</Link>에 있습니다. 특정 종목의 매수·매도를 권하지 않습니다.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
