"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { NightData } from "@/lib/night";
import { TvWidget } from "./TvWidget";

/**
 * 대시보드의 작은 카드들. 무기한선물 카드는 야간 추정과 같은 자료(/api/night)로 그리고,
 * 그 밖의 시세는 트레이딩뷰 위젯이 직접 보여 준다(값을 받거나 저장하지 않는다).
 * 어떤 카드를 어떤 순서로 볼지는 이 브라우저에만 저장한다.
 */
type Tile = { id: string; label: string } & ({ kind: "hl"; coin: string; sub: string } | { kind: "tv"; symbol: string });

const TILES: Tile[] = [
  { id: "SMSN", label: "삼성전자", kind: "hl", coin: "SMSN", sub: "무기한선물 · 원화 환산" },
  { id: "SKHX", label: "SK하이닉스", kind: "hl", coin: "SKHX", sub: "무기한선물 · 원화 환산" },
  { id: "EWY", label: "EWY(한국 ETF)", kind: "hl", coin: "EWY", sub: "무기한선물 · 달러" },
  { id: "XYZ100", label: "나스닥 100", kind: "hl", coin: "XYZ100", sub: "무기한선물" },
  { id: "SP500", label: "S&P 500", kind: "hl", coin: "SP500", sub: "무기한선물" },
  { id: "KRW", label: "원/달러", kind: "hl", coin: "KRW", sub: "무기한선물" },
  { id: "USO", label: "유가(USO)", kind: "tv", symbol: "AMEX:USO" },
  { id: "QQQ", label: "QQQ", kind: "tv", symbol: "NASDAQ:QQQ" },
  { id: "KR200", label: "KR200", kind: "hl", coin: "KR200", sub: "코스피200 무기한선물" },
  { id: "WTI", label: "서부텍사스유(WTI)", kind: "tv", symbol: "TVC:USOIL" },
  { id: "BRENT", label: "브렌트유", kind: "tv", symbol: "TVC:UKOIL" },
  { id: "SPY", label: "SPY", kind: "tv", symbol: "AMEX:SPY" },
  { id: "SOXX", label: "반도체(SOXX)", kind: "tv", symbol: "NASDAQ:SOXX" },
  { id: "GOLD", label: "금", kind: "tv", symbol: "TVC:GOLD" },
  { id: "DXY", label: "달러 인덱스", kind: "tv", symbol: "TVC:DXY" },
  { id: "US10Y", label: "미국 10년물 금리", kind: "tv", symbol: "TVC:US10Y" },
  { id: "BTC", label: "비트코인", kind: "tv", symbol: "BITSTAMP:BTCUSD" },
];
const BY_ID = new Map(TILES.map((t) => [t.id, t]));
const DEFAULT = ["SMSN", "SKHX", "EWY", "XYZ100", "SP500", "KRW", "USO", "QQQ"];

// ---- 이 브라우저에만 남기는 카드 목록 ----
const KEY = "kosnas:dashboard:v1";
const listeners = new Set<() => void>();
let memory: string | null = null; // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)
function read() {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}
function save(ids: string[] | null) {
  memory = ids ? JSON.stringify(ids) : null;
  try {
    if (ids) localStorage.setItem(KEY, memory!);
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
function useIds() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => {
    try {
      const v = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && BY_ID.has(x));
    } catch {}
    return DEFAULT;
  }, [raw]);
}

const fmt = (v: number, d = 2) => v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");

function HlBody({ t, d }: { t: Extract<Tile, { kind: "hl" }>; d: NightData | null }) {
  const i = d?.inputs.find((x) => x.coin === t.coin);
  if (!i) return <p className="tile-price muted">{d ? "자료 없음" : "…"}</p>;
  return (
    <>
      <p className="tile-price">{i.krw ? `${i.krw.toLocaleString()}원` : fmt(i.price)}</p>
      <p className={`tile-chg ${i.chg != null ? tone(i.chg) : ""}`}>
        {i.chg != null ? `${i.chg > 0 ? "+" : ""}${fmt(i.chg)}%` : "-"} <span className="muted">15:45 대비</span>
      </p>
      <p className="tile-sub">{t.sub}</p>
    </>
  );
}

function TvBody({ t }: { t: Extract<Tile, { kind: "tv" }> }) {
  return <TvWidget kind="single-quote" height={76} config={{ symbol: t.symbol, width: "100%", isTransparent: true, colorTheme: "light", locale: "kr" }} />;
}

export function Dashboard({ d }: { d: NightData | null }) {
  const ids = useIds();
  const [edit, setEdit] = useState(false);
  const move = (i: number, by: number) => {
    const next = [...ids];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const rest = TILES.filter((t) => !ids.includes(t.id));

  return (
    <section className="dash" aria-label="시세 카드">
      <div className="dash-head">
        <h2>해외에서 거래 중인 시세</h2>
        <button type="button" className="dash-edit" aria-pressed={edit} onClick={() => setEdit(!edit)}>
          {edit ? "완료" : "카드 편집"}
        </button>
      </div>
      <div className="dash-grid">
        {ids.map((id, i) => {
          const t = BY_ID.get(id)!;
          return (
            <article key={id} className="tile">
              <h3 className="tile-label">{t.label}</h3>
              {t.kind === "hl" ? <HlBody t={t} d={d} /> : <TvBody t={t} />}
              {edit && (
                <div className="tile-tools">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${t.label} 앞으로`}>
                    ←
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === ids.length - 1} aria-label={`${t.label} 뒤로`}>
                    →
                  </button>
                  <button type="button" onClick={() => save(ids.filter((x) => x !== id))} aria-label={`${t.label} 빼기`}>
                    빼기
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {!ids.length && <p className="muted">카드를 모두 뺐습니다. 아래에서 다시 넣을 수 있어요.</p>}
      </div>
      {edit && (
        <div className="dash-add">
          {rest.length > 0 && <p className="muted">눌러서 카드 넣기</p>}
          <div className="chips">
            {rest.map((t) => (
              <button key={t.id} type="button" className="chip" onClick={() => save([...ids, t.id])}>
                + {t.label}
              </button>
            ))}
          </div>
          <button type="button" className="dash-reset" onClick={() => save(null)}>
            기본 배치로 되돌리기
          </button>
        </div>
      )}
      <p className="muted small-note">
        무기한선물 카드는 Hyperliquid(trade.xyz) 시세이고 등락은 15:45 대비입니다. 삼성전자·SK하이닉스는 1주 기준 달러 가격에 원/달러를 곱한 값이에요. 그 밖의
        카드는 트레이딩뷰가 직접 보여 주는 시세입니다. 카드 배치는 이 브라우저에만 저장됩니다.
      </p>
    </section>
  );
}
