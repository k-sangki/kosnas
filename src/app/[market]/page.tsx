import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketContent } from "@/components/MarketPage";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { UsContent } from "@/components/UsContent";

// 첫 화면(/)은 시각에 따라 바뀌므로 국장(/kr)·미장(/us)은 늘 같은 주소로도 연다.
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ market: "kr" }, { market: "us" }];
}

export async function generateMetadata({ params }: PageProps<"/[market]">): Promise<Metadata> {
  const { market } = await params;
  return market === "us"
    ? {
        title: "미장 - 미국 증시 실시간 흐름",
        description: "미국 정규장 동안 S&P 500·나스닥 100과 한국 관련 종목의 등락을 실시간 차트로.",
        alternates: { canonical: "/us" },
      }
    : {
        title: "국장 - 코스피·코스닥 섹터 흐름",
        description: "코스피·코스닥 섹터별 강도와 그 변화, 시장 폭을 매일 장 마감 자료로.",
        alternates: { canonical: "/kr" },
      };
}

export default async function MarketRoute({ params }: PageProps<"/[market]">) {
  const { market } = await params;
  if (market !== "us" && market !== "kr") notFound();
  return (
    <div className="shell">
      <SiteHeader active={market} />
      <main className="stack">{market === "us" ? <UsContent /> : <MarketContent market="kr" />}</main>
      <SiteFooter />
    </div>
  );
}
