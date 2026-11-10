"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

/** 미장 화면 하단탭. 주소는 /us 그대로 두고 탭은 #sector·#investors로 고른다(기존 색인 주소 유지) */
export const US_TABS = [
  { id: "live", name: "실시간" },
  { id: "sector", name: "섹터" },
  { id: "investors", name: "유명 투자자" },
] as const;
type TabId = (typeof US_TABS)[number]["id"];

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const current = (): TabId => {
  const h = window.location.hash.slice(1);
  return US_TABS.some((t) => t.id === h) ? (h as TabId) : "live";
};

function Icon({ id }: { id: TabId }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "live")
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M3 17l5-6 4 4 4-6 5 5" {...p} />
        <path d="M3 21h18" {...p} />
      </svg>
    );
  if (id === "sector")
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="3" width="8" height="10" rx="2" {...p} />
        <rect x="13" y="3" width="8" height="6" rx="2" {...p} />
        <rect x="3" y="15" width="8" height="6" rx="2" {...p} />
        <rect x="13" y="11" width="8" height="10" rx="2" {...p} />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" {...p} />
      <path d="M15 3.5A9 9 0 0 1 20.5 9H15z" {...p} />
    </svg>
  );
}

export function UsTabs(panels: Record<TabId, ReactNode>) {
  const tab = useSyncExternalStore<TabId>(subscribe, current, () => "live");

  // 탭을 바꾸면 맨 위로(토스 하단탭처럼 탭마다 처음부터 본다)
  useEffect(() => {
    if (tab !== "live") window.scrollTo(0, 0);
  }, [tab]);

  const go = (id: TabId) => {
    if (id === tab) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const url = id === "live" ? window.location.pathname + window.location.search : `#${id}`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    if (id === "live") window.scrollTo(0, 0);
  };

  return (
    <>
      {US_TABS.map((t) => (
        <div key={t.id} id={`us-${t.id}`} className="stack us-panel" role="tabpanel" aria-label={t.name} hidden={t.id !== tab}>
          {panels[t.id]}
        </div>
      ))}
      <nav className="tabbar" role="tablist" aria-label="미장 화면">
        {US_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} onClick={() => go(t.id)}>
            <Icon id={t.id} />
            <span>{t.name}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
