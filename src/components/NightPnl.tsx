"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { hhmm, type NightData } from "@/lib/night";
import { PNL_STOCKS, cleanShares, pnlRows, pnlTotal, shortWon, type Holdings } from "@/lib/night-pnl";
import { CaptureSheet } from "./CaptureSheet";
import { LogoSvg } from "./Logo";

/**
 * 밤사이 내 손익 계산기. 삼성전자·SK하이닉스 보유 주수를 넣으면 무기한선물 원화 환산 가격으로
 * KRX 종가 대비 손익을 추정한다. 주수는 이 브라우저에만 저장하고 서버로 보내지 않는다.
 */
const KEY = "kosnas:pnl:v1";
/** 띠를 펼쳐 둔 채인지(2026-11-10 SK: 한 줄로 접어 둘 수 있게, 처음엔 접힘) */
const OPEN_KEY = "kosnas:pnl:open";
const listeners = new Set<() => void>();
let memory: string | null = null;
function read() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}
function save(h: Holdings | null) {
  memory = h ? JSON.stringify(h) : null;
  try {
    if (memory) localStorage.setItem(KEY, memory);
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((f) => f());
}
function subscribe(f: () => void) {
  listeners.add(f);
  window.addEventListener("storage", f);
  return () => {
    listeners.delete(f);
    window.removeEventListener("storage", f);
  };
}
function parse(raw: string | null): Holdings {
  try {
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const h: Holdings = {};
    for (const s of PNL_STOCKS) {
      const n = cleanShares(v[s.coin]);
      if (n) h[s.coin] = n;
    }
    return h;
  } catch {
    return {};
  }
}

const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");
const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

export function NightPnl({ d }: { d: NightData | null }) {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const h = parse(raw);
  const has = Object.keys(h).length > 0;
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const box = useRef<HTMLElement>(null);
  const [unfold, setUnfold] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장값은 화면이 뜬 뒤에만 읽을 수 있다
      if (localStorage.getItem(OPEN_KEY) === "1") setUnfold(true);
    } catch {}
  }, []);
  const toggle = (v: boolean) => {
    setUnfold(v);
    try {
      if (v) localStorage.setItem(OPEN_KEY, "1");
      else localStorage.removeItem(OPEN_KEY);
    } catch {}
  };

  if (!has && !open)
    return (
      <button type="button" className="card test-band pnl-band no-capture" onClick={() => setOpen(true)}>
        <span className="test-band-emoji" aria-hidden>
          💤💰
        </span>
        <span className="test-band-text">
          <b>자는 동안 내 삼성전자·하이닉스는?</b>
          <span className="muted">주수만 넣으면 밤사이 손익 추정</span>
        </span>
        <span className="test-band-go" aria-hidden>
          ›
        </span>
      </button>
    );

  if (open) return <PnlForm h={h} onDone={() => setOpen(false)} />;

  const rows = pnlRows(d?.inputs, h);
  const t = pnlTotal(rows);
  const live = d?.window.live !== false;
  return (
    <>
      <section className="card pnl no-capture" ref={box} aria-label="밤사이 내 손익">
        <details className="fold pnl-fold" open={unfold} onToggle={(e) => toggle(e.currentTarget.open)}>
          <summary className="pnl-head">
            <h2>
              {live ? "자는 동안 내 주식" : "지난밤 내 주식"} <small className="muted">추정</small>
            </h2>
            {d && rows.length > 0 && (
              <span className={`pnl-sum ${tone(t.won)}`}>
                {shortWon(t.won)} <small>{pct(t.pct)}</small>
              </span>
            )}
            <span className="pnl-brand cap-only">
              <LogoSvg /> kosnas.com
            </span>
          </summary>
          <div className="fold-body">
            {!d ? (
              <p className="muted">불러오는 중…</p>
            ) : !rows.length ? (
              <p className="muted">지금은 무기한선물 가격을 받지 못했습니다.</p>
            ) : (
              <>
                <p className={`pnl-total ${tone(t.won)}`}>
                  {shortWon(t.won)}
                  <span className="pnl-pct">{pct(t.pct)}</span>
                </p>
                <ul className="pnl-rows">
                  {rows.map((r) => (
                    <li key={r.coin}>
                      <span>
                        {r.name}
                        <span className="muted no-capture"> {r.shares.toLocaleString()}주</span>
                      </span>
                      <span className={tone(r.won)}>
                        {shortWon(r.won)} <small>({pct(r.pct)})</small>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="pnl-note muted">
                  추정 · KRX 종가 대비 해외 무기한선물 원화 환산 가격 {d ? `· ${hhmm(d.updated)}` : ""}
                  {!live && " · 국내 개장 전까지"}
                </p>
              </>
            )}
            <div className="pnl-actions no-capture">
              <button type="button" className="pnl-edit" onClick={() => setOpen(true)}>
                주수 바꾸기
              </button>
              {d && rows.length > 0 && (
                <button type="button" className="pnl-share" onClick={() => setCapturing(true)}>
                  캡처해서 자랑하기
                </button>
              )}
            </div>
          </div>
        </details>
      </section>
      {capturing && (
        <CaptureSheet
          target={() => box.current}
          fileName={`kosnas-my-night-${d?.updated ?? 0}.png`}
          shareTitle={`자는 동안 내 주식 ${shortWon(t.won)} (추정)`}
          shareUrl="https://kosnas.com/?utm_source=pnl_share"
          onClose={() => setCapturing(false)}
        />
      )}
    </>
  );
}

function PnlForm({ h, onDone }: { h: Holdings; onDone: () => void }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(PNL_STOCKS.map((s) => [s.coin, h[s.coin] ? String(h[s.coin]) : ""])));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Holdings = {};
    for (const s of PNL_STOCKS) {
      const n = cleanShares(v[s.coin] ?? "");
      if (n) next[s.coin] = n;
    }
    save(Object.keys(next).length ? next : null);
    onDone();
  };
  return (
    <form className="card pnl pnl-form no-capture" onSubmit={submit}>
      <h2>보유 주수 넣기</h2>
      {PNL_STOCKS.map((s) => (
        <label key={s.coin}>
          <span>{s.name}</span>
          <input
            inputMode="numeric"
            placeholder="0"
            value={v[s.coin]}
            onChange={(e) => setV({ ...v, [s.coin]: e.target.value.replace(/[^\d,]/g, "") })}
            aria-label={`${s.name} 보유 주수`}
          />
          <span className="muted">주</span>
        </label>
      ))}
      <p className="muted pnl-privacy">주수는 이 브라우저에만 저장되고 서버로 보내지 않아요. 비우고 저장하면 지워집니다.</p>
      <div className="pnl-actions">
        <button type="button" className="pnl-cancel" onClick={onDone}>
          닫기
        </button>
        <button type="submit" className="pnl-save">
          저장
        </button>
      </div>
    </form>
  );
}
