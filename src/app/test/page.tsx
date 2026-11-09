import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/app/layout";
import { Fold } from "@/components/Fold";
import { InvestTest } from "@/components/InvestTest";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { MASTERS } from "@/lib/invest-test";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "투자 성향 테스트 - 나는 어떤 투자 대가와 닮았을까",
  description:
    "12문항 1분 투자 성향 테스트. 워런 버핏·캐시 우드·마이클 버리·레이 달리오 등 투자 대가 8명 중 나와 가장 닮은 사람과 닮은 비중을 %로 보여 주고, 결과 카드를 캡처해 공유할 수 있습니다.",
  keywords: [
    "투자 성향 테스트",
    "주식 성향 테스트",
    "투자 MBTI",
    "주식 MBTI",
    "투자 유형 테스트",
    "워런 버핏",
    "캐시 우드",
  ],
  path: "/test",
});

export default function TestPage() {
  return (
    <div className="shell">
      <SiteHeader />
      <main className="stack">
        <JsonLd
          data={breadcrumbLd(SITE_URL, [["투자 성향 테스트", "/test"]])}
        />
        <InvestTest />
        <section className="card seo-text">
          <Fold title="결과로 나오는 대가 8명">
            <ul className="guide-links">
              {MASTERS.map((m) => (
                <li key={m.id}>
                  {m.emoji} <Link href={`/investors/${m.id}`}>{m.name}</Link>:{" "}
                  {m.line}
                </li>
              ))}
            </ul>
          </Fold>
          <Fold title="어떻게 계산하나요">
            <p>
              문항마다 고른 답이 대가들의 널리 알려진 투자 방식(보유 기간,
              집중과 분산, 위기 때의 행동, 먼저 보는 숫자)과 얼마나 같은지
              점수를 매기고, 대가마다 받을 수 있는 최대 점수로 나눈 뒤 8명의 합이
              100%가 되는 비중으로 나타냅니다. 재미로 보는 테스트이며 투자 실력이나 수익을 판정하지
              않고, 특정 종목의 매수·매도를 권하지 않습니다.
            </p>
            <p>
              대가들이 실제로 무엇을 들고 있는지는 미국 증권거래위원회(SEC)에 낸
              보고서로 확인할 수 있습니다.{" "}
              <Link href="/investors">유명 투자자 포트폴리오</Link>와{" "}
              <Link href="/guide">가이드</Link>에서 볼 수 있습니다.
            </p>
          </Fold>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
