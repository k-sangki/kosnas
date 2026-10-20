"use client";

import { useEffect, useRef } from "react";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
/**
 * 광고 자리 표시 여부. 실제 시세 수집이 붙고 애드센스 승인을 받기 전까지는 끈다(4단계에서 켠다).
 * 자동 광고(전면 광고 포함)는 쓰지 않고 이 수동 슬롯만 쓴다. 트레이딩뷰 위젯과 겹치는 자리에는 두지 않는다.
 */
export const ADS_ENABLED = false;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ slot, format = "auto" }: { slot?: string; format?: string }) {
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!ADS_ENABLED || !CLIENT || !slot || !ref.current || ref.current.dataset.loaded) return;
    ref.current.dataset.loaded = "1";
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 차단기 등으로 실패해도 화면에는 영향 없음
    }
  }, [slot]);

  if (!ADS_ENABLED || !CLIENT || !slot) {
    if (process.env.NODE_ENV === "development") return <div className="ad-slot dev">광고 영역</div>;
    return null;
  }
  return (
    <ins
      ref={ref}
      className="adsbygoogle ad-slot"
      data-ad-client={CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}

export const AD_SLOTS = {
  board: process.env.NEXT_PUBLIC_AD_SLOT_BOARD?.trim(),
  sector: process.env.NEXT_PUBLIC_AD_SLOT_SECTOR?.trim(),
};
