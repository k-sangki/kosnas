import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/app/layout";
import { EconItem } from "@/components/EconBoard";
import { Fold } from "@/components/Fold";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { VERDICT, dayLabel, earningKst, usd, type Earning } from "@/lib/econ";
import { companyEarnings, findEarn, openEarn } from "@/lib/econ-pages";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

/**
 * 주목 기업 하나의 실적 페이지(/econ/earnings/crwv …): '코어위브 실적'·'코어위브 실적 예상' 검색어의 주인.
 * 다음 발표일·예상 EPS와 가장 최근 실적은 서버가 글로 그린다.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return openEarn.map((p) => ({ sym: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/econ/earnings/[sym]">): Promise<Metadata> {
  const { sym } = await params;
  const p = findEarn(sym);
  if (!p) return {};
  return pageMeta({
    title: `${p.name} 실적 예상과 발표 결과 - ${p.sym} 실적 발표일·예상 EPS`,
    description: `${p.name}(${p.sym}) 다음 실적 발표일과 시장 예상 EPS, 1년 전 EPS, 발표 뒤 실제 EPS가 예상에 부합·상회·하회했는지 정리합니다. ${p.about}`,
    keywords: [`${p.name} 실적`, `${p.name} 실적 예상`, `${p.name} 실적 발표일`, `${p.sym} 실적`, `${p.sym} earnings`, `${p.name} EPS`],
    path: `/econ/earnings/${p.slug}`,
  });
}

/** '2026-11-10' → '2026년 11월 10일(화)' */
const longDay = (d: string) => `${d.slice(0, 4)}년 ${dayLabel(d)}`;

export default async function EarnItemPage({ params }: PageProps<"/econ/earnings/[sym]">) {
  const { sym } = await params;
  const p = findEarn(sym);
  if (!p) notFound();
  const { last, next, ly } = companyEarnings(p.sym);
  const k = next ? earningKst({ date: next.date, when: next.when } as Earning) : null;
  const others = openEarn.filter((x) => x.sym !== p.sym);

  return (
    <div className="shell">
      <SiteHeader />
      <main className="stack">
        <JsonLd
          data={breadcrumbLd(SITE_URL, [
            ["경제지표 예상과 결과", "/econ"],
            [`${p.name} 실적`, `/econ/earnings/${p.slug}`],
          ])}
        />
        <h1 className="page-title">
          💼 {p.name}({p.sym}) 실적 예상과 결과
        </h1>
        <p className="lead">{p.about}</p>
        <section className="card econ-sum">
          {next ? (
            <p>
              <b>다음 실적 발표</b> 미국 {longDay(next.date)}
              {next.when === "after" ? " 장 마감 뒤" : next.when === "pre" ? " 장 시작 전" : ""}
              {k?.when && (
                <>
                  {" "}
                  (한국 {dayLabel(k.date)} {k.when})
                </>
              )}
              {next.estimate && <> · 회사 확정 전 추정일</>}
              {next.f != null && (
                <>
                  {" "}
                  · 예상 EPS <b>{usd(next.f)}</b>
                </>
              )}
              {ly != null && <> (1년 전 {usd(ly)})</>}
            </p>
          ) : (
            <p>
              <b>다음 실적 발표</b> 날짜가 아직 잡히지 않았습니다. 보통 분기가 끝나고 4~6주 뒤에 발표합니다.
            </p>
          )}
          {last && (
            <p>
              <b>지난 발표</b> {longDay(last.date)} · EPS <b>{usd(last.a)}</b>
              {last.f != null && <>, 예상 {usd(last.f)}</>}
              {last.v && <> → {VERDICT[last.v]}</>}
            </p>
          )}
        </section>

        <EconItem sym={p.sym} />

        <section className="card seo-text">
          <Fold title={`${p.name} 실적에서 보는 것`}>
            <p>{p.about}</p>
            <p>{p.watch}</p>
            <p>
              주당순이익(EPS)이 애널리스트 평균 예상보다 크면 예상 상회, 작으면 예상 하회로 적습니다. 실적 발표 뒤 주가는 이번 분기 숫자보다
              회사가 내놓는 다음 분기 전망(가이던스)에 더 크게 움직이는 경우가 많습니다. 특정 종목의 매수·매도를 권하지 않습니다.
            </p>
          </Fold>
        </section>

        <section className="card">
          {others.length > 0 && <h2 className="card-title">다른 기업 실적</h2>}
          <p className="econ-links">
            {others.map((x) => (
              <Link key={x.sym} href={`/econ/earnings/${x.slug}`}>
                {x.name}
              </Link>
            ))}
          </p>
          <p>
            <Link href="/econ">경제지표 예상과 결과 전체 보기 ›</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
