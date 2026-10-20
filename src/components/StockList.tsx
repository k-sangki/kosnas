"use client";

import { useState } from "react";
import type { Stock } from "@/lib/sectors";
import { TvMini } from "./TvWidget";

/**
 * 섹터 종목 목록. 우리 화면에는 이름과 상대강도 순위만 싣고, 가격·차트는 누른 종목만 트레이딩뷰 위젯으로 연다
 * (위젯을 한꺼번에 띄우면 모바일에서 느려진다).
 */
export function StockList({ stocks }: { stocks: Stock[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="stocks">
      {stocks.map((s) => (
        <li key={s.code}>
          <button className="stock-row" aria-expanded={open === s.code} onClick={() => setOpen(open === s.code ? null : s.code)}>
            <span className="stock-name">{s.name}</span>
            <span className="muted">{s.code.replace(/^[A-Z]+:/, "")}</span>
            <span className={`rs${s.rs >= 80 ? " hi" : ""}`}>RS {s.rs}</span>
            <i className="tri" aria-hidden />
          </button>
          {open === s.code && <TvMini symbol={s.tv} />}
        </li>
      ))}
    </ul>
  );
}
