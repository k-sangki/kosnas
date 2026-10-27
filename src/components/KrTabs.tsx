import Link from "next/link";

/** 국장 아래 하위 탭: 섹터 순환(/kr) | 종목 검색(/kr/screener…) */
export function KrTabs({ active }: { active: "sectors" | "screener" }) {
  const tabs = [
    { key: "sectors", href: "/kr", name: "섹터 순환" },
    { key: "screener", href: "/kr/screener", name: "종목 검색" },
  ] as const;
  return (
    <nav className="sub-tabs" aria-label="국장 메뉴">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined}>
          {t.name}
        </Link>
      ))}
    </nav>
  );
}
