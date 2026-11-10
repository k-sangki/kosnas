"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

/**
 * 토스식 하단탭(미장·국장). 주소는 그대로 두고 첫 탭 밖은 #id로 고른다(기존 색인 주소 유지).
 * 모든 탭 내용은 HTML에 그대로 있고 보이는 것만 바뀐다.
 */
export type IconName = "live" | "grid" | "pie" | "rank" | "map" | "tag";
export type Tab = { id: string; name: string; icon: IconName; panel: ReactNode };

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ICONS: Record<IconName, ReactNode> = {
  live: (
    <>
      <path d="M3 17l5-6 4 4 4-6 5 5" {...P} />
      <path d="M3 21h18" {...P} />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="8" height="10" rx="2" {...P} />
      <rect x="13" y="3" width="8" height="6" rx="2" {...P} />
      <rect x="3" y="15" width="8" height="6" rx="2" {...P} />
      <rect x="13" y="11" width="8" height="10" rx="2" {...P} />
    </>
  ),
  pie: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" {...P} />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" {...P} />
    </>
  ),
  rank: (
    <>
      <path d="M5 20V12M12 20V5M19 20v-5" {...P} />
    </>
  ),
  map: (
    <>
      <path d="M12 3v18M3 12h18" {...P} />
      <circle cx="16.5" cy="7.5" r="1.8" fill="currentColor" />
      <circle cx="7.5" cy="16.5" r="1.8" fill="currentColor" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" {...P} />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
    </>
  ),
};

export function BottomTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const first = tabs[0].id;
  const tab = useSyncExternalStore(
    subscribe,
    () => {
      const h = window.location.hash.slice(1);
      return tabs.some((t) => t.id === h) ? h : first;
    },
    () => first,
  );

  // 탭을 바꾸면 맨 위로(토스 하단탭처럼 탭마다 처음부터 본다)
  useEffect(() => {
    if (tab !== first) window.scrollTo(0, 0);
  }, [tab, first]);

  const go = (id: string) => {
    if (id === tab) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const url = id === first ? window.location.pathname + window.location.search : `#${id}`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    if (id === first) window.scrollTo(0, 0);
  };

  return (
    <>
      {tabs.map((t) => (
        <div key={t.id} id={`tab-${t.id}`} className="stack tab-panel" role="tabpanel" aria-label={t.name} hidden={t.id !== tab}>
          {t.panel}
        </div>
      ))}
      <nav className="tabbar" role="tablist" aria-label={label}>
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} onClick={() => go(t.id)}>
            <svg viewBox="0 0 24 24" aria-hidden>
              {ICONS[t.icon]}
            </svg>
            <span>{t.name}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
