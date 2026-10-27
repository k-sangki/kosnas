import Link from "next/link";

/** 국장 아래 하위 탭: 섹터 순환(/kr) | 종목 검색(/kr/screener…). 토스증권처럼 화면 아래에 붙은 탭 막대 */
export function KrTabs({ active }: { active: "sectors" | "screener" }) {
  const tabs = [
    {
      key: "sectors",
      href: "/kr",
      name: "섹터 순환",
      icon: (
        <>
          <path d="M20 12a8 8 0 0 1-14.2 5" />
          <path d="M4 12a8 8 0 0 1 14.2-5" />
          <path d="M18.5 3v4.2h-4.2M5.5 21v-4.2h4.2" />
        </>
      ),
    },
    {
      key: "screener",
      href: "/kr/screener",
      name: "종목 검색",
      icon: (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </>
      ),
    },
  ] as const;
  return (
    <nav className="bottom-tabs" aria-label="국장 메뉴">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} aria-current={active === t.key ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden>
            {t.icon}
          </svg>
          <span>{t.name}</span>
        </Link>
      ))}
    </nav>
  );
}
