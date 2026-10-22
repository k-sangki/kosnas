"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Industry, SectorData } from "@/lib/sectors";

// neoScreen 시장 탭의 '섹터 흐름' 표와 같은 구성: 기간별 강도 색칸(5·10·20·30·60일),
// 20일 강도의 매일 추이 미니 그래프, 5거래일 전 대비 순위 변화, 맨 위에는 순위가 크게 바뀐 섹터만.
const PERIODS = ["5", "10", "20", "30", "60"];
const BASE = "20";
const AGO = 5;
/** 처음에 보이는 줄 수. 그 아래는 '더보기'로 펼치고, 캡처 이미지에는 넣지 않는다 */
const TOP = 15;

interface Row {
  id: string;
  name: string;
  x: Record<string, number | null>;
  /** 순위·변화 계산용 20일 강도 추이 */
  path: number[];
  /** 기간별 강도의 매일 추이(미니 그래프는 고른 기간을 따른다) */
  paths: Record<string, number[]>;
  nowRank?: number;
  oldRank?: number;
  chg: number | null;
}

function ranked(rows: Row[]): Row[] {
  const rank = (key: "now" | "old") => {
    const val = (r: Row) => (key === "now" ? r.path.at(-1) : r.path.length > AGO ? r.path.at(-1 - AGO) : undefined);
    rows
      .filter((r) => val(r) != null)
      .sort((a, b) => val(b)! - val(a)!)
      .forEach((r, i) => {
        if (key === "now") r.nowRank = i + 1;
        else r.oldRank = i + 1;
      });
  };
  rank("now");
  rank("old");
  for (const r of rows) r.chg = r.nowRank && r.oldRank ? r.oldRank - r.nowRank : null;
  return rows;
}

function pathsOf(path: Record<string, number[][]> | undefined): Record<string, number[]> {
  return Object.fromEntries(PERIODS.map((p) => [p, (path?.[p] ?? []).map((v) => v[0])]));
}

function stats(data: SectorData): Row[] {
  return ranked(
    data.sectors.map((s) => ({
      id: s.id,
      name: s.name,
      x: s.x,
      path: (s.path?.[BASE] ?? []).map((p) => p[0]),
      paths: pathsOf(s.path),
      chg: null,
    })),
  );
}

/** 산업 줄: 순위 변화는 전체 산업 안에서 센다 */
function industryRows(list: Industry[]): Map<string, (Row & { sector: string; count: number })[]> {
  const rows = list.map((i) => ({
    id: i.id,
    name: i.name,
    x: i.x,
    path: (i.path?.[BASE] ?? []).map((p) => p[0]),
    paths: pathsOf(i.path),
    chg: null,
    sector: i.sector,
    count: i.count ?? 0,
  }));
  ranked(rows);
  const by = new Map<string, typeof rows>();
  for (const r of rows) by.set(r.sector, [...(by.get(r.sector) ?? []), r]);
  // 한 칸뿐이거나 '기타'만 있으면 펼칠 것이 없다
  for (const [k, v] of by) if (v.length < 2) by.delete(k);
  return by;
}

function Spark({ path }: { path: number[] }) {
  if (path.length < 2) return <span />;
  const W = 44;
  const H = 20;
  const m = Math.max(4, ...path.map(Math.abs));
  const x = (i: number) => 2 + (i * (W - 4)) / (path.length - 1);
  const y = (v: number) => H / 2 - (v / m) * (H / 2 - 2);
  const up = path.at(-1)! >= path[0];
  return (
    <svg className={`ft-spark ${up ? "up" : "down"}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="ft-zero" />
      <polyline points={path.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />
      <circle cx={x(path.length - 1)} cy={y(path.at(-1)!)} r={2.2} />
    </svg>
  );
}

function Heat({ v }: { v: number | null | undefined }) {
  if (v == null) return <span className="heat">-</span>;
  const a = Math.abs(v);
  const step = a >= 10 ? 3 : a >= 5 ? 2 : a >= 2 ? 1 : 0;
  return <span className={`heat${step ? ` ${v > 0 ? "u" : "d"}${step}` : ""}`}>{`${v > 0 ? "+" : ""}${Math.round(v)}`}</span>;
}

function Chg({ c }: { c: number | null }) {
  if (!c) return <span className="ft-chg">-</span>;
  return <span className={`ft-chg ${c > 0 ? "up" : "down"}`}>{`${c > 0 ? "▲" : "▼"}${Math.abs(c)}`}</span>;
}

export function FlowTable({ data }: { data: SectorData }) {
  const [sortBy, setSortBy] = useState(BASE);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const rows = stats(data);
  const kids = industryRows(data.industries ?? []);
  const byX = <T extends Row>(xs: T[]) => [...xs].sort((a, b) => (b.x[sortBy] ?? -1e9) - (a.x[sortBy] ?? -1e9));
  if (!rows.length) return null;
  // 순위가 전체의 1/5 넘게(적어도 3계단) 오르내린 것만 — 날마다 한두 계단 바뀌는 것은 알릴 일이 아니다
  const min = Math.max(3, Math.round(rows.length / 5));
  const moved = rows.filter((r) => r.chg != null && Math.abs(r.chg) >= min);
  const up = moved
    .filter((r) => r.chg! > 0)
    .sort((a, b) => b.chg! - a.chg!)
    .slice(0, 3);
  const down = moved
    .filter((r) => r.chg! < 0)
    .sort((a, b) => a.chg! - b.chg!)
    .slice(0, 3);
  const item = (r: Row) => (
    <span key={r.id} className="ft-item">
      <Link href={`/${data.market}/sector/${r.id}`} className="ft-pick">
        {r.name}
      </Link>{" "}
      <span className="muted">
        {r.oldRank}→{r.nowRank}위
      </span>
    </span>
  );
  const sorted = byX(rows);
  const cells = (r: Row) => (
    <>
      <Spark path={r.paths[sortBy] ?? []} />
      {PERIODS.map((p) => (
        <Heat key={p} v={r.x[p]} />
      ))}
      <Chg c={r.chg} />
    </>
  );

  const row = (r: Row) => {
    const ks = kids.get(r.id);
    if (!ks)
      return (
        <Link key={r.id} href={`/${data.market}/sector/${r.id}`} className="ft-row">
          <span className="ft-name">
            <i className="ft-tri none" />
            {r.name}
          </span>
          {cells(r)}
        </Link>
      );
    const isOpen = open === r.id;
    return (
      <div key={r.id} className={`ft-group${isOpen ? " open" : ""}`}>
        <button className="ft-row" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
          <span className="ft-name">
            <i className="ft-tri" />
            {r.name}
          </span>
          {cells(r)}
        </button>
        {isOpen && (
          <div className="ft-kids">
            {byX(ks).map((k) => (
              <Link key={k.id} href={`/${data.market}/sector/${r.id}#ind-${k.id}`} className="ft-row kid">
                <span className="ft-name">
                  {k.name} <span className="muted">{k.count}</span>
                </span>
                {cells(k)}
              </Link>
            ))}
            <Link href={`/${data.market}/sector/${r.id}`} className="ft-more">
              {r.name} 종목 보기 →
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="card ft-card">
      <h2 className="card-title">섹터 순위</h2>
      <div className="ft-digest">
        <p className="muted">
          달라진 것 · {AGO}거래일 전 대비 {BASE}일 강도 순위
        </p>
        {up.length > 0 && (
          <p>
            <b className="up">▲</b> {up.map(item).reduce<ReactNode[]>((a, n, i) => (i ? [...a, " · ", n] : [n]), [])}
          </p>
        )}
        {down.length > 0 && (
          <p>
            <b className="down">▼</b> {down.map(item).reduce<ReactNode[]>((a, n, i) => (i ? [...a, " · ", n] : [n]), [])}
          </p>
        )}
        {!up.length && !down.length && <p className="muted">순위가 크게 바뀐 섹터가 없습니다.</p>}
      </div>
      <div className="ft-head">
        <span>섹터</span>
        <span>{sortBy}일 추이</span>
        {PERIODS.map((p) => (
          <button key={p} aria-pressed={p === sortBy} onClick={() => setSortBy(p)}>
            {p}일
          </button>
        ))}
        <span>순위</span>
      </div>
      {sorted.slice(0, TOP).map(row)}
      {sorted.length > TOP && (
        <div className="no-capture">
          {all && sorted.slice(TOP).map(row)}
          <button type="button" className="ft-all" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? "접기" : `더보기 · ${TOP + 1}~${sorted.length}위`}
          </button>
        </div>
      )}
    </section>
  );
}

/** 섹터 순위 표 읽는 법. 표와 따로 두어 캡처 이미지에는 들어가지 않는다 */
export function FlowTableNote() {
  return (
    <section className="card">
      <h2 className="card-title">섹터 순위 보는 법</h2>
      <p className="muted small-note">
        색칸은 그 기간 섹터 평균 대비 강도(%p, 빨강 강함 · 파랑 약함)입니다. 짧은 기간(왼쪽)과 긴 기간(오른쪽)을 나란히 보면 흐름이 보입니다. 기간을 누르면 그
        기간 순으로 정렬합니다. 미니 그래프는 고른 기간 강도의 매일 추이, 순위는 {BASE}일 강도 기준 {AGO}거래일 전 대비 변화입니다. ▸가 있는 섹터를 누르면 그
        안의 산업(DART 업종 코드로 나눔, 강도는 산업끼리의 평균 대비)이 펼쳐집니다.
      </p>
    </section>
  );
}
