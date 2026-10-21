import Link from "next/link";
import { Logo } from "./Logo";
import { US_ENABLED } from "@/lib/sectors";

export function SiteHeader({ active }: { active?: "kr" | "us" | "night" | "guide" }) {
  return (
    <header className="topbar">
      <Link href="/" aria-label="KosNas 홈" className="brand">
        <Logo />
      </Link>
      <nav className="top-nav">
        <Link href="/" aria-current={active === "kr" ? "page" : undefined}>
          국내
        </Link>
        {US_ENABLED && (
          <Link href="/us" aria-current={active === "us" ? "page" : undefined}>
            미국
          </Link>
        )}
        <Link href="/night" aria-current={active === "night" ? "page" : undefined}>
          야간
        </Link>
        <Link href="/guide" aria-current={active === "guide" ? "page" : undefined}>
          가이드
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <p>
        KosNas는 코스피·코스닥 시장의 섹터 흐름을 정리해 보여주는 정보 서비스입니다. 섹터 강도·상대강도·시장 폭은 금융위원회 주식시세정보(공공데이터포털)로
        직접 계산한 값이고, 업종은 DART 기업개황의 표준산업분류를 바탕으로 나눴습니다. 종목 가격과 차트는 트레이딩뷰가 제공합니다. 야간 추정은 Hyperliquid(trade.xyz) 무기한선물 시세로 계산한 참고값입니다. 특정 종목의 매수·매도를
        권하지 않으며 투자 판단과 그 결과의 책임은 이용자 본인에게 있습니다.
      </p>
      <nav className="foot-links">
        <Link href="/about">소개</Link>
        <Link href="/guide">가이드</Link>
        <Link href="/privacy">개인정보처리방침</Link>
        <Link href="/contact">문의</Link>
      </nav>
      <p>© KosNas</p>
    </footer>
  );
}
