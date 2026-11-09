"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { kstToday, md, mdw, weeks, type Market } from "@/lib/schedule";
import { CaptureSheet } from "./CaptureSheet";
import { LogoSvg } from "./Logo";

/** 하루에 처음 보일 일정 수(배당 막차가 몰리는 날은 나머지를 접는다) */
const SHOW = 5;

/** 주요일정: 국장/미장 탭 · 이번 주/다음 주 목록 · 캡처 공유 */
export function ScheduleBoard() {
  const [market, setMarket] = useState<Market>("kr");
  const [today, setToday] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [capturing, setCapturing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const target = useCallback(() => ref.current, []);

  useEffect(() => {
    // 정적 페이지라 '오늘'은 브라우저에서 정한다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(kstToday());
    if (new URLSearchParams(location.search).get("m") === "us") setMarket("us");
  }, []);

  const pick = (m: Market) => {
    setMarket(m);
    setOpen(new Set());
    history.replaceState(null, "", m === "kr" ? "/schedule" : "/schedule?m=us");
  };

  if (!today) return <section className="card muted">불러오는 중…</section>;
  const list = weeks(market, today);
  const name = market === "kr" ? "국장" : "미장";

  return (
    <>
      <div className="seg sch-seg no-capture" role="group" aria-label="시장">
        {(["kr", "us"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={market === m}
            onClick={() => pick(m)}
          >
            {m === "kr" ? "🇰🇷 국장" : "🇺🇸 미장"}
          </button>
        ))}
      </div>
      <div className="sch-cap stack" ref={ref}>
        <div className="cap-only cap-head">
          <LogoSvg />
          <span>{name} 주요일정</span>
        </div>
        {list.map((w) => (
          <section key={w.label} className="card sch-week">
            <h2 className="card-title">
              {w.label}{" "}
              <span className="muted">{`${md(w.from)}~${md(w.to)}`}</span>
              <span className="sch-n">{w.count}건</span>
            </h2>
            {w.days.length === 0 && <p className="muted">큰 일정이 없어요.</p>}
            {w.days.map((d) => {
              const key = `${market}${d.date}`;
              const all = open.has(key);
              const shown = all ? d.items : d.items.slice(0, SHOW);
              return (
                <div
                  key={d.date}
                  className={`sch-day${d.date < today ? " past" : ""}${d.date === today ? " today" : ""}`}
                >
                  <div className="sch-date">
                    {mdw(d.date)}
                    {d.date === today && <b>오늘</b>}
                  </div>
                  <ul>
                    {shown.map((it, i) => {
                      const body = (
                        <>
                          <span className="sch-emoji" aria-hidden>
                            {it.emoji}
                          </span>
                          <span className="sch-text">
                            <b>{it.title}</b>
                            {it.detail && <span>{it.detail}</span>}
                          </span>
                        </>
                      );
                      return (
                        <li key={i}>
                          {it.href ? (
                            <a
                              href={it.href}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {body}
                            </a>
                          ) : (
                            <div>{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {d.items.length > SHOW && !all && (
                    <button
                      type="button"
                      className="sch-more no-capture"
                      onClick={() => setOpen(new Set(open).add(key))}
                    >
                      외 {d.items.length - SHOW}건 더 보기
                    </button>
                  )}
                  {d.items.length > SHOW && !all && (
                    <p className="cap-only sch-cap-more">
                      외 {d.items.length - SHOW}건 · kosnas.com/schedule
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        ))}
        <div className="cap-only cap-foot">
          <span>공시·공식 발표 일정 기준 · 투자 권유 아님</span>
          <b>kosnas.com</b>
        </div>
      </div>
      <button
        type="button"
        className="it-start sch-share no-capture"
        onClick={() => setCapturing(true)}
      >
        📸 캡처해서 공유
      </button>
      {capturing && (
        <CaptureSheet
          target={target}
          fileName={`kosnas-schedule-${market}-${today}.png`}
          shareTitle={`${name} 주요일정 · ${list[0].label} ${md(list[0].from)}~${md(list[0].to)}`}
          shareUrl={
            market === "kr"
              ? "https://kosnas.com/schedule"
              : "https://kosnas.com/schedule?m=us"
          }
          onClose={() => setCapturing(false)}
        />
      )}
    </>
  );
}
