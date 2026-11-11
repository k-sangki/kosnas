"use client";

import Link from "next/link";
import { bandPick, relWhen, VERDICT, waitText } from "@/lib/econ";
import { useEcon } from "./useEcon";

/**
 * 첫 화면 한 줄 띠: 가장 가까운 경제지표 발표 하나의 예상치 → /econ.
 * 결과가 나오면 12시간 동안 '결과 나왔어요'로 두고 그 뒤 다음 발표로 바꾼다(2026-11-11 SK). 캡처에는 들어가지 않는다.
 */
export function EconBand() {
  const { now, list } = useEcon();
  const pick = now ? bandPick(list, now) : null;
  if (!pick) return null;
  const { r, mode } = pick;
  const m = r.metrics[0];
  const waiting = mode === "next" && r.at <= now;
  return (
    <Link href={`/econ#${r.id}`} className={`econ-band no-capture${mode === "result" ? " done" : ""}`}>
      <span className="econ-band-emoji" aria-hidden>
        {r.emoji}
      </span>
      <span className="econ-band-text">
        <span className="econ-band-top">
          {mode === "result" ? <b className="econ-band-tag">결과 나왔어요</b> : <b className="econ-band-when">{waiting ? waitText(r) : relWhen(r, now)}</b>}
          <span className="econ-band-name">{r.name}</span>
        </span>
        {m && (
          <span className="econ-band-num">
            {mode === "result" ? (
              <>
                {m.label} <b>{m.a}</b>
                {m.f && <span className="muted"> · 예상 {m.f}</span>}
                {m.verdict && <b className={`ev-v ${m.verdict}`}> {VERDICT[m.verdict]}</b>}
              </>
            ) : (
              <>
                {m.label} 예상 <b>{m.f || "—"}</b>
                {m.p && <span className="muted"> · {m.pLabel ?? "직전"} {m.p}</span>}
              </>
            )}
          </span>
        )}
      </span>
      <span className="econ-band-go" aria-hidden>
        ›
      </span>
    </Link>
  );
}
