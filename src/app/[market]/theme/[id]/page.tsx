import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/app/layout";
import { AdSlot } from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/ad-slots";
import { Fold } from "@/components/Fold";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { StockList } from "@/components/StockList";
import { THEME_GUIDES } from "@/lib/theme-guides";
import { asofDay, asofPrefix, breadcrumbLd, datasetLd, pageMeta } from "@/lib/seo";
import { capText } from "@/lib/screens";
import { sectorData, signed } from "@/lib/sectors";
import {
  THEMES,
  findTheme,
  themeAsof,
  themeData,
  themeFaq,
  themeLabel,
  themeSparkFrom,
} from "@/lib/themes";

/**
 * 테마 관련주 페이지(로봇·ESS·원전·양자컴퓨터). 업종 분류로는 흩어져 있는 종목을
 * '로봇 관련주' 같은 검색어 하나에 맞춰 모은다. 자료가 바뀌면 다시 배포된다.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return THEMES.map((t) => ({ market: "kr", id: t.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[market]/theme/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = findTheme(id);
  if (!t) return {};
  const { stocks } = themeData(t.id);
  const names = stocks.slice(0, 3).map((s) => s.name);
  return pageMeta({
    // 노출은 많은데 클릭이 0~1이던 자리(2026-11-17 서치콘솔 28일: 원전 176·ESS 140·로봇 100). 경쟁 글처럼
    // 종목 수와 자료 날짜를 제목에 넣어 '정리된 최신 목록'임을 먼저 보인다. 날짜는 장 마감 자료 갱신 때 바뀐다.
    title: `${themeLabel(t)} 관련주 대장주 ${stocks.length}종목 - 시총 순위·등락률${asofDay(sectorData("kr").asof) ? ` (${asofDay(sectorData("kr").asof)})` : ""}`,
    description: `${asofPrefix(sectorData("kr").asof)}${t.name} 관련주 ${stocks.length}종목을 시가총액 순으로 정리했습니다. ${names.length ? `${names.join("·")} 등 ` : ""}종목별 관련 사업과 오늘·5·20·60일 등락률, 52주 고점 대비, 테마 평균 등락률을 매일 장 마감 자료로 봅니다.`,
    keywords: [
      ...t.keywords,
      `${t.name} 주식`,
      `${t.name}주 시총 순위`,
      `${t.name} 시총 순위`,
      `${t.name}주 대장주`,
      ...names.map((n) => `${n} 주가`),
    ],
    path: `/kr/theme/${t.id}`,
  });
}

export default async function ThemePage({
  params,
}: PageProps<"/[market]/theme/[id]">) {
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
          data={datasetLd(SITE_URL, {
            name: `${themeLabel(t)} 관련주·대장주`,
            description: `사업 내용으로 고른 ${t.name} 관련주 ${stocks.length}종목의 시가총액, 기간별 등락률과 테마 평균 등락률.`,
            path: `/kr/theme/${t.id}`,
            asof: themeAsof,
            keywords: t.keywords,
          })}
        />
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
            mainEntity: faq.map(([q, a]) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          }}
        />
        <Link href="/kr" className="back">
          ← 국장 섹터 순환
        </Link>
        <h1 className="page-title">{themeLabel(t)} 관련주 대장주 {stocks.length}종목</h1>
        <p className="lead">
          {t.about} {y}년 {m}월 {d}일 종가 기준 {stocks.length}종목
          {top.length > 0 &&
            ` 가운데 ${t.name} 대장주로 꼽히는 시가총액 상위 종목은 ${top.map((s) => `${s.name}(${capText(s.capEok)})`).join(", ")}입니다`}
          .
          {ret["20"] != null &&
            ` 최근 20거래일 테마 평균 등락률은 ${signed(ret["20"])}%입니다.`}
        </p>
        <section className="card">
          <h2 className="card-title">
            기간별 테마 평균 등락률{" "}
            <span className="muted">{themeAsof} 종가 · 종목 단순 평균</span>
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
            {t.name}주 시총 순위{" "}
            <span className="muted">{stocks.length}종목</span>
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
            종목 이름 아래는 관련 사업 · 시가총액 · 최근 20거래일 등락률 · 52주
            고점 대비입니다. 거래가 적은 작은 종목도 함께 보이니 거래대금을 함께
            확인하세요. 종목을 누르면 차트가 열립니다.
          </p>
        </section>
        {stocks.length > 0 && (
          <section className="card seo-text">
            <h2 className="card-title">
              숫자로 본 {t.name} 관련주{" "}
              <span className="muted">{themeAsof} 종가</span>
            </h2>
            <p>{themeSummary(t.name, stocks)}</p>
          </section>
        )}
        <AdSlot slot={AD_SLOTS.sector} />
        <section className="card seo-text">
          {(THEME_GUIDES[t.id] ?? []).map(([title, paras]) => (
            <Fold key={title} title={title}>
              {paras.map((x) => (
                <p key={x.slice(0, 20)}>{x}</p>
              ))}
            </Fold>
          ))}
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
              관련주 목록은 코스나스가 공시된 사업 내용을 보고 고른 것이며 빠진
              종목이 있을 수 있습니다. 숫자는 금융위원회 주식시세정보로 직접
              계산했고 지나간 시세를 정리한 것일 뿐, 특정 종목의 매수·매도를
              권하지 않습니다.
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
              <Link href="/kr/screener/market-cap">
                코스피·코스닥 시가총액 순위
              </Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

/** 그날 자료로 쓰는 한 문단(날마다 달라지는 고유 내용). 지나간 시세를 적을 뿐 권유하지 않는다 */
function themeSummary(
  name: string,
  stocks: { name: string; above50: boolean; fromHigh: number | null; r: Record<string, number | null> }[],
) {
  const n = stocks.length;
  const up50 = stocks.filter((s) => s.above50).length;
  const r20 = stocks.filter((s) => s.r["20"] != null).sort((a, b) => b.r["20"]! - a.r["20"]!);
  const rising = r20.filter((s) => s.r["20"]! > 0).length;
  const fh = stocks.map((s) => s.fromHigh).filter((v): v is number => v != null).sort((a, b) => a - b);
  const med = fh.length ? fh[Math.floor(fh.length / 2)] : null;
  const parts = [
    `${name} 관련주 ${n}종목 가운데 50일 이동평균선 위에 있는 종목은 ${up50}개(${Math.round((up50 / n) * 100)}%)입니다.`,
  ];
  if (r20.length) {
    const best = r20[0];
    const worst = r20[r20.length - 1];
    parts.push(
      `최근 20거래일 동안 오른 종목은 ${rising}개, 내린 종목은 ${r20.length - rising}개였고, 가장 많이 오른 종목은 ${best.name}(${signed(best.r["20"])}%), 가장 많이 내린 종목은 ${worst.name}(${signed(worst.r["20"])}%)입니다.`,
    );
  }
  if (med != null) parts.push(`종목들의 52주 고점 대비 거리는 중간값 ${med.toFixed(1)}%입니다.`);
  parts.push(
    up50 / n >= 0.6
      ? "절반이 훨씬 넘는 종목이 50일선 위에 있어 테마 전반이 함께 움직이는 구간으로 볼 수 있습니다."
      : up50 / n <= 0.3
        ? "50일선 위 종목이 적어 테마 전반은 약한 흐름이고, 오르는 종목은 일부에 그치고 있습니다."
        : "50일선 위 종목이 절반 안팎이라 테마 안에서도 종목별로 흐름이 갈리고 있습니다.",
  );
  return parts.join(" ");
}
