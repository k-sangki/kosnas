"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MASTERS,
  decodePcts,
  findMaster,
  type TypeId,
} from "@/lib/invest-test";
import { CaptureSheet } from "./CaptureSheet";
import { LogoSvg } from "./Logo";

/**
 * 결과 카드. 휴대폰 한 화면에 들어가게: 가장 닮은 대가를 크게, 나머지 7명은 게이지로.
 * 대가별 비중(%, 8명 합계 100)은 주소의 ?s= 에 실려 와서, 공유받은 사람도 같은 카드를 본다. 없으면 게이지 없이 대가만.
 */
export function TestResult({ id }: { id: TypeId }) {
  const m = findMaster(id)!;
  const ref = useRef<HTMLDivElement>(null);
  const target = useCallback(() => ref.current, []);
  const [s, setS] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소의 ?s= 는 화면이 뜬 뒤에만 읽는다(정적 페이지)
    setS(new URLSearchParams(location.search).get("s"));
  }, []);

  const pcts = decodePcts(s);
  const mine = pcts?.find((p) => p.id === id)?.pct;
  const others = (pcts ?? []).filter((p) => p.id !== id);
  // 게이지는 가장 닮은 대가를 꽉 찬 칸으로 두고 견준다(숫자는 실제 비중)
  const top = Math.max(mine ?? 0, ...others.map((o) => o.pct));
  const shareUrl = `https://kosnas.com/test/${id}${s ? `?s=${s}` : ""}`;

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
                <span className="tr-pct">{mine}%</span>
              )}
            </h1>
            <p className="tr-nick">&ldquo;{m.nick}&rdquo;</p>
            <p className="tr-line">{m.line}</p>
            <p className="tr-traits">
              {m.traits.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </p>
          </div>
          {others.length > 0 && (
            <div className="tr-gauges">
              <p className="tr-sub">나머지 대가 비중 · 8명 합계 100%</p>
              {others.map((o) => {
                const x = MASTERS.find((y) => y.id === o.id)!;
                return (
                  <div key={o.id} className="tr-g">
                    <span className="tr-g-name">
                      {x.emoji} {x.name}
                    </span>
                    <span className="tr-g-bar" aria-hidden>
                      <i style={{ width: `${top ? (o.pct / top) * 100 : 0}%` }} />
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
        <Link href={`/investors/${id}`} className="tr-btn tr-link">
          {m.name}의 실제 포트폴리오 보기 ›
        </Link>
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
