import { MarketContent } from "@/components/MarketPage";
import { NightContent } from "@/components/NightContent";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { UsContent } from "@/components/UsContent";
import { frontNow } from "@/lib/session";

// 들어온 시각(KST)에 맞는 시장을 먼저 보여 준다: 08~18시 국장, 미국 정규장 중 미장, 그 밖에는 야간 코스피
export const dynamic = "force-dynamic";

export default function Home() {
  const { tab } = frontNow();
  return (
    <div className="shell">
      <SiteHeader active={tab} />
      <main className="stack">
        {tab === "kr" ? <MarketContent market="kr" /> : tab === "night" ? <NightContent /> : <UsContent />}
      </main>
      <SiteFooter />
    </div>
  );
}
