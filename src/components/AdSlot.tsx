"use client";

import { useEffect, useRef } from "react";
import type { AdPlace } from "@/lib/ad-slots";

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || "ca-pub-2807429912252096";
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

/**
 * 카카오 애드핏 광고 단위(DAN-…, 공개 값). 320x100 한 크기만 쓴다. 비어 있으면 그 자리에 애드핏을 내지 않는다.
 * 애드센스(ADS_ENABLED)가 켜져 있으면 애드센스가 먼저다(애드핏은 애드센스 승인 전 대안, 2026-11-09 SK).
 */
export const ADFIT_UNITS: Record<AdPlace, string> = {
  board: "",
  sector: "",
};
const ADFIT_SCRIPT = "https://t1.daumcdn.net/kas/static/ba.min.js";

/** 애드핏 한 칸. 화면 이동(SPA)마다 스크립트를 새로 붙여야 광고를 다시 그린다. */
function AdFit({ unit }: { unit: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = "";
    const ins = document.createElement("ins");
    ins.className = "kakao_ad_area";
    ins.style.display = "none";
    ins.setAttribute("data-ad-unit", unit);
    ins.setAttribute("data-ad-width", "320");
    ins.setAttribute("data-ad-height", "100");
    const script = document.createElement("script");
    script.async = true;
    script.src = ADFIT_SCRIPT;
    el.append(ins, script);
    return () => {
      el.innerHTML = "";
    };
  }, [unit]);
  return <div ref={box} className="ad-slot adfit" />;
}

export function AdSlot({ slot: place, format = "auto" }: { slot: AdPlace; format?: string }) {
  const ref = useRef<HTMLModElement>(null);
  const slot = ADSENSE_SLOTS[place];

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
    const unit = ADFIT_UNITS[place];
    if (unit) return <AdFit unit={unit} />;
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

const ADSENSE_SLOTS: Record<AdPlace, string | undefined> = {
  board: process.env.NEXT_PUBLIC_AD_SLOT_BOARD?.trim(),
  sector: process.env.NEXT_PUBLIC_AD_SLOT_SECTOR?.trim(),
};
