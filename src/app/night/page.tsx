import type { Metadata } from "next";
import { NightContent } from "@/components/NightContent";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "야간 코스피 - 코스피200 야간 추정",
  description: "국내 장이 닫힌 밤사이 해외에서 거래되는 한국 관련 무기한선물로 계산한 코스피200 추정 흐름을 실시간 차트로 보여줍니다.",
  alternates: { canonical: "/night" },
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
