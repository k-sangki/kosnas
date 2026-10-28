import type { Metadata } from "next";
import { SECTOR_KEYWORDS, pageMeta } from "@/lib/seo";
import { sectorData } from "@/lib/sectors";
import { US_SECTOR_NAMES } from "@/lib/us-sector-etfs";
import { notFound } from "next/navigation";
import { MarketContent } from "@/components/MarketPage";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { UsContent } from "@/components/UsContent";
import { KrTabs } from "@/components/KrTabs";

// 첫 화면(/)은 시각에 따라 바뀌므로 국장(/kr)·미장(/us)은 늘 같은 주소로도 연다.
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ market: "kr" }, { market: "us" }];
}

export async function generateMetadata({ params }: PageProps<"/[market]">): Promise<Metadata> {
  const { market } = await params;
  if (market === "us")
    return pageMeta({
      title: "미국증시 실시간 - 나스닥·S&P 500 등락, 개장시간·휴장일과 미장 섹터 순위",
      description: `미국증시 지금 얼마? 정규장(한국 시각 22:30~05:00, 미국 표준시 기간 23:30~06:00) 동안 S&P 500·나스닥 100 등락을 실시간 차트로, 미장 섹터(${US_SECTOR_NAMES.join("·")})의 1주·1달·3달 등락률을 섹터 지도로 보여 줍니다. 미국증시 개장시간과 휴장일도 정리했습니다.`,
      keywords: ["미국증시", "미국 증시 실시간", "오늘 미국 증시", "현재 미국 증시", "미국증시 개장시간", "미국증시 휴장일", "미국 주식 휴장일", "미국 휴장일", "미국 장 휴장일", "나스닥 선물 지수", "미증시", "나스닥 실시간", "S&P 500 실시간", "해외증시", "미장 섹터", "미장 순환매", "미국 섹터 순위", "미국 섹터 등락", "미국 섹터 ETF", ...SECTOR_KEYWORDS.filter((k) => !k.startsWith("국장")), ...US_SECTOR_NAMES.map((n) => `미국 ${n} 섹터`)],
      path: "/us",
    });
  const names = sectorData("kr").sectors.map((s) => s.name);
  return pageMeta({
    title: "국장 섹터 순위 - 코스피·코스닥 섹터 등락률과 순환매",
    description: `국장 섹터 순위와 섹터별 등락률을 매일 장 마감 자료로. ${names.slice(0, 8).join(", ")} 등 코스피·코스닥 ${names.length}개 섹터의 순환매 흐름(주도·약화·소외·관찰)과 시장 폭을 한눈에.`,
    keywords: [...SECTOR_KEYWORDS, "코스피 섹터", "코스닥 섹터", ...names.flatMap((n) => [n, `${n} 섹터`])],
    path: "/kr",
  });
}

export default async function MarketRoute({ params }: PageProps<"/[market]">) {
  const { market } = await params;
  if (market !== "us" && market !== "kr") notFound();
  return (
    <div className="shell">
      <SiteHeader active={market} />
      <main className="stack">
        {market === "us" ? (
          <UsContent />
        ) : (
          <>
            <KrTabs active="sectors" />
            <MarketContent market="kr" />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
