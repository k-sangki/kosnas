"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MASTERS,
  decodePcts,
  findMaster,
  findResult,
  type ResultId,
} from "@/lib/invest-test";
import { CaptureSheet } from "./CaptureSheet";
import { LogoSvg } from "./Logo";

/**
 * 결과 카드. 휴대폰 한 화면에 들어가게: 가장 닮은 대가를 크게, 나머지 7명은 게이지로.
 * 대가별 비중(%, 8명 합계 100)은 주소의 ?s= 에 실려 와서, 공유받은 사람도 같은 카드를 본다. 없으면 게이지 없이 대가만.
 */
export function TestResult({ id }: { id: ResultId }) {
  const m = findResult(id)!;
  const ant = id === "ant";
  const ref = useRef<HTMLDivElement>(null);
  const target = useCallback(() => ref.current, []);
  const [{ s, a }, setQ] = useState<{ s: string | null; a: number | null }>({
    s: null,
    a: null,
  });
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    // 주소의 ?s=(대가 비중)·?a=(개미력)는 화면이 뜬 뒤에만 읽는다(정적 페이지)
    const q = new URLSearchParams(location.search);
    const n = Number(q.get("a"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 위와 같은 이유
    setQ({
      s: q.get("s"),
      a:
        q.get("a") != null && Number.isFinite(n)
          ? Math.max(0, Math.min(100, Math.round(n)))
          : null,
    });
  }, []);

  const pcts = decodePcts(s);
  // 개미형은 칩에 개미력, 대가형은 그 대가 비중. 게이지는 0%인 대가를 뺀다
  const mine = ant ? a : pcts?.find((p) => p.id === id)?.pct;
  const others = (pcts ?? []).filter((p) => p.id !== id && p.pct > 0);
  const best = ant ? findMaster(pcts?.[0]?.id ?? "") : findMaster(id);
  // 게이지는 가장 닮은 대가를 꽉 찬 칸으로 두고 견준다(숫자는 실제 비중)
  const top = Math.max(ant ? 0 : (mine ?? 0), ...others.map((o) => o.pct));
  const query = [s && `s=${s}`, a != null && `a=${a}`]
    .filter(Boolean)
    .join("&");
  const shareUrl = `https://kosnas.com/test/${id}${query ? `?${query}` : ""}`;

  return (
    <>
      <div className="tr-wrap" ref={ref}>
        <section className="card tr-card">
          <div className="tr-head">
            <LogoSvg />
            <span>나의 투자 성향</span>
          </div>
          <div className="tr-hero">
            <span className="tr-emoji" aria-hidden>
              {m.emoji}
            </span>
            <h1 className="tr-name">
              {m.name}형
              {mine != null && (
                <span className="tr-pct">
                  {ant ? `개미력 ${mine}%` : `${mine}%`}
                </span>
              )}
            </h1>
            <p className="tr-nick">&ldquo;{m.nick}&rdquo;</p>
            <p className="tr-line">{m.line}</p>
            <p className="tr-traits">
              {m.traits.map((t) => (
                <span key={t}>{t}</span>
              ))}
              {!ant && a != null && a > 0 && <span>🐜 개미력 {a}%</span>}
            </p>
          </div>
          {others.length > 0 && (
            <div className="tr-gauges">
              <p className="tr-sub">
                {ant ? "그래도 닮은 대가" : "나머지 대가 비중"} · 8명 합계 100%
              </p>
              {others.map((o) => {
                const x = MASTERS.find((y) => y.id === o.id)!;
                return (
                  <div key={o.id} className="tr-g">
                    <span className="tr-g-name">
                      {x.emoji} {x.name}
                    </span>
                    <span className="tr-g-bar" aria-hidden>
                      <i
                        style={{ width: `${top ? (o.pct / top) * 100 : 0}%` }}
                      />
                    </span>
                    <b className="tr-g-pct">{o.pct}%</b>
                  </div>
                );
              })}
            </div>
          )}
          <p className="tr-foot">
            <span>나도 해보기</span>
            <b>kosnas.com/test</b>
          </p>
        </section>
      </div>
      <div className="tr-actions no-capture">
        <button
          type="button"
          className="it-start"
          onClick={() => setCapturing(true)}
        >
          📸 캡처해서 공유
        </button>
        <div className="tr-row">
          <Link href="/test" className="tr-btn">
            {s ? "다시 하기" : "나도 해보기"}
          </Link>
          <Link href="/" className="tr-btn">
            대시보드
          </Link>
        </div>
        {best && (
          <Link href={`/investors/${best.id}`} className="tr-btn tr-link">
            {ant
              ? `그래도 가장 닮은 ${best.name}의 포트폴리오 ›`
              : `${best.name}의 실제 포트폴리오 보기 ›`}
          </Link>
        )}
      </div>
      {capturing && (
        <CaptureSheet
          target={target}
          fileName={`kosnas-test-${id}.png`}
          shareTitle={`나는 ${m.name}형 · ${m.nick}`}
          shareUrl={shareUrl}
          onClose={() => setCapturing(false)}
        />
      )}
    </>
  );
}
