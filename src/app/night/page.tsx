import type { Metadata } from "next";
import { NightContent } from "@/components/NightContent";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "코스피 야간선물 실시간 시세 | 삼성전자·하이닉스 야간 차트",
  description:
    "코스피 야간선물(야선) 지금 얼마? 코스피200 야간선물 시세를 해외 24시간 시세로 실시간 추정한 차트와 삼성전자·SK하이닉스 야간 차트. 주간 종가 대비 등락률, 06:00 마감 값, 다음 날 시가 가늠까지 15:45부터 09:00까지 이어 봅니다.",
  keywords: ["코스피 야간선물", "코스피 야간선물 실시간 시세", "코스피 야간선물 시세", "코스피야간선물", "삼성전자 야간 차트", "하이닉스 야간 차트", "코스피200 야간선물", "코스피200야간선물", "야간선물", "코스피 야간", "코스피선물", "코스피 야간 실시간", "야간선물 실시간", "야선", "코스피 야선", "야간 선물", "야간선물 지수", "코스피 야간선물지수", "코스피 선물", "야간 선물 실시간"],
  path: "/night",
});

export default function Night() {
  return (
    <div className="shell">
      <SiteHeader active="night" />
      <main className="stack">
        <NightContent page="night" />
      </main>
      <SiteFooter />
    </div>
  );
}
