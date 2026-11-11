"use client";

import { useEffect, useMemo, useState } from "react";
import data from "@/data/econ.json";
import { mergeRows, releases, type EconData, type Row } from "@/lib/econ";

const BASE = data as unknown as EconData;

/** 경제지표 발표 목록. 바탕 자료에 /api/econ(발표 직후 실제 값)을 덮고, 지금 시각을 1분마다 고친다 */
export function useEcon() {
  const [now, setNow] = useState(0);
  const [live, setLive] = useState<Row[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 정적 페이지라 지금 시각은 브라우저에서 정한다
    setNow(Date.now());
    const load = () =>
      fetch("/api/econ")
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { rows?: Row[] } | null) => b?.rows && setLive(b.rows))
        .catch(() => undefined);
    load();
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    const poll = setInterval(() => document.visibilityState === "visible" && load(), 180_000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, []);
  const list = useMemo(() => releases(mergeRows(BASE.rows ?? [], live)), [live]);
  return { now, list, data: BASE };
}
