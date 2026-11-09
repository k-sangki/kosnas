"use client";

import { useCallback, useRef } from "react";
import { capText, encodeFilters, filterLabels, sortName, type Filters, type ScreenStock } from "@/lib/screens";
import { CaptureSheet } from "./CaptureSheet";
import { LogoSvg } from "./Logo";

const TOP = 10;

const pct = (v: number | null | undefined) => (v == null ? "-" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
const tone = (v: number | null | undefined) => (v == null || v === 0 ? "" : v > 0 ? "up" : "down");

/** 정렬 기준에 맞춰 마지막 칸에 보일 값 */
function keyCol(sort: Filters["sort"]): { head: string; val: (s: ScreenStock) => string; cls?: (s: ScreenStock) => string } {
  switch (sort) {
    case "r20":
      return { head: "20일", val: (s) => pct(s.r["20"]), cls: (s) => tone(s.r["20"]) };
    case "high":
      return { head: "고점 대비", val: (s) => (s.fromHigh === 0 ? "신고가" : pct(s.fromHigh)) };
    case "cap":
      return { head: "시총", val: (s) => capText(s.capEok) };
    default:
      return { head: "RS", val: (s) => (s.rs == null ? "-" : String(s.rs)) };
  }
}

/** "2026-11-07" → "11월 7일" */
function dayText(asof: string) {
  const [, m, d] = asof.split("-").map(Number);
  return m && d ? `${m}월 ${d}일` : asof;
}

interface Props {
  result: ScreenStock[];
  filters: Filters;
  sectorName?: string;
  asof: string;
  onClose: () => void;
}

/**
 * 종목 검색 결과를 이미지 한 장으로: 적용한 조건 + 위에서 10종목.
 * 화면 밖에 카드를 그려 캡처하고(CaptureSheet), 공유 링크에는 같은 조건을 실어 받은 사람도 같은 결과를 본다.
 */
export function ScreenShare({ result, filters, sectorName, asof, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useCallback(() => ref.current, []);
  const labels = filterLabels(filters, sectorName);
  const top = result.slice(0, TOP);
  const k = keyCol(filters.sort);
  const q = encodeFilters(filters);
  const url = `https://kosnas.com/kr/screener${q ? `?${q}` : ""}`;

  return (
    <>
      {/* 화면 밖에 둔다. 위치 지정은 바깥 div에만 — 캡처는 안쪽 카드를 복제한다 */}
      <div className="ss-off" aria-hidden>
        <div className="ss-wrap" ref={ref}>
          <section className="card ss-card">
            <div className="tr-head">
              <LogoSvg />
              <span>{dayText(asof)} 종가 기준</span>
            </div>
            <h2 className="ss-title">
              종목 조건검색 <span className="ss-n">{result.length.toLocaleString()}종목</span>
            </h2>
            <div className="ss-filters">
              <p className="tr-sub">적용한 조건 {labels.length ? `${labels.length}개` : "없음"}</p>
              {labels.length > 0 && (
                <p className="ss-chips">
                  {labels.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </p>
              )}
            </div>
            <p className="tr-sub">
              {sortName(filters.sort)} 순 상위 {Math.min(TOP, result.length)}종목
            </p>
            <table className="ss-table">
              <thead>
                <tr>
                  <th />
                  <th className="l">종목</th>
                  <th>종가</th>
                  <th>등락률</th>
                  <th>{k.head}</th>
                </tr>
              </thead>
              <tbody>
                {top.map((s, i) => (
                  <tr key={s.code}>
                    <td className="ss-rank">{i + 1}</td>
                    <td className="l">
                      <b>{s.name}</b>
                      <small>{[s.market === "KOSPI" ? "코스피" : s.market === "KOSDAQ" ? "코스닥" : s.market, s.ind].filter(Boolean).join(" · ")}</small>
                    </td>
                    <td>{s.close.toLocaleString("ko-KR")}</td>
                    <td className={tone(s.chg)}>{pct(s.chg)}</td>
                    <td className={k.cls?.(s)}>{k.val(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="tr-foot">
              <span>같은 조건으로 직접 걸러 보기</span>
              <b>kosnas.com/kr/screener</b>
            </p>
          </section>
        </div>
      </div>
      <CaptureSheet
        target={target}
        fileName={`kosnas-screener-${asof.replace(/-/g, "")}.png`}
        shareTitle={`종목 조건검색 ${result.length}종목 (${labels.slice(0, 3).join(" · ") || "조건 없음"}) · ${dayText(asof)}`}
        shareUrl={url}
        onClose={onClose}
      />
    </>
  );
}
