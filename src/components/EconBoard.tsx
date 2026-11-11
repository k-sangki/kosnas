"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  bandPick,
  barScale,
  tickerName,
  recentResults,
  RESULT_HOLD,
  dayLabel,
  diffText,
  dotMedians,
  earningKst,
  epsVerdict,
  kstDate,
  VERDICT,
  TONE,
  EARN_FOCUS,
  grace,
  itemHref,
  relWhen,
  waitText,
  usd,
  whenLabel,
  type Dots,
  type Earning,
  type Metric,
  type Release,
  type Verdict,
} from "@/lib/econ";
import { CaptureArea } from "./CaptureArea";
import { useEcon } from "./useEcon";

const DAY = 86_400_000;
/** 다가오는 발표는 1주일 안만(2026-11-11 SK) */
const AHEAD = 7 * DAY;
const BACK = 14 * DAY;

/** 경제지표 예상치·결과 화면 */
export function EconBoard() {
  const { now, list, earnings, data } = useEcon();

  // 띠에서 눌러 들어오면(#발표id) 그 카드로 내려간다
  const ready = now > 0;
  useEffect(() => {
    if (!ready || !location.hash) return;
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    // 접힌 다가오는 발표면 펼쳐서 보여 준다
    el?.closest("details")?.setAttribute("open", "");
    el?.scrollIntoView({ block: "start" });
  }, [ready]);

  if (!now) return <section className="card muted">불러오는 중…</section>;
  // 하루 안에 나온 결과는 모두 맨 위에 펼쳐 둔다(어젯밤 CPI를 아침에도). 없으면 다음 발표 하나
  const recent = recentResults(list, now);
  const next = recent.length ? null : bandPick(list, now)?.r;
  const topIds = new Set([...recent, ...(next ? [next] : [])].map((r) => r.id));
  // 발표 시각이 지났는데 실제 값이 아직인 것(실적은 달력 반영이 반나절쯤 늦다)은 '다가오는'이 아니라 따로 위에
  const pending = list.filter((r) => r.band && !r.out && r.at <= now && now - r.at < grace(r) && !topIds.has(r.id));
  const upcoming = list.filter((r) => !r.out && r.at > now && r.at < now + AHEAD && !topIds.has(r.id));
  const past = list.filter((r) => r.at <= now && now - r.at < BACK && (r.out || !r.band) && !topIds.has(r.id)).reverse();
  const byDay = new Map<string, Release[]>();
  for (const r of upcoming) byDay.set(kstDate(r.at), [...(byDay.get(kstDate(r.at)) ?? []), r]);

  return (
    <>
      {recent.length > 0 && (
        // 결과만 이미지로(다가오는 발표는 빼고, 2026-11-11 SK). 버튼은 오른쪽 아래에 작게
        <CaptureArea
          name="econ"
          heading="경제지표 · 실적 결과"
          title="경제지표 결과"
          url="https://kosnas.com/econ"
          foot="시장 예상치 대비 실제 값"
          corner
        >
          <section className="card econ-top">
            <p className="econ-kicker">최근 결과 · 하루 동안</p>
            {recent.map((r) => (
              <ReleaseCard key={r.id} r={r} now={now} dots={data.dots} big />
            ))}
          </section>
        </CaptureArea>
      )}
      {next && (
        <section className="card econ-top">
          <p className="econ-kicker">{next.at <= now ? "방금 발표됨" : "다음 발표"}</p>
          <ReleaseCard r={next} now={now} dots={data.dots} big />
        </section>
      )}

      {pending.length > 0 && (
        <section className="card">
          <h2 className="card-title">발표됨 · 결과 집계 중</h2>
          {pending.map((r) => (
            <ReleaseCard key={r.id} r={r} now={now} dots={null} />
          ))}
        </section>
      )}

      <section className="card">
        <h2 className="card-title">다가오는 발표</h2>
        {byDay.size === 0 && <p className="muted">앞으로 1주일 안에 잡힌 발표가 없습니다.</p>}
        {[...byDay].map(([d, rs]) => (
          <div key={d} className="econ-day">
            <h3 className="econ-date">{dayLabel(d)}</h3>
            {rs.map((r) =>
              r.band ? <UpFold key={r.id} r={r} now={now} dots={data.dots} /> : <MinorLine key={r.id} r={r} now={now} />,
            )}
          </div>
        ))}
      </section>

      {earnings.length > 0 && <EarningsCard list={earnings.filter((e) => !EARN_FOCUS.has(e.symbol))} now={now} />}

      {past.length > 0 && (
        <section className="card">
          <h2 className="card-title">지난 2주 결과</h2>
          <details className="fold">
            <summary>
              <span>
                발표 <b>{past.filter((r) => r.band).length}건</b> · 상회 <b>{count(past, "beat")}</b> · 부합 <b>{count(past, "match")}</b> · 하회{" "}
                <b>{count(past, "miss")}</b>
              </span>
            </summary>
            <div className="fold-body">
              {past.map((r) => (r.band ? <ReleaseCard key={r.id} r={r} now={now} dots={null} /> : <MinorLine key={r.id} r={r} now={now} />))}
            </div>
          </details>
        </section>
      )}
    </>
  );
}

/**
 * 지표·기업 페이지(/econ/cpi, /econ/earnings/crwv)의 실시간 카드: 가장 최근 결과와 다음 발표(막대).
 * 발표 직후 값은 /api/econ 으로 바로 채운다. 지난 결과 표·설명은 페이지(서버)가 그린다.
 */
export function EconItem({ group, sym }: { group?: string; sym?: string }) {
  const { now, list, data } = useEcon();
  if (!now) return <section className="card muted">불러오는 중…</section>;
  const mine = list.filter((r) => (sym ? r.sym === sym : r.group === group));
  const last = [...mine].reverse().find((r) => r.out && r.at <= now);
  const next = mine.find((r) => !r.out && r.at > now - grace(r));
  const fresh = last && now - last.at < RESULT_HOLD;
  const lastCard = last && (
    <section className="card econ-top" key="last">
      <p className="econ-kicker">{fresh ? "방금 나온 결과" : "가장 최근 결과"}</p>
      <ReleaseCard r={last} now={now} dots={data.dots} big self />
    </section>
  );
  const nextCard = next && (
    <section className="card econ-top" key="next">
      <p className="econ-kicker">{next.at <= now ? "발표됨 · 결과 집계 중" : "다음 발표"}</p>
      <ReleaseCard r={next} now={now} dots={data.dots} big self />
    </section>
  );
  return <>{fresh ? [lastCard, nextCard] : [nextCard, lastCard]}</>;
}

/** 지난 발표 중 첫 지표가 그 판정인 수 */
const count = (rs: Release[], v: Verdict) => rs.filter((r) => r.band && r.out && r.metrics[0]?.verdict === v).length;

/** 다가오는 발표 한 건: 제목·시각만 보이고 눌러야 예상치 막대가 펼쳐진다(기본 접힘, 2026-11-11 SK) */
function UpFold({ r, now, dots }: { r: Release; now: number; dots: Dots | null }) {
  return (
    <details className="fold econ-up">
      <summary>
        <span className="econ-up-name">
          <span aria-hidden>{r.emoji}</span> {r.name}
        </span>
        <span className="econ-up-when">{relWhen(r, now)}</span>
      </summary>
      <ReleaseCard r={r} now={now} dots={dots} />
    </details>
  );
}

function MinorLine({ r, now }: { r: Release; now: number }) {
  return (
    <p className="econ-minor" id={r.id}>
      <span aria-hidden>{r.emoji}</span> <b>{whenLabel(r.at, now)}</b> {r.group === "speech" ? r.metrics[0]?.label : r.name}
    </p>
  );
}

function Badge({ v }: { v: Verdict | null }) {
  if (!v) return null;
  return <b className={`ev-v ${v}`}>{v === "beat" ? "▲ " : v === "miss" ? "▼ " : "= "}{VERDICT[v]}</b>;
}

function ReleaseCard({ r, now, dots, big, self }: { r: Release; now: number; dots: Dots | null; big?: boolean; self?: boolean }) {
  const waiting = !r.out && r.at <= now;
  // 이름을 누르면 그 지표·기업 페이지(지난 결과·설명). 그 페이지 안에서는 링크 없이
  const href = self ? null : itemHref(r);
  return (
    <article className={`econ-rel${big ? " big" : ""}${r.out ? " out" : ""}`} id={r.id}>
      <header className="econ-rel-head">
        <span className="econ-rel-name">
          <span aria-hidden>{r.emoji}</span>{" "}
          {href ? (
            <Link href={href} className="econ-rel-link">
              {r.name}
            </Link>
          ) : (
            r.name
          )}
        </span>
        <span className="econ-rel-when">{waiting ? waitText(r) : relWhen(r, now)}</span>
      </header>
      {waiting && r.sym && (
        <p className="econ-wait muted">
          실적 달력에 실제 EPS가 아직 없습니다(보통 반나절 안에 들어옵니다).{" "}
          <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${r.sym}&type=8-K`} target="_blank" rel="noopener noreferrer">
            회사 보도자료 보기(미국 공시)
          </a>
        </p>
      )}
      {r.metrics.map((m, i) => (
        <MetricRow key={i} m={m} out={r.out} lead={i === 0} big={big && i === 0} />
      ))}
      {r.group === "fomc" && dots && <DotPlot d={dots} now={r.metrics[0]?.pv ?? null} />}
    </article>
  );
}

/**
 * 직전·예상·실제 세로 막대(시안 ①, 2026-11-11 SK 채택). 0이 기준선이고 음수는 그 아래로 내려 그린다
 * (코어위브 EPS −1.27처럼 손실이 줄면 막대가 짧아진다).
 */
function MetricRow({ m, out, lead, big }: { m: Metric; out: boolean; lead: boolean; big?: boolean }) {
  const has = out && m.av != null;
  const gap = has ? diffText(m) : null;
  const cols: { k: string; label: string; s: string; v: number | null }[] = [
    { k: "pv", label: m.pLabel ?? "직전", s: m.p, v: m.pv },
    { k: "fc", label: "예상", s: m.f, v: m.fv },
    { k: `act ${has ? (m.verdict ?? "") : "wait"}`, label: "실제", s: has ? m.a : "?", v: has ? m.av : null },
  ];
  const { zero, hi, lo, h } = barScale(cols.map((c) => c.v));
  return (
    <div className={`ev-m${lead ? " lead" : ""}`}>
      <div className="ev-m-head">
        <span className="ev-m-label">{m.label}</span>
        {has && (
          <span className="ev-m-verdict">
            <Badge v={m.verdict} />
            {gap && <b className={`ev-gap-t ${m.verdict ?? ""}`}> {gap}</b>}
            {m.tone != null && <small className={`ev-tone t${m.tone}`}>{TONE[m.tone]}</small>}
          </span>
        )}
      </div>
      <div
        className={`ev-bars${big ? " big" : ""}${hi ? " ev-pos" : ""}${lo ? " ev-neg" : ""}`}
        role="img"
        aria-label={`${m.pLabel ?? "직전"} ${m.p || "없음"}, 예상 ${m.f || "없음"}${has ? `, 실제 ${m.a}` : ""}`}
      >
        <div className="ev-plot">
          <i className="ev-zero" style={{ top: `${zero}%` }} />
          {cols.map((c) => {
            // 값이 아직 없는 '실제'(?)도 모두 음수인 그림에서는 기준선 아래에 둔다
            const neg = c.v != null ? c.v < 0 : !hi && lo > 0;
            const len = h(c.v);
            return (
              <div key={c.label} className={`ev-col ${c.k}`}>
                <span
                  className={`ev-col-b${neg ? " neg" : ""}`}
                  style={neg ? { top: `${zero}%`, height: `${len}%` } : { bottom: `${100 - zero}%`, height: `${len}%` }}
                />
                <span
                  className="ev-col-v"
                  style={neg ? { top: `calc(${zero + len}% + 3px)` } : { bottom: `calc(${100 - zero + len}% + 3px)` }}
                >
                  {c.s || "—"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="ev-labels">
          {cols.map((c) => (
            <small key={c.label} className="ev-col-l">
              {c.label}
            </small>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 점도표: 해마다 위원 한 명 = 점 하나(연말 정책금리 전망, 범위 중간값) */
function DotPlot({ d, now }: { d: Dots; now: number | null }) {
  const used = d.rows.filter((r) => r.n.some((k) => k > 0));
  if (!used.length) return null;
  const rates = used.map((r) => r.rate);
  const top = Math.max(...rates, now ?? 0) + 0.125;
  const bot = Math.min(...rates) - 0.125;
  const W = 320;
  const H = 200;
  const L = 34;
  const colW = (W - L) / d.years.length;
  const y = (v: number) => 10 + ((top - v) / (top - bot)) * (H - 34);
  const med = dotMedians(d);
  // 지금 금리 = 범위 상단 - 0.125(가운데)
  const cur = now != null ? now - 0.125 : null;
  const ticks: number[] = [];
  for (let v = Math.ceil(bot * 2) / 2; v <= top; v += 0.5) ticks.push(v);
  return (
    <figure className="dotplot">
      <figcaption>
        <b>점도표</b> <span className="muted">· 연준 위원들이 본 연말 기준금리({d.date.slice(0, 4)}년 {Number(d.date.slice(5, 7))}월 발표)</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="연준 점도표">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W} y1={y(v)} y2={y(v)} className="dp-grid" />
            <text x={L - 4} y={y(v) + 3} className="dp-axis" textAnchor="end">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {cur != null && (
          <g>
            <line x1={L} x2={W} y1={y(cur)} y2={y(cur)} className="dp-now" />
            <text x={W - 2} y={y(cur) - 3} className="dp-now-t" textAnchor="end">
              지금 {cur.toFixed(2)}%
            </text>
          </g>
        )}
        {d.years.map((yr, i) => {
          const cx = L + colW * i + colW / 2;
          return (
            <g key={yr}>
              {used.map((r) =>
                Array.from({ length: r.n[i] }, (_, k) => {
                  const off = (k - (r.n[i] - 1) / 2) * 7;
                  return <circle key={`${r.rate}-${k}`} cx={cx + off} cy={y(r.rate)} r={2.8} className="dp-dot" />;
                }),
              )}
              {med[i] != null && <line x1={cx - colW / 2 + 6} x2={cx + colW / 2 - 6} y1={y(med[i]!)} y2={y(med[i]!)} className="dp-med" />}
              <text x={cx} y={H - 6} className="dp-axis" textAnchor="middle">
                {yr}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="muted dp-note">
        점 하나가 위원 한 명입니다. 빨간 선은 중간값
        {med[0] != null && ` (올해 말 ${med[0]!.toFixed(2)}%)`}. 점도표는 3·6·9·12월 회의 때만 새로 나옵니다.
      </p>
    </figure>
  );
}

function EarningsCard({ list, now }: { list: Earning[]; now: number }) {
  const today = kstDate(now);
  const rows = list
    .map((e) => ({ e, k: earningKst(e) }))
    .filter(({ k }) => Math.abs(Date.parse(`${k.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) <= 8 * DAY)
    .sort((a, b) => (a.k.date === b.k.date ? (b.e.capB ?? 0) - (a.e.capB ?? 0) : a.k.date < b.k.date ? -1 : 1));
  if (!rows.length) return null;
  const done = rows.filter(({ e }) => e.a != null);
  const next = rows.filter(({ e }) => e.a == null);
  return (
    <section className="card econ-earn" id="earnings">
      <h2 className="card-title">💼 그 밖의 기업 실적 <span className="muted">· 주당순이익(EPS) 예상과 결과</span></h2>
      <details className="fold">
        <summary>
          <span>
            다가오는 실적 <b>{next.length}곳</b> · 지난 일주일 결과 <b>{done.length}곳</b>
          </span>
        </summary>
        <div className="fold-body">
          {next.length > 0 && <h3 className="econ-date">다가오는 실적</h3>}
          {next.map(({ e, k }) => (
            <div key={`${e.symbol}-${e.date}`} className="ev-earn">
              <span className="ev-earn-name">
                {tickerName(e)}
                <small className="muted"> {k.date.slice(5).replace("-", "/")} {k.when}</small>
              </span>
              <span className="ev-earn-num">
                예상 <b>{e.f != null ? usd(e.f) : "—"}</b>
                {e.ly != null && <small className="muted"> · 1년 전 {usd(e.ly)}</small>}
              </span>
            </div>
          ))}
          {done.length > 0 && <h3 className="econ-date">지난 일주일 결과</h3>}
          {done.reverse().map(({ e, k }) => {
            const v = epsVerdict(e);
            return (
              <div key={`${e.symbol}-${e.date}`} className="ev-earn">
                <span className="ev-earn-name">
                  {tickerName(e)}
                  <small className="muted"> {k.date.slice(5).replace("-", "/")}</small>
                </span>
                <span className="ev-earn-num">
                  실제 <b>{usd(e.a!)}</b>
                  <small className="muted"> · 예상 {e.f != null ? usd(e.f) : "—"}</small> <Badge v={v} />
                  {e.s != null && <small className={`ev-surp ${v ?? ""}`}> {e.s > 0 ? "+" : ""}{e.s.toFixed(1)}%</small>}
                </span>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
