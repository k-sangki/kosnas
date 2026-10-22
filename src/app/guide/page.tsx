import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = pageMeta({
  title: "가이드",
  description:
    "섹터 순환과 네 칸 그래프, 상대강도(RS), 시장 폭, 코스피 야간선물 추정, EWY와 코스피의 관계까지 KosNas 화면을 읽는 법을 정리한 가이드 모음입니다.",
  path: "/guide",
});

export default function GuideIndex() {
  return (
    <div className="shell">
      <SiteHeader active="guide" />
      <main className="stack">
        <h1 className="page-title">가이드</h1>
        <p className="lead">KosNas 화면의 숫자가 무엇을 뜻하고 어떻게 계산하는지 정리했습니다.</p>
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/guide/${g.slug}`} className="card guide-card">
            <h2 className="card-title">{g.title}</h2>
            <p className="muted">{g.description}</p>
          </Link>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
