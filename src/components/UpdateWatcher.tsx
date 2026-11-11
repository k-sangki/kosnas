"use client";

import { useEffect, useRef, useState } from "react";
import { CHECK_EVERY_MS, dueForCheck, isNewVersion, MIN_GAP_MS, reloadAllowed } from "@/lib/app-update";

// 홈 화면에 추가한 앱은 닫지 않으면 옛 화면이 계속 떠 있어 새 배포(코드·자료)가 보이지 않는다.
// 이 컴포넌트가 서버 버전(/api/version)과 지금 화면 버전(<meta name="kn-version">, Worker가 적음)을 비교해
// 새 버전이 있으면 보던 화면을 해치지 않는 때에 다시 불러온다.
//  - 앱으로 돌아올 때(다른 앱·잠금화면에서 복귀): 바로 확인하고, 입력 중이 아니면 그 자리에서 새로 불러온다
//  - 화면을 보고 있는 동안: 10분마다 확인하고, 새 버전이면 다음에 다른 페이지로 갈 때 새로 불러온다
//    (아래에 '새 버전 적용' 단추도 띄운다 — 누르면 바로)
//  - 입력 중(글자를 친 입력칸·열린 창)이면 자동으로 불러오지 않고 단추만 띄운다
const SCROLL_KEY = "kn-update-scroll";
const LAST_KEY = "kn-update-last";

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** 지금 다시 불러와도 잃는 것이 없는가: 열린 창·입력 중인 칸이 없을 때 */
function safeToReload() {
  if (document.querySelector('[aria-modal="true"], dialog[open]')) return false;
  const active = document.activeElement;
  if (active && active.matches('input, textarea, select, [contenteditable="true"]')) return false;
  for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input")) {
    if (el instanceof HTMLInputElement && !/^(text|search|email|url|tel|number|)$/.test(el.type)) continue;
    if (el.value.trim()) return false;
  }
  return true;
}

function reloadKeepingScroll(target: string) {
  const s = storage();
  s?.setItem(SCROLL_KEY, JSON.stringify({ p: location.pathname + location.search, y: window.scrollY }));
  s?.setItem(LAST_KEY, JSON.stringify({ v: target, at: Date.now() }));
  window.location.reload();
}

export function UpdateWatcher() {
  const [ready, setReady] = useState(false);
  const latest = useRef<string | null>(null);

  useEffect(() => {
    const current = document.querySelector<HTMLMetaElement>('meta[name="kn-version"]')?.content ?? null;
    const s = storage();

    // 새 버전으로 다시 불러온 직후면 보던 위치로 돌려 놓는다(내용이 늦게 차는 화면도 있어 몇 번 시도)
    const saved = s?.getItem(SCROLL_KEY);
    if (saved) {
      s?.removeItem(SCROLL_KEY);
      try {
        const { p, y } = JSON.parse(saved) as { p: string; y: number };
        if (p === location.pathname + location.search && y > 0) {
          let moved = false;
          const stop = () => (moved = true);
          window.addEventListener("touchstart", stop, { once: true, passive: true });
          window.addEventListener("wheel", stop, { once: true, passive: true });
          for (const ms of [0, 300, 1000]) setTimeout(() => !moved && window.scrollTo(0, y), ms);
        }
      } catch {}
    }

    if (!current || current === "dev") return;

    let lastCheck = 0;
    let busy = false;
    const lastReload = () => {
      try {
        return JSON.parse(s?.getItem(LAST_KEY) ?? "null") as { v: string; at: number } | null;
      } catch {
        return null;
      }
    };

    const check = async () => {
      if (busy || !dueForCheck(lastCheck, Date.now(), MIN_GAP_MS)) return latest.current;
      busy = true;
      lastCheck = Date.now();
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (r.ok) {
          const { v } = (await r.json()) as { v?: string };
          if (isNewVersion(current, v)) latest.current = v ?? null;
        }
      } catch {
        // 연결이 없으면 다음에 다시
      } finally {
        busy = false;
      }
      if (latest.current) setReady(true);
      return latest.current;
    };

    /** 새 버전이 있고 잃을 것이 없으면 바로 적용한다 */
    const applyIfSafe = () => {
      const v = latest.current;
      if (!v || !safeToReload() || !reloadAllowed(v, lastReload(), Date.now())) return false;
      reloadKeepingScroll(v);
      return true;
    };

    // 앱으로 돌아올 때: 화면이 다시 보이면 확인하고 바로 적용
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      if (await check()) applyIfSafe();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void onVisible();
    };

    // 보고 있는 동안 새 버전이 생기면 다음 페이지 이동을 전체 불러오기로 바꾼다
    const onClick = (e: MouseEvent) => {
      const v = latest.current;
      if (!v || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // 같은 페이지 안 이동(#)
      if (!reloadAllowed(v, lastReload(), Date.now())) return;
      e.preventDefault();
      s?.setItem(LAST_KEY, JSON.stringify({ v, at: Date.now() }));
      window.location.assign(url.toString());
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, CHECK_EVERY_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("click", onClick, true);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!ready) return null;
  return (
    <button
      type="button"
      className="toast update-toast"
      onClick={() => latest.current && reloadKeepingScroll(latest.current)}
      aria-label="새 버전 적용"
    >
      새 버전이 나왔어요 · <b>눌러서 적용</b>
    </button>
  );
}
