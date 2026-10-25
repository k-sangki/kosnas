"use client";

import { useEffect, useRef, useState } from "react";

// 화면 맨 위에서 아래로 당겼다 놓으면 새로고침한다.
// 홈 화면에 추가한 앱(standalone)·인앱 브라우저처럼 브라우저 기본 기능이 없는 곳에서도 같게 동작하도록
// 기본 당겨서 새로고침은 CSS(overscroll-behavior-y)로 끄고 이 컴포넌트가 대신한다.
const THRESHOLD = 70; // 이만큼(px, 감쇠 뒤) 당기면 놓을 때 새로고침
const MAX = 110;

// 손가락이 닿은 곳이 세로로 스크롤되는 상자(채팅 목록 등) 안이면 그 상자의 스크롤에 맡긴다
function inScrollable(el: Element | null): boolean {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (n.matches('[role="dialog"], input, textarea, select, [contenteditable="true"]')) return true;
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return true;
  }
  return false;
}

export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [loading, setLoading] = useState(false);
  const pullRef = useRef(0);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false; // 맨 위에서 시작한 한 손가락 터치
    let pulling = false; // 아래로 당기는 중으로 판정됨

    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const atTop = () => (window.scrollY || document.documentElement.scrollTop) <= 0;

    const onStart = (e: TouchEvent) => {
      tracking = false;
      pulling = false;
      if (e.touches.length !== 1 || !atTop()) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (inScrollable(e.target as Element)) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      // 다른 기능(대시보드 카드 옮기기 등)이 이미 이 움직임을 쓰고 있으면 물러난다
      if (!pulling && e.defaultPrevented) {
        tracking = false;
        return;
      }
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!pulling) {
        // 가로 쓸기(표·차트 넘기기)거나 위로 올리면 손대지 않는다
        if (Math.abs(dx) > Math.abs(dy) || dy <= 0) {
          if (Math.abs(dx) > 8 || dy < -8) tracking = false;
          return;
        }
        if (dy < 8 || !atTop()) return;
        pulling = true;
      }
      if (e.cancelable) e.preventDefault();
      set(Math.min(MAX, Math.max(0, (dy - 8) * 0.5)));
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!pulling) return;
      pulling = false;
      if (pullRef.current >= THRESHOLD) {
        setLoading(true);
        set(THRESHOLD);
        window.location.reload();
      } else {
        set(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (pull <= 0 && !loading) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div
      className={`ptr${ready ? " ptr-ready" : ""}${loading ? " ptr-loading" : ""}`}
      style={{ transform: `translate(-50%, ${pull - 44}px)`, opacity: Math.min(1, pull / 40) }}
      role="status"
      aria-label={loading ? "새로고침 중" : ready ? "놓으면 새로고침" : "당겨서 새로고침"}
    >
      <svg viewBox="0 0 24 24" aria-hidden style={loading ? undefined : { transform: `rotate(${(pull / THRESHOLD) * 270}deg)` }}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v4.5h-4.5" />
      </svg>
    </div>
  );
}
