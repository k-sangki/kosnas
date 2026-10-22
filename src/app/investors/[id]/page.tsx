import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Holdings, Sold } from "@/components/Investors13F";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { INVESTORS, findInvestor, label, quarter, usd } from "@/lib/investors13f";

export const dynamicParams = false;

export function generateStaticParams() {
  return INVESTORS.map((i) => ({ id: i.id }));
}

export async function generateMetadata({ params }: PageProps<"/investors/[id]">): Promise<Metadata> {
  const inv = findInvestor((await params).id);
  if (!inv) return {};
  const top = inv.holdings
    .slice(0, 5)
    .map((h) => label(h))
    .join(", ");
  return {
    title: `${inv.person} 포트폴리오 - ${inv.firm} 13F 보유 종목 (${quarter(inv.period)})`,
    description: `${inv.person}(${inv.firm})의 ${quarter(inv.period)} 말 13F 보유 종목 ${inv.count}개와 지난 분기 대비 새로 산 종목·판 종목. 상위: ${top}.`,
    alternates: { canonical: `/investors/${inv.id}` },
  };
}

export default async function InvestorPage({ params }: PageProps<"/investors/[id]">) {
  const inv = findInvestor((await params).id);
  if (!inv) notFound();
  const fresh = inv.holdings.filter((h) => h.change === "new" && !h.put_call && !h.prn);
  return (
    <div className="shell">
      <SiteHeader active="us" />
      <main className="stack">
        <p className="muted">
          <Link href="/us">← 미장 탭</Link>
        </p>
        <h1 className="page-title">{inv.person} 포트폴리오</h1>
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
                  {label(h)} <small className="muted">{h.weight?.toFixed(1)}%</small>
                </span>
              ))}
            </p>
          </section>
        )}
        <Holdings inv={inv} />
        <Sold inv={inv} />
        <p className="small-note muted">
          SEC 13F 보고서는 분기 말 기준 미국 상장 주식 보유만 담고, 분기가 끝나고 최대 45일 뒤에 공개됩니다. 읽는 법은{" "}
          <Link href="/us">미장 탭 유명 투자자 포트폴리오</Link>에 있습니다. 특정 종목의 매수·매도를 권하지 않습니다.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
