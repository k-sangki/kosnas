"use client";

import { useSyncExternalStore } from "react";
import { THEME_COLOR, THEME_KEY, type Theme } from "./theme-script";

export type { Theme };

const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function subscribe(f: () => void) {
  const mo = new MutationObserver(f);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => "light");
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {}
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLOR[t]));
}
