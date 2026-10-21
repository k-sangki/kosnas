import type { Metadata } from "next";
import { NightContent } from "@/components/NightContent";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "코스피 야간선물 실시간 추정 - 코스피200 야간 차트",
  description:
    "코스피 야간선물 지금 얼마? 국내 장이 끝난 뒤부터 다음 날 아침까지 코스피200 야간 흐름을 해외 무기한선물로 실시간 추정해 차트로 보여 줍니다. 야간선물 마감(06:00) 값과 다음 날 시가 가늠까지.",
  keywords: ["코스피 야간선물", "야간선물", "코스피야간선물", "코스피 야간", "코스피선물", "코스피200 야간선물", "코스피 야간 실시간", "야간선물 실시간"],
  alternates: { canonical: "/night" },
  openGraph: { title: "코스피 야간선물 실시간 추정 | KosNas", url: "/night" },
};

export default function Night() {
  return (
    <div className="shell">
      <SiteHeader active="night" />
      <main className="stack">
        <NightContent />
      </main>
      <SiteFooter />
    </div>
  );
}
