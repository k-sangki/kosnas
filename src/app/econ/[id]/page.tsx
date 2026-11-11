import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/app/layout";
import { EconItem } from "@/components/EconBoard";
import { Fold } from "@/components/Fold";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import names from "@/data/econ-names.json";
import { VERDICT, dayLabel, kstDate, kstHm, type Release } from "@/lib/econ";
import { findEcon, indicatorReleases, openEcon } from "@/lib/econ-pages";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

/**
 * 지표 하나의 페이지(/econ/cpi …): 'CPI 예상'·'CPI 결과' 검색어의 주인.
 * 다음 발표 예상치와 가장 최근 결과는 서버가 글로 그리고(검색 로봇이 읽는다), 막대 카드는 실시간으로 다시 그린다.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return openEcon.map((p) => ({ id: p.id }));
}

const GROUPS = names.groups as Record<string, { name: string; emoji: string }>;

export async function generateMetadata({ params }: PageProps<"/econ/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = findEcon(id);
  if (!p) return {};
  return pageMeta({ title: p.title, description: p.description, keywords: p.keywords, path: `/econ/${id}` });
}

const when = (r: Release) => `${dayLabel(kstDate(r.at))} ${kstHm(r.at)}`;

export default async function EconItemPage({ params }: PageProps<"/econ/[id]">) {
  const { id } = await params;
  const p = findEcon(id);
  if (!p) notFound();
  const g = GROUPS[id];
  const { last, next } = indicatorReleases(id);
  const nm = next?.metrics[0];
  const lm = last?.metrics[0];
  const others = openEcon.filter((x) => x.id !== id);

  return (
    <div className="shell">
      <SiteHeader />
      <main className="stack">
        <JsonLd
          data={breadcrumbLd(SITE_URL, [
            ["경제지표 예상과 결과", "/econ"],
            [`${p.short} 예상과 결과`, `/econ/${id}`],
          ])}
        />
        <h1 className="page-title">
          {g?.emoji} {p.short} 예상치와 발표 결과
        </h1>
        <p className="lead">
          {g?.name}의 다음 발표 예상치와 가장 최근 결과입니다. 시각은 모두 한국 시각입니다.
        </p>
        <section className="card econ-sum">
          {next && nm ? (
            <p>
              <b>다음 발표</b> {when(next)} · {nm.label} 예상 <b>{nm.f || "미정"}</b>
              {nm.p && <> (직전 {nm.p})</>}
            </p>
          ) : (
            <p>
              <b>다음 발표</b> 달력에 아직 잡히지 않았습니다. {p.when}
            </p>
          )}
          {last && lm && (
            <p>
              <b>지난 발표</b> {when(last)} · {lm.label} <b>{lm.a}</b>
              {lm.f && <>, 예상 {lm.f}</>}
              {lm.verdict && <> → {VERDICT[lm.verdict]}</>}
            </p>
          )}
        </section>

        <EconItem group={id} />

        <section className="card seo-text">
          <Fold title={`${p.short}란? · 발표 시각 · 보는 법`}>
            <h2>{g?.name}</h2>
            {p.what.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <h3>언제 나오나</h3>
            <p>{p.when}</p>
            <h3>시장이 보는 법</h3>
            {p.read.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <p className="muted">
              결과 옆 호재·악재 표시는 미국 증시 쪽에서 흔히 하는 해석을 차이 크기로 나눈 추정일 뿐이며 실제 시장 반응은 다를 수 있습니다. 특정 종목의 매수·매도를 권하지 않습니다.
            </p>
          </Fold>
        </section>

        <section className="card">
          {others.length > 0 && <h2 className="card-title">다른 지표</h2>}
          <p className="econ-links">
            {others.map((x) => (
              <Link key={x.id} href={`/econ/${x.id}`}>
                {x.short}
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
