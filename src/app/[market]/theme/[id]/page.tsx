import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/app/layout";
import { AD_SLOTS, AdSlot } from "@/components/AdSlot";
import { Fold } from "@/components/Fold";
import { JsonLd } from "@/components/JsonLd";
import { KrTabs } from "@/components/KrTabs";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { StockList } from "@/components/StockList";
import { breadcrumbLd, pageMeta } from "@/lib/seo";
import { capText } from "@/lib/screens";
import { signed } from "@/lib/sectors";
import { THEMES, findTheme, themeAsof, themeData, themeFaq, themeLabel, themeSparkFrom } from "@/lib/themes";

/**
 * 테마 관련주 페이지(로봇·ESS·원전·양자컴퓨터). 업종 분류로는 흩어져 있는 종목을
 * '로봇 관련주' 같은 검색어 하나에 맞춰 모은다. 자료가 바뀌면 다시 배포된다.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return THEMES.map((t) => ({ market: "kr", id: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/[market]/theme/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = findTheme(id);
  if (!t) return {};
  const { stocks } = themeData(t.id);
  const names = stocks.slice(0, 3).map((s) => s.name);
  return pageMeta({
    title: `${themeLabel(t)} 관련주·대장주 - 시가총액 순위와 등락률`,
    description: `${t.name} 관련주 ${stocks.length}종목을 시가총액 순으로 정리했습니다. ${names.length ? `${names.join("·")} 등 ` : ""}종목별 관련 사업과 오늘·5·20·60일 등락률, 52주 고점 대비, 테마 평균 등락률을 매일 장 마감 자료로 봅니다.`,
    keywords: [...t.keywords, ...names.map((n) => `${n} 주가`)],
    path: `/kr/theme/${t.id}`,
  });
}

export default async function ThemePage({ params }: PageProps<"/[market]/theme/[id]">) {
  const { market, id } = await params;
  const t = findTheme(id);
  if (market !== "kr" || !t) notFound();
  const { stocks, ret } = themeData(t.id);
  const faq = themeFaq(t);
  const top = stocks.slice(0, 3);
  const [y, m, d] = themeAsof.split("-").map(Number);
  const others = THEMES.filter((o) => o.id !== t.id);

  return (
    <div className="shell">
      <SiteHeader active="kr" />
      <main className="stack">
        <JsonLd
          data={breadcrumbLd(SITE_URL, [
            ["국장 섹터 순환", "/kr"],
            [`${t.name} 관련주`, `/kr/theme/${t.id}`],
          ])}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
          }}
        />
        <KrTabs active="sectors" />
        <Link href="/kr" className="back">
          ← 국장 섹터 순환
        </Link>
        <h1 className="page-title">{themeLabel(t)} 관련주·대장주</h1>
        <p className="lead">
          {t.about} {y}년 {m}월 {d}일 종가 기준 {stocks.length}종목
          {top.length > 0 && ` 가운데 시가총액이 가장 큰 종목은 ${top.map((s) => `${s.name}(${capText(s.capEok)})`).join(", ")}입니다`}.
          {ret["20"] != null && ` 최근 20거래일 테마 평균 등락률은 ${signed(ret["20"])}%입니다.`}
        </p>
        <section className="card">
          <h2 className="card-title">
            기간별 테마 평균 등락률 <span className="muted">{themeAsof} 종가 · 종목 단순 평균</span>
          </h2>
          <table className="ptable">
            <thead>
              <tr>
                {["5", "10", "20", "30", "60"].map((p) => (
                  <th key={p}>{p}일</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {["5", "10", "20", "30", "60"].map((p) => (
                  <td key={p} className={(ret[p] ?? 0) >= 0 ? "up" : "down"}>
                    {signed(ret[p])}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2 className="card-title">
            {t.name} 관련주 · 시가총액 순 <span className="muted">{stocks.length}종목</span>
          </h2>
          {stocks.length ? (
            <StockList
              stocks={stocks.map((s) => ({
                code: s.code,
                name: s.name,
                tv: `KRX:${s.code}`,
                rs: s.rs ?? 0,
                market: s.market,
                close: s.close,
                chg: s.chg,
                r: s.r,
                above50: s.above50,
                fromHigh: s.fromHigh,
                capEok: s.capEok,
                ind: `${s.note} · 시총 ${capText(s.capEok)}`,
              }))}
              from={themeSparkFrom}
              asof={themeAsof}
              period={20}
              showInd
            />
          ) : (
            <p className="muted">지금은 자료가 없습니다.</p>
          )}
          <p className="muted small-note">
            종목 이름 아래는 관련 사업 · 시가총액 · 최근 20거래일 등락률 · 52주 고점 대비입니다. 거래가 적은 작은 종목도 함께 보이니 거래대금을 함께 확인하세요. 종목을
            누르면 차트가 열립니다.
          </p>
        </section>
        <AdSlot slot={AD_SLOTS.sector} />
        <section className="card seo-text">
          <Fold title={`${t.name} 관련주는 무엇에 움직이나요`}>
            <p>{t.drivers}</p>
          </Fold>
          <Fold title="자주 묻는 질문">
            {faq.map(([q, a]) => (
              <div key={q}>
                <h3>{q}</h3>
                <p>{a}</p>
              </div>
            ))}
          </Fold>
          <Fold title="유의할 점">
            <p>
              관련주 목록은 코스나스가 공시된 사업 내용을 보고 고른 것이며 빠진 종목이 있을 수 있습니다. 숫자는 금융위원회 주식시세정보로 직접 계산했고 지나간 시세를
              정리한 것일 뿐, 특정 종목의 매수·매도를 권하지 않습니다.
            </p>
          </Fold>
        </section>
        <section className="card">
          <h2 className="card-title">함께 보기</h2>
          <ul className="guide-links">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/kr/theme/${o.id}`}>{o.name} 관련주</Link>
              </li>
            ))}
            {t.related.map(([name, path]) => (
              <li key={path}>
                <Link href={path}>{name}</Link>
              </li>
            ))}
            <li>
              <Link href="/kr/screener/market-cap">코스피·코스닥 시가총액 순위</Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
