"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";

/**
 * 트레이딩뷰 무료 위젯. 가격은 우리가 싣지 않고 트레이딩뷰가 직접 보여준다.
 * 약관상 아래 트레이딩뷰 링크(출처 표시)를 지우거나 가리면 안 되고, 위젯 위에 광고를 겹치지 않는다.
 */
export function TvWidget({
  kind,
  config,
  height,
}: {
  /** embed-widget-<kind>.js (mini-symbol-overview, market-quotes, symbol-info …) */
  kind: string;
  config: Record<string, unknown>;
  height: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  // 화면 모드에 맞춰 위젯 색을 고른다(모드를 바꾸면 위젯을 다시 그린다)
  const json = JSON.stringify({ ...config, colorTheme: theme });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = "";
    const s = document.createElement("script");
    s.src = `https://s3.tradingview.com/external-embedding/embed-widget-${kind}.js`;
    s.async = true;
    s.type = "text/javascript";
    s.innerHTML = json;
    el.appendChild(s);
    return () => {
      el.innerHTML = "";
    };
  }, [kind, json]);

  return (
    <div className="tv tradingview-widget-container">
      <div ref={box} className="tradingview-widget-container__widget" style={{ minHeight: height }} />
      <div className="tradingview-widget-copyright">
        <a href="https://kr.tradingview.com/" rel="noopener nofollow" target="_blank">
          트레이딩뷰 제공
        </a>
      </div>
    </div>
  );
}

/** 종목 하나의 작은 차트 (최근 3개월) */
export function TvMini({ symbol }: { symbol: string }) {
  return (
    <TvWidget
      kind="mini-symbol-overview"
      height={220}
      config={{
        symbol,
        width: "100%",
        height: 220,
        locale: "kr",
        dateRange: "3M",
        colorTheme: "light",
        isTransparent: true,
        autosize: false,
        largeChartUrl: "",
      }}
    />
  );
}
