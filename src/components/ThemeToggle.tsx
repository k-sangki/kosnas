"use client";

import { setTheme, useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const t = useTheme();
  const next = t === "dark" ? "light" : "dark";
  return (
    <button type="button" className="theme-toggle" onClick={() => setTheme(next)} aria-label={next === "dark" ? "다크 모드로" : "라이트 모드로"}>
      {t === "dark" ? (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
        </svg>
      )}
    </button>
  );
}
