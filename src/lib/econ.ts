/**
 * 경제지표 예상치·결과(/econ, 첫 화면 띠).
 *
 * 원천은 나스닥 경제지표 달력. collector/econ.py 가 하루 몇 번 src/data/econ.json 에 바탕 자료를 쓰고,
 * 발표 직후 실제 값은 워커 /api/econ 이 나스닥에서 바로 받아 덮는다(econLive).
 * 달력은 date=D 로 물으면 D 하루 전(미국 동부) 발표가 나오고 시각은 UTC-5 고정이다(2026-11-11 확인).
 * 어떤 지표를 넣을지는 src/data/econ-names.json 한 곳에 적는다(수집기와 함께 읽는다).
 *
 * 판정은 실제와 예상(시장 예상치)만 비교한다: 같으면 부합, 크면 상회, 작으면 하회.
 * 좋다·나쁘다는 붙이지 않는다(물가 상회는 증시에 나쁠 수 있고 고용 상회는 좋을 수 있다).
 */
import names from "../data/econ-names.json";

export interface Row {
  /** 달력에 물은 날짜(발표일 다음 날) */
  d: string;
  /** UTC-5 시각 HH:MM */
  t: string;
  c: string;
  n: string;
  a: string;
  f: string;
  p: string;
}

export interface Earning {
  symbol: string;
  name: string;
  /** 미국 날짜 */
  date: string;
  when: "pre" | "after" | "";
  capB: number | null;
  quarter: string;
  /** 예상 EPS */
  f: number | null;
  /** 예상한 애널리스트 수 */
  n: number | null;
  /** 실제 EPS */
  a: number | null;
  /** 서프라이즈 % */
  s: number | null;
  /** 전년 같은 분기 EPS */
  ly: number | null;
  /** 실제 값 출처(야후면 예상도 야후 기준) */
  src?: string;
}

export interface Dots {
  date: string;
  url: string;
  years: string[];
  rows: { rate: number; n: number[] }[];
}

export interface EconData {
  updated: string;
  rows: Row[];
  earnings: Earning[] | null;
  dots: Dots | null;
}

export type Verdict = "beat" | "match" | "miss";

export interface Metric {
  label: string;
  a: string;
  f: string;
  p: string;
  av: number | null;
  fv: number | null;
  pv: number | null;
  verdict: Verdict | null;
  /** 직전 칸 이름(기본 '직전', 실적은 '1년 전') */
  pLabel?: string;
}

export interface Release {
  id: string;
  group: string;
  name: string;
  emoji: string;
  band: boolean;
  /** 발표 시각(UTC ms) */
  at: number;
  metrics: Metric[];
  /** 결과가 나왔는지(주요 수치의 실제 값) */
  out: boolean;
  /** 시각 대신 붙일 말(실적: 아침·밤). 있으면 시각을 쓰지 않는다 */
  whenText?: string;
  /** 실적이면 종목 기호 */
  sym?: string;
}

type Group = { name: string; emoji: string; band: boolean };
type Def = { country: string; name?: string; re?: string; group: string; label: string; primary?: boolean };
const GROUPS = names.groups as Record<string, Group>;
/** 띠와 발표 목록에 CPI처럼 한 건씩 올리는 주목 기업 */
export const EARN_FOCUS = new Set<string>(names.earnFocus);
const DEFS = names.metrics as Def[];

function defOf(r: Pick<Row, "c" | "n">): Def | null {
  const n = r.n.trim().toLowerCase();
  for (const m of DEFS) {
    if (m.country !== r.c) continue;
    if (m.name && m.name.toLowerCase() === n) return m;
    if (m.re && new RegExp(m.re, "i").test(r.n.trim())) return m;
  }
  return null;
}

export const wanted = (r: Pick<Row, "c" | "n">) => defOf(r) != null;

/** '1,718K' → 1718000, '0.3%' → 0.3, ' ' → null */
export function parseNum(s: string): number | null {
  const m = s.replace(/,/g, "").trim().match(/^(-?\d+(?:\.\d+)?)\s*([KMBT%])?$/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] ?? "").toUpperCase()] ?? 1;
  return Number(m[1]) * mult;
}

const decimals = (s: string) => (s.replace(/[^\d.]/g, "").split(".")[1] ?? "").length;

export function verdictOf(a: string, f: string): Verdict | null {
  const av = parseNum(a);
  const fv = parseNum(f);
  if (av == null || fv == null) return null;
  // 예상치 단위·자릿수로 맞춰 비교한다(예상 0.3% 대 실제 0.30%는 부합, 예상 194K 대 실제 194.2K도 부합)
  const unit = parseNum(f.replace(/-?[\d.,]+/, "1")) ?? 1;
  const k = 10 ** Math.min(decimals(f), 4) / unit;
  const d = Math.round(av * k) - Math.round(fv * k);
  return d === 0 ? "match" : d > 0 ? "beat" : "miss";
}

const DAY = 86_400_000;

/** 달력 날짜·시각 → 발표 시각(UTC ms) */
export function atOf(r: Pick<Row, "d" | "t">) {
  const [h, m] = r.t.split(":").map(Number);
  return Date.parse(`${r.d}T00:00:00Z`) - DAY + (h * 60 + m) * 60_000 + 5 * 3600_000;
}

const SPEAKERS: Record<string, string> = {
  Powell: "파월", Waller: "월러", Bowman: "보먼", Barkin: "바킨", Logan: "로건", Goolsbee: "굴스비", Schmid: "슈미드",
  Daly: "데일리", Williams: "윌리엄스", Barr: "바", Jefferson: "제퍼슨", Cook: "쿡", Kugler: "쿠글러", Musalem: "무살렘",
  Hammack: "해맥", Kashkari: "카시카리", Bostic: "보스틱", Collins: "콜린스", Harker: "하커", Miran: "마이런", Paulson: "폴슨",
  Warsh: "워시", Hassett: "해싯",
};

/** 'FOMC Member Bowman Speaks' → '보먼 연설' */
export function speechLabel(n: string) {
  const who = n.replace(/\b(Speaks|Testifies)\b/g, "").replace(/^(Fed Vice Chair for Supervision|Fed Vice Chair|Fed Chair|Fed Governor|FOMC Member|Fed's|Fed)\s*/i, "").trim();
  const ko = who
    .split(/\s+/)
    .map((w) => SPEAKERS[w] ?? w)
    .join(" ");
  const role = /Chair/i.test(n) && !/Vice/i.test(n) ? "연준 의장 " : /Vice Chair/i.test(n) ? "연준 부의장 " : /Governor/i.test(n) ? "연준 이사 " : "";
  return `${role}${ko} ${/Testifies/.test(n) ? "의회 증언" : "연설"}`;
}

/** 줄 → 발표(같은 묶음·같은 시각) */
export function releases(rows: Row[]): Release[] {
  const map = new Map<string, { group: string; at: number; items: { def: Def; row: Row }[] }>();
  for (const row of rows) {
    const def = defOf(row);
    if (!def) continue;
    const at = atOf(row);
    // 연설은 사람마다 따로
    const id = `${def.group}-${at}${def.group === "speech" ? `-${row.n}` : ""}`;
    const g = map.get(id) ?? { group: def.group, at, items: [] };
    g.items.push({ def, row });
    map.set(id, g);
  }
  const out: Release[] = [];
  for (const [id, g] of map) {
    const grp = GROUPS[g.group];
    const counts = new Map<Def, number>();
    for (const x of g.items) counts.set(x.def, (counts.get(x.def) ?? 0) + 1);
    // 같은 이름 두 줄(전월·전년)은 직전 값이 작은 쪽이 전월
    const metrics: (Metric & { primary: boolean; order: number })[] = [];
    const seen = new Set<string>();
    for (const x of g.items) {
      const key = `${x.def.label}|${x.row.a}|${x.row.f}|${x.row.p}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let label = x.def.label;
      let primary = !!x.def.primary;
      if ((counts.get(x.def) ?? 0) > 1) {
        const mine = Math.abs(parseNum(x.row.p) ?? parseNum(x.row.f) ?? 0);
        const other = g.items.find((y) => y.def === x.def && y.row !== x.row);
        const theirs = Math.abs(parseNum(other?.row.p ?? "") ?? parseNum(other?.row.f ?? "") ?? 0);
        const mom = mine <= theirs;
        label = `${label} ${mom ? "전월 대비" : "전년 대비"}`;
        primary = primary && mom;
      }
      if (g.group === "speech") label = speechLabel(x.row.n);
      metrics.push({
        label,
        a: x.row.a,
        f: x.row.f,
        p: x.row.p,
        av: parseNum(x.row.a),
        fv: parseNum(x.row.f),
        pv: parseNum(x.row.p),
        verdict: verdictOf(x.row.a, x.row.f),
        primary,
        order: DEFS.indexOf(x.def),
      });
    }
    metrics.sort((a, b) => (a.primary !== b.primary ? (a.primary ? -1 : 1) : a.order - b.order));
    const head = metrics[0];
    out.push({
      id,
      group: g.group,
      name: grp.name,
      emoji: grp.emoji,
      band: grp.band,
      at: g.at,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      metrics: metrics.map(({ primary, order, ...m }) => m),
      out: head ? head.av != null : false,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** 바탕 자료에 실시간 줄을 덮는다(실시간이 받은 날짜는 통째로 바꾼다) */
export function mergeRows(base: Row[], live: Row[] | null | undefined) {
  if (!live?.length) return base;
  const days = new Set(live.map((r) => r.d));
  return [...base.filter((r) => !days.has(r.d)), ...live];
}

/** 결과를 띠·맨 위에 남겨 두는 시간: 밤에 나온 결과를 다음 날 일어나서도 보게 하루(2026-11-11 SK) */
export const RESULT_HOLD = 24 * 3600_000;

/** 발표 시각이 지났는데 값이 아직 없을 때 '집계 중'으로 남겨 두는 시간(실적은 정확한 시각이 없고 달력 반영이 늦다) */
export const grace = (r: Release) => (r.group === "earn" ? 30 : 3) * 3600_000;

const shown = (r: Release) => r.band && r.metrics.some((m) => m.f || m.a);

/** 하루 안에 결과가 나온 발표(최근 것 먼저). 띠는 여러 개면 흘려서 모두 보인다 */
export function recentResults(list: Release[], now: number) {
  return list.filter((r) => shown(r) && r.out && r.at <= now && now - r.at < RESULT_HOLD).sort((a, b) => b.at - a.at);
}

/**
 * 띠·맨 위에 올릴 발표 하나: 하루 안에 결과가 나온 것이 있으면 그것(가장 최근),
 * 없으면 아직 결과가 없는 가장 가까운 발표(발표 시각이 지났는데 값이 아직이면 '집계 중')
 */
export function bandPick(list: Release[], now: number): { r: Release; mode: "result" | "next" } | null {
  const done = recentResults(list, now);
  if (done.length) return { r: done[0], mode: "result" };
  const next = list.find((r) => shown(r) && !r.out && r.at > now - grace(r));
  return next ? { r: next, mode: "next" } : null;
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const kst = (ms: number) => new Date(ms + 9 * 3600_000);
export const kstDate = (ms: number) => kst(ms).toISOString().slice(0, 10);
export const kstHm = (ms: number) => kst(ms).toISOString().slice(11, 16);

/** '오늘 22:30' · '내일 04:00' · '11/14(금) 22:30' */
export function whenLabel(at: number, now: number, text?: string) {
  const d = kstDate(at);
  const today = kstDate(now);
  const tomorrow = kstDate(now + DAY);
  const k = kst(at);
  const day = d === today ? "오늘" : d === tomorrow ? "내일" : `${k.getUTCMonth() + 1}/${k.getUTCDate()}(${WD[k.getUTCDay()]})`;
  if (text != null) return text ? `${day} ${text}` : day;
  return `${day} ${kstHm(at)}`;
}

/**
 * 실제 − 예상을 예상치와 같은 단위·자릿수로: '+0.1%p' · '+100K' · '−$0.11'. 둘 중 하나라도 없으면 null
 */
export function diffText(m: Pick<Metric, "a" | "f">): string | null {
  const read = (s: string) => {
    const t = s.trim();
    const x = t.match(/(\d[\d,]*)(\.\d+)?/);
    if (!x) return null;
    const v = Number(`${x[1].replace(/,/g, "")}${x[2] ?? ""}`) * (/^[-−(]|\$-|\(\$/.test(t) ? -1 : 1);
    return { v, dec: x[2] ? x[2].length - 1 : 0, cash: t.includes("$"), unit: (t.match(/[KMBT%]\)?$/)?.[0] ?? "").replace(")", "") };
  };
  const a = read(m.a);
  const f = read(m.f);
  if (!a || !f || a.unit !== f.unit) return null;
  const dec = Math.max(a.dec, f.dec);
  const d = Number((a.v - f.v).toFixed(dec));
  const sign = d > 0 ? "+" : d < 0 ? "−" : "±";
  return `${sign}${f.cash ? "$" : ""}${Math.abs(d).toFixed(dec)}${f.unit === "%" ? "%p" : f.unit}`;
}

/** 발표 시각이 지났는데 값이 아직일 때 */
export const waitText = (r: Release) => (r.group === "earn" ? "발표됨 · 결과 집계 중" : "발표 직후 · 집계 중");

/** 발표의 때 표시(실적은 아침·밤) */
export const relWhen = (r: Release, now: number) => whenLabel(r.at, now, r.whenText);

export const dayLabel = (d: string) => {
  const k = new Date(`${d}T00:00:00Z`);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일(${WD[k.getUTCDay()]})`;
};

export const VERDICT: Record<Verdict, string> = { beat: "예상 상회", match: "예상 부합", miss: "예상 하회" };

/** 실적 발표의 한국 시각 날짜: 장 마감 뒤 발표는 다음 날 아침 */
export function earningKst(e: Earning) {
  const d = e.when === "after" ? new Date(Date.parse(`${e.date}T00:00:00Z`) + DAY).toISOString().slice(0, 10) : e.date;
  return { date: d, when: e.when === "after" ? "아침" : e.when === "pre" ? "밤" : "" };
}

/** 주당순이익 $ 표기(음수는 -$0.12) */
export const usd = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;

/**
 * 주목 기업 실적 → 발표(띠·발표 목록에 CPI처럼). 시각이 정해져 있지 않아 장 뒤 발표는 미국 16:00(한국 다음 날 아침),
 * 장 전 발표는 미국 07:00(한국 밤)으로 두고 화면에는 '아침'·'밤'만 적는다. 시점을 모르면 장 뒤로 본다.
 */
export function earnReleases(list: Earning[] | null | undefined): Release[] {
  return (list ?? [])
    .filter((e) => EARN_FOCUS.has(e.symbol))
    .map((e) => ({
      id: `earn-${e.symbol}-${e.date}`,
      group: "earn",
      sym: e.symbol,
      name: `${tickerName(e)} 실적`,
      emoji: "💼",
      band: true,
      at: Date.parse(`${e.date}T${e.when === "pre" ? "07" : "16"}:00:00-05:00`),
      whenText: e.when === "pre" ? "밤" : e.when === "after" ? "아침" : "",
      metrics: [
        {
          label: "주당순이익(EPS)",
          a: e.a != null ? usd(e.a) : "",
          f: e.f != null ? usd(e.f) : "",
          p: e.ly != null ? usd(e.ly) : "",
          av: e.a,
          fv: e.f,
          pv: e.ly,
          verdict: epsVerdict(e),
          pLabel: "1년 전",
        },
      ],
      out: e.a != null,
    }));
}

/** 바탕 실적에 실시간 실적을 덮는다(같은 종목·날짜는 실시간 값, 이름·장 전/뒤·예상은 아는 쪽) */
export function mergeEarnings(base: Earning[] | null | undefined, live: Earning[] | null | undefined) {
  const out = new Map<string, Earning>();
  for (const e of base ?? []) out.set(`${e.symbol}-${e.date}`, e);
  for (const e of live ?? []) {
    const k = `${e.symbol}-${e.date}`;
    const b = out.get(k);
    out.set(k, b ? { ...b, ...e, name: b.name, when: e.when || b.when, f: e.f ?? b.f, ly: e.ly ?? b.ly, capB: e.capB ?? b.capB } : e);
  }
  return [...out.values()];
}

export function epsVerdict(e: Earning): Verdict | null {
  if (e.a == null || e.f == null) return null;
  const d = Math.round(e.a * 100) - Math.round(e.f * 100);
  return d === 0 ? "match" : d > 0 ? "beat" : "miss";
}

/** 점도표 해마다 중간값(위원 수 기준) */
export function dotMedians(d: Dots) {
  return d.years.map((_, i) => {
    const xs: number[] = [];
    for (const r of d.rows) for (let k = 0; k < r.n[i]; k++) xs.push(r.rate);
    xs.sort((a, b) => a - b);
    if (!xs.length) return null;
    const m = xs.length >> 1;
    return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
  });
}

/** 막대 자: 0 기준선 위치(위에서 %)와 값마다 막대 길이(%). 모두 양수면 기준선이 바닥, 모두 음수면 꼭대기 */
export function barScale(vs: (number | null)[]) {
  const xs = vs.filter((v): v is number => v != null && Number.isFinite(v));
  const hi = Math.max(0, ...xs);
  const lo = Math.max(0, ...xs.map((v) => -v));
  const span = hi + lo;
  const zero = span ? (hi / span) * 100 : 100;
  const h = (v: number | null) => (v == null || !span || v === 0 ? 0 : Math.max((Math.abs(v) / span) * 100, 2));
  return { zero, hi, lo, h };
}

/** '코어위브(CRWV)'처럼 이름 옆 괄호에 티커(2026-11-11 SK). 한글 이름이 없으면 티커만 */
export const tickerName = (e: { name: string; symbol: string }) => (e.name && e.name !== e.symbol ? `${e.name}(${e.symbol})` : e.symbol);
