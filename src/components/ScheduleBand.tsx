"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { kstToday, mdw, nextUp } from "@/lib/schedule";

/**
 * 대시보드 한 줄 띠: 이번 주 남은 일정 중 가장 가까운 것 + 건수 → /schedule. 캡처에는 들어가지 않는다.
 * 주말(토·일)에는 다음 주 일정을 센다(2026-11-10 SK)
 */
export function ScheduleBand({ weekend = false }: { weekend?: boolean }) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(kstToday());
  }, []);
  // 토·일이면 다음 주까지(월요일 새벽은 이미 '이번 주'다)
  const sat = today ? [0, 6].includes(new Date(`${today}T00:00:00Z`).getUTCDay()) : false;
  const next = weekend && sat;
  const up = today ? nextUp(today, next) : null;
  return (
    <Link href="/schedule" className="card sch-band no-capture">
      <span className="sch-band-emoji" aria-hidden>
        📅
      </span>
      <span className="sch-band-text">
        <b>{next ? "다음 주" : "이번 주"} 챙길 일정{up && up.count > 0 ? ` ${up.count}건` : ""}</b>
        <span className="muted">
          {up?.first
            ? `${mdw(up.first.date)} ${up.first.title}${up.count > 1 ? ` 외 ${up.count - 1}건` : ""}`
            : "배당 막차 · 공모주 청약 · FOMC 일정 보기"}
        </span>
      </span>
      <span className="sch-band-go" aria-hidden>
        ›
      </span>
    </Link>
  );
}
