"use client";

import { useEffect, useMemo, useState } from "react";
import data from "@/data/econ.json";
import { earnReleases, mergeEarnings, mergeRows, releases, type Earning, type EconData, type Row } from "@/lib/econ";

const BASE = data as unknown as EconData;

/**
 * 경제지표·주목 기업 실적 발표 목록. 바탕 자료에 /api/econ(발표 직후 실제 값)을 덮고, 지금 시각을 1분마다 고친다.
 * 주목 기업 실적은 CPI처럼 한 건씩 발표 목록·띠에 들어간다.
 */
export function useEcon() {
  const [now, setNow] = useState(0);
  const [live, setLive] = useState<{ rows?: Row[]; earnings?: Earning[] } | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 정적 페이지라 지금 시각은 브라우저에서 정한다
    setNow(Date.now());
    const load = () =>
      fetch("/api/econ")
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { rows?: Row[]; earnings?: Earning[]; live?: boolean } | null) => b?.live && setLive(b))
        .catch(() => undefined);
    load();
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    const poll = setInterval(() => document.visibilityState === "visible" && load(), 180_000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, []);
  const earnings = useMemo(() => mergeEarnings(BASE.earnings, live?.earnings), [live]);
  const list = useMemo(
    () => [...releases(mergeRows(BASE.rows ?? [], live?.rows)), ...earnReleases(earnings)].sort((a, b) => a.at - b.at),
    [live, earnings],
  );
  return { now, list, earnings, data: BASE };
}
