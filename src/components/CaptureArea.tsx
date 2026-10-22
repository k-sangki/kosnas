"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { hhmm } from "@/lib/night";
import { CaptureSheet } from "./CaptureSheet";
import { InstallButton } from "./InstallButton";
import { LogoSvg } from "./Logo";

interface Props {
  children: ReactNode;
  /** 이미지 머리 오른쪽 글. 없으면 캡처한 시각 */
  stamp?: string;
  /** 이미지 맨 위 제목 */
  heading: string;
  name: string;
  title: string;
  url: string;
  foot: string;
}

/** 감싼 카드들을 이미지로 저장·공유하는 떠 있는 버튼(홈 화면 추가 포함). 국장·미장 탭이 쓴다 */
export function CaptureArea({ children, stamp, heading, name, title, url, foot }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useCallback(() => ref.current, []);
  const [at, setAt] = useState<number | null>(null);
  const now = at ?? 0;
  const k = new Date(now + 9 * 3600_000);
  const day = `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
  return (
    <>
      <div className="dash-cap" ref={ref}>
        <div className="cap-only cap-head">
          <LogoSvg />
          <span>{stamp ?? (at ? `${day} ${hhmm(now)} 기준` : "")}</span>
        </div>
        <h2 className="cap-only cap-title">{heading}</h2>
        {children}
        <div className="cap-only cap-foot">
          <span>{foot}</span>
          <b>kosnas.com</b>
        </div>
      </div>
      {at == null && (
        <div className="fab-bar">
          <InstallButton />
          <button type="button" className="fab" onClick={() => setAt(Date.now())}>
            <i className="logo-dot" aria-hidden /> 캡처해서 공유
          </button>
        </div>
      )}
      {at != null && (
        <CaptureSheet
          target={target}
          fileName={`kosnas-${name}-${k.toISOString().slice(0, 16).replace(/[-:T]/g, "")}.png`}
          shareTitle={`${title} ${stamp ?? `${day} ${hhmm(now)}`}`}
          shareUrl={url}
          onClose={() => setAt(null)}
        />
      )}
    </>
  );
}
