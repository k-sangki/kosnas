"use client";

import Link from "next/link";
import { bandPick, diffText, recentResults, relWhen, VERDICT, waitText, type Release } from "@/lib/econ";
import { useEcon } from "./useEcon";

/**
 * 첫 화면 한 줄 띠 → /econ. 캡처에는 들어가지 않는다.
 * 결과가 나오면 하루 동안 '결과 나왔어요'로 두고, 하루 안에 결과가 여러 개면 오른쪽에서 왼쪽으로 흘려 모두 보인다.
 * 결과가 없으면 가장 가까운 발표의 예상치(2026-11-11 SK).
 */
export function EconBand() {
  const { now, list } = useEcon();
  if (!now) return null;
  const done = recentResults(list, now);
  if (done.length > 1) {
    // 같은 줄을 두 번 이어 붙여 끊김 없이 흐르게 한다(움직임 줄이기 설정이면 멈추고 옆으로 밀어 본다)
    const items = [...done, ...done];
    return (
      <div className="econ-band econ-ticker no-capture" aria-label="최근 발표 결과">
        <b className="econ-band-tag econ-ticker-tag">결과 나왔어요</b>
        <div className="econ-ticker-view">
          <div className="econ-ticker-track" style={{ animationDuration: `${done.length * 9}s` }}>
            {items.map((r, i) => (
              <Link key={`${r.id}-${i}`} href={`/econ#${r.id}`} className="econ-ticker-item" aria-hidden={i >= done.length || undefined} tabIndex={i >= done.length ? -1 : undefined}>
                <span aria-hidden>{r.emoji}</span> <span className="econ-band-name">{r.name}</span> <ResultNum r={r} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const pick = bandPick(list, now);
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
              <ResultNum r={r} />
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

/** '근원 CPI 전월 대비 0.3% · 예상 0.2% 예상 상회 +0.1%p' */
function ResultNum({ r }: { r: Release }) {
  const m = r.metrics[0];
  if (!m) return null;
  const gap = diffText(m);
  return (
    <span className="econ-band-num">
      {m.label} <b>{m.a}</b>
      {m.f && <span className="muted"> · 예상 {m.f}</span>}
      {m.verdict && (
        <b className={`ev-v ${m.verdict}`}>
          {" "}
          {VERDICT[m.verdict]}
          {gap && m.verdict !== "match" ? ` ${gap}` : ""}
        </b>
      )}
    </span>
  );
}
