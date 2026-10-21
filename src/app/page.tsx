import Link from "next/link";
import { MarketContent } from "@/components/MarketPage";
import { NightContent } from "@/components/NightContent";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { UsContent } from "@/components/UsContent";
import { hhmm } from "@/lib/night";
import { TAB_NAME, frontNow } from "@/lib/session";

// 들어온 시각(KST)에 맞는 시장을 먼저 보여 준다: 08~18시 국장, 미국 정규장 중 미장, 그 밖에는 야간 코스피
export const dynamic = "force-dynamic";

export default function Home() {
  const { now, tab } = frontNow();
  return (
    <div className="shell">
      <SiteHeader active={tab} />
      <main className="stack">
        <p className="front-note">
          지금(한국 시각 {hhmm(now)})은 {TAB_NAME[tab]} 시간이라 {TAB_NAME[tab]}{tab === "night" ? "를" : "을"} 먼저 보여 드려요.
          {(["kr", "night", "us"] as const)
            .filter((t) => t !== tab)
            .map((t) => (
              <Link key={t} href={`/${t}`}>
                {TAB_NAME[t]} 보기
              </Link>
            ))}
        </p>
        {tab === "kr" ? <MarketContent market="kr" /> : tab === "night" ? <NightContent /> : <UsContent />}
      </main>
      <SiteFooter />
    </div>
  );
}
