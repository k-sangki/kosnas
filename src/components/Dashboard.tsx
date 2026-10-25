"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { NightData } from "@/lib/night";
import { NIGHT_STOCKS } from "@/lib/night-stocks";
import { TvWidget } from "./TvWidget";

/**
 * 대시보드의 작은 카드들. 무기한선물 카드는 야간 추정과 같은 자료(/api/night)로 그리고,
 * 그 밖의 시세는 트레이딩뷰 위젯이 직접 보여 준다(값을 받거나 저장하지 않는다).
 * 어떤 카드를 어떤 순서로 볼지는 이 브라우저에만 저장한다.
 */
type Tile = { id: string; label: string } & ({ kind: "hl"; coin: string; sub: string; unit?: "₩" | "$" } | { kind: "tv"; symbol: string });

const XSUB = "무기한선물 · 24시간 전 대비 · 주말에도 거래";

const TILES: Tile[] = [
  { id: "SMSN", label: "삼성전자", kind: "hl", coin: "SMSN", unit: "₩", sub: "무기한선물 · 원화 환산" },
  { id: "SKHX", label: "SK하이닉스", kind: "hl", coin: "SKHX", unit: "₩", sub: "무기한선물 · 원화 환산" },
  { id: "EWY", label: "EWY(한국 ETF)", kind: "hl", coin: "EWY", unit: "$", sub: "무기한선물 · 달러" },
  { id: "XYZ100", label: "나스닥 100", kind: "hl", coin: "XYZ100", sub: "무기한선물 · 포인트" },
  { id: "SP500", label: "S&P 500", kind: "hl", coin: "SP500", sub: "무기한선물 · 포인트" },
  { id: "KRW", label: "원/달러", kind: "hl", coin: "KRW", unit: "₩", sub: "무기한선물" },
  { id: "USO", label: "유가(USO)", kind: "tv", symbol: "AMEX:USO" },
  { id: "QQQ", label: "QQQ", kind: "tv", symbol: "NASDAQ:QQQ" },
  { id: "KR200", label: "KR200", kind: "hl", coin: "KR200", sub: "코스피200 무기한선물 · 포인트" },
  { id: "WTI", label: "서부텍사스유(WTI)", kind: "tv", symbol: "TVC:USOIL" },
  { id: "BRENT", label: "브렌트유", kind: "tv", symbol: "TVC:UKOIL" },
  { id: "SPY", label: "SPY", kind: "tv", symbol: "AMEX:SPY" },
  { id: "SOXX", label: "반도체(SOXX)", kind: "tv", symbol: "NASDAQ:SOXX" },
  { id: "GOLD", label: "금", kind: "tv", symbol: "TVC:GOLD" },
  { id: "DXY", label: "달러 인덱스", kind: "tv", symbol: "TVC:DXY" },
  { id: "BTC", label: "비트코인", kind: "tv", symbol: "BITSTAMP:BTCUSD" },
  // 주말·새벽에도 거래되는 무기한선물. 등락은 24시간 전 대비
  { id: "P-CL", label: "유가(WTI) · 24시간", kind: "hl", coin: "CL", unit: "$", sub: XSUB },
  { id: "P-BRENT", label: "브렌트유 · 24시간", kind: "hl", coin: "BRENTOIL", unit: "$", sub: XSUB },
  { id: "P-GOLD", label: "금 · 24시간", kind: "hl", coin: "GOLD", unit: "$", sub: XSUB },
  { id: "P-SILVER", label: "은 · 24시간", kind: "hl", coin: "SILVER", unit: "$", sub: XSUB },
  { id: "P-NVDA", label: "엔비디아", kind: "hl", coin: "NVDA", unit: "$", sub: XSUB },
  { id: "P-TSLA", label: "테슬라", kind: "hl", coin: "TSLA", unit: "$", sub: XSUB },
  { id: "P-MU", label: "마이크론", kind: "hl", coin: "MU", unit: "$", sub: XSUB },
  { id: "P-TSM", label: "TSMC", kind: "hl", coin: "TSM", unit: "$", sub: XSUB },
  { id: "P-VIX", label: "VIX(변동성)", kind: "hl", coin: "VIX", sub: XSUB },
  { id: "P-DXY", label: "달러 인덱스 · 24시간", kind: "hl", coin: "DXY", sub: XSUB },
];
const BY_ID = new Map(TILES.map((t) => [t.id, t]));
const DEFAULT = ["SMSN", "SKHX", "XYZ100", "P-CL", "BTC"];

// ---- 이 브라우저에만 남기는 카드 목록 ----
const KEY = "kosnas:dashboard:v2";
const OLD = "kosnas:dashboard:v1";
/**
 * 기본 배치가 바뀐 것을 예전에 저장한 배치에도 한 번씩만 반영한다(그 뒤에 사용자가 바꾼 것은 건드리지 않는다).
 * 유가: 주말에 멈추는 USO·WTI(트레이딩뷰) 대신 주말에도 거래되는 WTI 무기한선물
 * default-4: 예전에 저장한 배치도 새 기본(삼성전자·SK하이닉스·나스닥 100·WTI)으로 한 번 맞춘다
 * btc-5th: 비트코인을 다섯 번째 자리에
 */
const STEPS: [string, (v: string[]) => string[]][] = [
  ["WTI", (v) => (v.includes("WTI") ? v : [...v, "WTI"])],
  ["oil-24h", (v) => (v.includes("P-CL") ? v : v.map((x) => (x === "USO" ? "P-CL" : x))).filter((x) => x !== "WTI" && x !== "USO")],
  // 기본을 네 장으로 줄였다(10년물 금리는 트레이딩뷰 위젯이 외부 사이트에 보여 주지 않아 뺐다)
  ["default-4", () => DEFAULT],
  ["btc-5th", (v) => (v.includes("BTC") ? v : [...v.slice(0, 4), "BTC", ...v.slice(4)])],
];
const ADDED_KEY = "kosnas:dashboard:added";
function migrate() {
  try {
    const old = localStorage.getItem(OLD);
    if (old != null) {
      if (localStorage.getItem(KEY) == null) localStorage.setItem(KEY, old);
      localStorage.removeItem(OLD);
    }
    const done = JSON.parse(localStorage.getItem(ADDED_KEY) ?? "[]") as string[];
    const todo = STEPS.filter(([k]) => !done.includes(k));
    if (!todo.length) return;
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(v)) localStorage.setItem(KEY, JSON.stringify(todo.reduce((a, [, f]) => f(a), v as string[])));
    localStorage.setItem(ADDED_KEY, JSON.stringify(STEPS.map(([k]) => k)));
  } catch {}
}
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
  migrate();
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

/** 이름 앞 작은 심볼. 회사 로고 원본 대신 직접 그린 배지·국기·아이콘이다 */
function Badge({ t, bg, size = 9 }: { t: string; bg: string; size?: number }) {
  return (
    <svg className="tile-icon" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="10" fill={bg} />
      <text x="10" y="10" dy="0.35em" textAnchor="middle" fontSize={size} fontWeight="800" fill="#fff">
        {t}
      </text>
    </svg>
  );
}
function KrFlag() {
  return (
    <svg className="tile-icon" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="9.5" fill="#fff" stroke="#d1d6db" />
      <path d="M4 10a6 6 0 0 1 12 0z" fill="#cd2e3a" />
      <path d="M4 10a6 6 0 0 0 12 0z" fill="#0047a0" />
    </svg>
  );
}
function UsFlag() {
  return (
    <svg className="tile-icon" viewBox="0 0 20 20" aria-hidden>
      <clipPath id="usf">
        <circle cx="10" cy="10" r="10" />
      </clipPath>
      <g clipPath="url(#usf)">
        <rect width="20" height="20" fill="#fff" />
        {[0, 4, 8, 12, 16].map((y) => (
          <rect key={y} y={y} width="20" height="2" fill="#b22234" />
        ))}
        <rect width="10" height="10" fill="#3c3b6e" />
      </g>
    </svg>
  );
}
function Drop() {
  return (
    <svg className="tile-icon" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="#2b2f36" />
      <path d="M10 4.2c2.2 3 3.6 5 3.6 6.8a3.6 3.6 0 0 1-7.2 0c0-1.8 1.4-3.8 3.6-6.8z" fill="#f5a524" />
    </svg>
  );
}
const ICONS: Record<string, () => React.ReactElement> = {
  SMSN: () => <Badge t="S" bg="#1428a0" size={11} />,
  SKHX: () => <Badge t="SK" bg="#ea002c" />,
  EWY: KrFlag,
  KR200: KrFlag,
  XYZ100: UsFlag,
  SP500: UsFlag,
  SPY: UsFlag,
  QQQ: UsFlag,
  SOXX: () => <Badge t="SOX" bg="#4e5968" size={6.5} />,
  KRW: () => <Badge t="₩" bg="#0e3b36" size={11} />,
  USO: Drop,
  WTI: Drop,
  BRENT: Drop,
  GOLD: () => <Badge t="Au" bg="#c9971c" />,
  DXY: () => <Badge t="$" bg="#2e7d32" size={11} />,
  BTC: () => <Badge t="₿" bg="#f7931a" size={11} />,
  "P-CL": Drop,
  "P-BRENT": Drop,
  "P-GOLD": () => <Badge t="Au" bg="#c9971c" />,
  "P-SILVER": () => <Badge t="Ag" bg="#8a8f98" />,
  "P-NVDA": () => <Badge t="NV" bg="#76b900" />,
  "P-TSLA": () => <Badge t="T" bg="#cc0000" size={11} />,
  "P-MU": () => <Badge t="MU" bg="#0071c5" />,
  "P-TSM": () => <Badge t="TSM" bg="#c8102e" size={6.5} />,
  "P-VIX": () => <Badge t="VIX" bg="#4e5968" size={6.5} />,
  "P-DXY": () => <Badge t="$" bg="#2e7d32" size={11} />,
};

/** 트레이딩뷰 심볼 로고(파일 이름). 못 불러오면 위의 직접 그린 아이콘을 쓴다 */
const LOGO = "https://s3-symbol-logo.tradingview.com/";
const LOGOS: Record<string, string> = {
  SMSN: "samsung-electronics",
  SKHX: "sk-hynix",
  SOXX: "ishares",
  KR200: "country/KR",
  XYZ100: "indices/nasdaq-100",
  SP500: "indices/s-and-p-500",
  SPY: "spdr-sandp500-etf-tr",
  QQQ: "invesco",
  KRW: "country/KR",
  USO: "united-states-commodity-funds",
  WTI: "crude-oil",
  BRENT: "brent-oil",
  GOLD: "metal/gold",
  DXY: "indices/u-s-dollar-index",
  BTC: "crypto/XTVCBTC",
  "P-CL": "crude-oil",
  "P-BRENT": "brent-oil",
  "P-GOLD": "metal/gold",
  "P-SILVER": "metal/silver",
  "P-NVDA": "nvidia",
  "P-TSLA": "tesla",
  "P-MU": "micron-technology",
  "P-TSM": "taiwan-semiconductor",
  "P-DXY": "indices/u-s-dollar-index",
};

function Icon({ id }: { id: string }) {
  const [bad, setBad] = useState(false);
  const slug = LOGOS[id];
  if (!slug || bad) return ICONS[id]?.() ?? null;
  // 서버에서 그린 이미지는 화면이 살아나기 전에 실패할 수 있어, 붙을 때 한 번 더 본다
  const check = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0) setBad(true);
  };
  // 캡처 이미지에는 다른 사이트 그림이 들어가지 않아 직접 그린 아이콘으로 바꿔 넣는다
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={check} className="tile-icon tile-logo" src={`${LOGO}${slug}.svg`} alt="" onError={() => setBad(true)} />
      <span className="cap-icon">{ICONS[id]?.()}</span>
    </>
  );
}

const fmt = (v: number, d = 2) => v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d });
/** 15:45 대비 원화 등락(같은 % 등락을 지금 원화 값에 되돌려 센다) */
const won = (v: number) => `${v > 0 ? "▲" : v < 0 ? "▼" : ""}${Math.abs(Math.round(v)).toLocaleString()}원`;
const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : "");

function HlBody({ t, d }: { t: Extract<Tile, { kind: "hl" }>; d: NightData | null }) {
  const x = d?.extra?.[t.coin];
  // 주말(금요일 CME 마감 뒤)에는 원자재 카드를 금요일 마감 대비로 본다
  const wk = !d?.inputs.some((v) => v.coin === t.coin) ? x?.wk : undefined;
  const ref = wk ? wk.close : x?.prev;
  const i =
    d?.inputs.find((v) => v.coin === t.coin) ??
    (x && { coin: t.coin, price: x.price, chg: ref ? (x.price / ref - 1) * 100 : null, krw: undefined, spark: x.spark, sparkT: x.sparkT });
  if (!i) return <p className="tile-price muted">{d ? "자료 없음" : "…"}</p>;
  return (
    <>
      {/* 가격·등락 오른쪽 남는 자리를 선 차트가 채운다(좁은 카드에서는 아래로) */}
      <div className="tile-body">
        <p className="tile-price">
          {t.unit && <span className="tile-unit">{t.unit}</span>}
          {i.krw ? i.krw.toLocaleString() : fmt(i.price)}
          {t.unit && <span className="tile-word">{t.unit === "₩" ? "원" : "달러"}</span>}
        </p>
        <p className={`tile-chg ${i.chg != null ? tone(i.chg) : ""}`}>
          {i.chg != null ? `${i.chg > 0 ? "+" : ""}${fmt(i.chg)}%` : "-"}
          {i.krw && i.chg != null && <span className="tile-won">{won(i.krw - i.krw / (1 + i.chg / 100))}</span>}
        </p>
        {i.spark && <Spark v={i.spark} t={i.sparkT} base={wk ? wk.close : x && !d?.inputs.some((v) => v.coin === t.coin) ? (x.prev ?? undefined) : undefined} />}
      </div>
      <p className="tile-sub">{wk ? "주말 거래 · 금요일 마감 대비 · 추정치" : t.sub}</p>
    </>
  );
}

/** 위젯은 폭이 좁으면 등락을 숨긴다. 이 폭보다 좁은 카드에서는 이 폭으로 그린 뒤 줄여서 보인다 */
const TV_MIN_W = 340;
const TV_H = 150;

function TvBody({ t }: { t: Extract<Tile, { kind: "tv" }> }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const k = w > 0 && w < TV_MIN_W ? w / TV_MIN_W : 1;
  return (
    <div ref={box} className="tv-fit" style={{ height: k < 1 ? (TV_H + 22) * k : undefined }}>
      <div style={k < 1 ? { width: TV_MIN_W, transform: `scale(${k})`, transformOrigin: "0 0" } : undefined}>
        <TvWidget
          kind="mini-symbol-overview"
          height={TV_H}
          config={{ symbol: t.symbol, width: "100%", height: TV_H, locale: "kr", dateRange: "1D", colorTheme: "light", isTransparent: true, noTimeScale: true }}
        />
      </div>
    </div>
  );
}

/**
 * 작은 선 차트. 가로축은 야간 구간 전체(15:45~다음 거래일 09:00)라 아직 오지 않은 시간은 비어 있고 끝에 지금 점을 찍는다.
 * 점선은 등락률 기준(보통 15:45 가격, 24시간 카드는 24시간 전 가격). t가 없는 예전 자료는 폭을 다 채운다.
 */
function Spark({ v, t, base = v[0] }: { v: number[]; t?: number[]; base?: number }) {
  const W = 64;
  const H = 36;
  const lo = Math.min(...v, base);
  const hi = Math.max(...v, base);
  const span = hi - lo || 1;
  const y = (x: number) => 2 + (1 - (x - lo) / span) * (H - 4);
  const x = (k: number) => (t && t.length === v.length ? t[k] : k / (v.length - 1)) * W;
  const pts = v.map((p, k) => `${x(k).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const k = v.length - 1;
  return (
    // 상자 크기는 카드 배치가 정하고 그림은 그 상자를 채운다(그림 비율이 카드 높이를 늘리지 않게)
    <div className="tile-spark-box">
      <svg className={`tile-spark ${tone(v[k] - base)}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
        <line x1={0} x2={W} y1={y(base)} y2={y(base)} className="base" />
        <polyline points={pts} />
      </svg>
      {/* 끝 점은 그림을 늘려도 둥글게 보이도록 SVG 밖에 둔다 */}
      {x(k) < W - 0.5 && <span className={`tile-spark-dot ${tone(v[k] - base)}`} style={{ left: `${(x(k) / W) * 100}%`, top: `calc(4px + (100% - 8px) * ${(y(v[k]) / H).toFixed(3)})` }} />}
    </div>
  );
}

const LONG_PRESS = 350;

/** 한 번 탭하면 그 종목의 밤사이 가격 페이지로 가는 카드 */
const PAGE: Record<string, string> = {
  ...Object.fromEntries(NIGHT_STOCKS.map((s) => [s.coin, `/night/${s.slug}`])),
  // 유가 카드는 주말 유가 페이지로
  "P-CL": "/weekend-oil",
  "P-BRENT": "/weekend-oil",
};

/**
 * 카드 끌어 옮기기. 마우스는 누른 채 조금 움직이면, 손가락은 길게 누르면(아이폰 홈 화면처럼) 집어 든다.
 * 끄는 동안 순서를 바로 바꿔 보여 주고, 놓으면 저장한다.
 */
function useDrag(ids: string[], grid: React.RefObject<HTMLDivElement | null>) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const st = useRef<{
    id: string;
    pid: number;
    sx: number;
    sy: number;
    gx: number;
    gy: number;
    el: HTMLElement;
    timer?: ReturnType<typeof setTimeout>;
    on: boolean;
    off?: () => void;
  } | null>(null);
  /** 방금 누른 카드를 집어 들었는가(끌기 뒤의 클릭은 탭으로 치지 않는다) */
  const dragged = useRef(false);
  const list = order ?? ids;
  const listRef = useRef(list);
  useLayoutEffect(() => {
    listRef.current = list;
  });

  const place = (x: number, y: number) => {
    const s = st.current;
    const g = grid.current;
    if (!s || !g) return;
    const r = g.getBoundingClientRect();
    s.el.style.transform = `translate(${x - r.left - s.gx - s.el.offsetLeft}px, ${y - r.top - s.gy - s.el.offsetTop}px)`;
  };
  const last = useRef({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (st.current?.on) place(last.current.x, last.current.y);
  });

  useEffect(() => {
    // 집어 든 뒤에는 화면이 스크롤되지 않게
    const stop = (e: TouchEvent) => st.current?.on && e.preventDefault();
    document.addEventListener("touchmove", stop, { passive: false });
    return () => document.removeEventListener("touchmove", stop);
  }, []);

  const lift = () => {
    const s = st.current;
    if (!s) return;
    s.on = true;
    dragged.current = true;
    try {
      s.el.setPointerCapture(s.pid);
    } catch {}
    navigator.vibrate?.(10);
    setHeld(s.id);
    setOrder(listRef.current);
    place(last.current.x, last.current.y);
  };
  const end = (keep: boolean) => {
    const s = st.current;
    if (!s) return;
    clearTimeout(s.timer);
    s.off?.();
    s.el.style.transform = "";
    if (s.on && keep) save(listRef.current);
    st.current = null;
    setHeld(null);
    setOrder(null);
  };

  const props = (id: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest("button, a")) return;
      dragged.current = false;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      last.current = { x: e.clientX, y: e.clientY };
      st.current = { id, pid: e.pointerId, sx: e.clientX, sy: e.clientY, gx: e.clientX - r.left, gy: e.clientY - r.top, el, on: false };
      if (e.pointerType !== "mouse") st.current.timer = setTimeout(lift, LONG_PRESS);
      // 집어 든 카드는 포인터를 받지 않으므로(아래 카드 찾기) 창에서 듣는다
      const up = () => end(true);
      const cancel = () => end(false);
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      st.current.off = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
      };
    },
    onContextMenu: (e: React.MouseEvent) => st.current?.on && e.preventDefault(),
  });

  function move(e: PointerEvent) {
    const s = st.current;
    if (!s || s.pid !== e.pointerId) return;
    last.current = { x: e.clientX, y: e.clientY };
    const far = Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 6;
    if (!s.on) {
      if (!far) return;
      if (e.pointerType === "mouse") lift();
      else return end(false); // 길게 누르기 전에 움직이면 스크롤
    }
    e.preventDefault();
    place(e.clientX, e.clientY);
    const under = document
      .elementsFromPoint(e.clientX, e.clientY)
      .map((n) => (n as HTMLElement).closest?.("[data-tile]") as HTMLElement | null)
      .find((n) => n && n !== s.el);
    const to = under?.dataset.tile;
    if (to) {
      const cur = listRef.current;
      const a = cur.indexOf(s.id);
      const b = cur.indexOf(to);
      if (a >= 0 && b >= 0 && a !== b) {
        const next = [...cur];
        next.splice(a, 1);
        next.splice(b, 0, s.id);
        setOrder(next);
      }
    }
  }

  return { list, held, props, dragged };
}

export function Dashboard({ d }: { d: NightData | null }) {
  const ids = useIds();
  const [edit, setEdit] = useState(false);
  const [picking, setPicking] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const { list, held, props, dragged } = useDrag(ids, grid);
  const router = useRouter();
  const rest = TILES.filter((t) => !ids.includes(t.id));
  // 캡처 이미지에는 앞쪽 무기한선물 카드 6개만 넣는다
  const inCapture = new Set(list.filter((id) => BY_ID.get(id)!.kind === "hl").slice(0, 6));

  return (
    <section className="dash" aria-label="시세 카드">
      <div className="dash-head">
        <h2>해외에서 거래 중인 시세</h2>
        <button type="button" className="dash-edit no-capture" aria-pressed={edit} onClick={() => setEdit(!edit)}>
          {edit ? "완료" : "카드 편집"}
        </button>
      </div>
      <div className={`dash-grid${edit ? " editing" : ""}`} ref={grid}>
        {list.map((id) => {
          const t = BY_ID.get(id)!;
          const href = !edit ? PAGE[id] : undefined;
          const go = href ? () => router.push(href) : undefined;
          return (
            <article
              key={id}
              data-tile={id}
              className={`tile${held === id ? " held" : ""}${inCapture.has(id) ? "" : " no-capture"}${href ? " linked" : ""}`}
              {...props(id)}
              {...(go && {
                role: "link",
                tabIndex: 0,
                "aria-label": `${t.label} ${href.startsWith("/night") ? "밤사이 가격" : "주말 유가"} 보기`,
                onClick: () => !dragged.current && go(),
                onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && go(),
              })}
            >
              <h3 className="tile-label">
                <Icon id={id} />
                {t.label}
              </h3>
              {t.kind === "hl" ? <HlBody t={t} d={d} /> : <TvBody t={t} />}
              {/* 편집 중에는 위젯 위를 덮어 카드 어디를 잡아도 끌 수 있게 */}
              {edit && t.kind === "tv" && <div className="tile-cover" />}
              {edit && (
                <button type="button" className="tile-remove no-capture" onClick={() => save(ids.filter((x) => x !== id))} aria-label={`${t.label} 빼기`}>
                  ×
                </button>
              )}
            </article>
          );
        })}
        {edit && rest.length > 0 && (
          <button type="button" className="tile tile-new no-capture" onClick={() => setPicking(true)} aria-label="카드 넣기">
            +
          </button>
        )}
      </div>
      {picking && (
        <div className="picker-bg" onClick={() => setPicking(false)}>
          <div className="picker" role="dialog" aria-label="카드 넣기" onClick={(e) => e.stopPropagation()}>
            <div className="picker-head">
              <h3>카드 넣기</h3>
              <button type="button" onClick={() => setPicking(false)} aria-label="닫기">
                ×
              </button>
            </div>
            <ul>
              {rest.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      save([...ids, t.id]);
                      setPicking(false);
                    }}
                  >
                    <Icon id={t.id} />
                    <span>{t.label}</span>
                    <span className="muted">{t.kind === "hl" ? t.sub : "트레이딩뷰 시세"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {edit && (
        <div className="dash-add no-capture">
          <p className="muted">카드를 끌어 순서를 바꾸고, ×로 빼고, +로 넣을 수 있어요.</p>
          <button type="button" className="dash-reset" onClick={() => save(null)}>
            기본 배치로 되돌리기
          </button>
        </div>
      )}
      <p className="muted small-note no-capture">
        카드를 길게 누르거나(마우스는 끌어서) 원하는 자리로 옮길 수 있어요. 무기한선물 카드는 Hyperliquid(trade.xyz) 시세이고 등락과 선 차트는 15:45
        대비입니다(“주말에도 거래” 카드는 24시간 전 대비). 삼성전자·SK하이닉스는 1주 기준 달러 가격에 원/달러를 곱한 값이에요. 그 밖의 카드는 트레이딩뷰가 직접
        보여 주는 시세(미국 전일 종가 대비)입니다. 카드 배치는 이 브라우저에만 저장됩니다.
      </p>
    </section>
  );
}
