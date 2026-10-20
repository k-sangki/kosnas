import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader({ active }: { active?: "kr" | "us" }) {
  return (
    <header className="topbar">
      <Link href="/" aria-label="KosNas 홈" className="brand">
        <Logo />
      </Link>
      <nav className="top-nav">
        <Link href="/" aria-current={active === "kr" ? "page" : undefined}>
          국내
        </Link>
        <Link href="/us" aria-current={active === "us" ? "page" : undefined}>
          미국
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <p>
        KosNas는 코스피·코스닥·나스닥 시장의 섹터 흐름을 정리해 보여주는 정보 서비스입니다. 화면의 섹터 강도와 순위는 공개 시세로 직접 계산한 값이며, 종목
        가격과 차트는 트레이딩뷰가 제공합니다. 특정 종목의 매수·매도를 권하지 않으며 투자 판단과 그 결과의 책임은 이용자 본인에게 있습니다.
      </p>
      <nav className="foot-links">
        <Link href="/about">소개</Link>
        <Link href="/privacy">개인정보처리방침</Link>
        <Link href="/contact">문의</Link>
      </nav>
      <p>© KosNas</p>
    </footer>
  );
}
