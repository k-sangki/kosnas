import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { TestResult } from "@/components/TestResult";
import { ANT, MASTERS, findResult } from "@/lib/invest-test";
import { pageMeta } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...MASTERS, ANT].map((m) => ({ type: m.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/test/[type]">): Promise<Metadata> {
  const m = findResult((await params).type);
  if (!m) return {};
  // 결과 페이지는 공유용이라 검색 노출에서 뺀다(같은 틀이 9개). 테스트 첫 화면만 노출
  return {
    ...pageMeta({
      title: `나는 ${m.name}형 ${m.emoji} ${m.nick} - 투자 성향 테스트`,
      description: `${m.line}. 12문항 1분, 나는 어떤 투자 대가와 닮았을까? 코스나스 투자 성향 테스트에서 나도 해보기.`,
      path: `/test/${m.id}`,
    }),
    robots: { index: false, follow: true },
  };
}

export default async function TestResultPage({
  params,
}: PageProps<"/test/[type]">) {
  const m = findResult((await params).type);
  if (!m) notFound();
  return (
    <div className="shell">
      <SiteHeader />
      <main className="stack">
        <TestResult id={m.id} />
      </main>
      <SiteFooter />
    </div>
  );
}
