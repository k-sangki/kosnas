import { NightContent } from "@/components/NightContent";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

// 첫 화면은 시각과 상관없이 늘 대시보드
export default function Home() {
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
