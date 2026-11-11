"use client";

import { useEffect } from "react";
import {
  bandPick,
  dayLabel,
  dotMedians,
  earningKst,
  epsVerdict,
  kstDate,
  VERDICT,
  EARN_FOCUS,
  grace,
  relWhen,
  usd,
  whenLabel,
  type Dots,
  type Earning,
  type Metric,
  type Release,
  type Verdict,
} from "@/lib/econ";
import { useEcon } from "./useEcon";

const DAY = 86_400_000;
const AHEAD = 15 * DAY;
const BACK = 14 * DAY;

/** 경제지표 예상치·결과 화면 */
export function EconBoard() {
  const { now, list, earnings, data } = useEcon();

  // 띠에서 눌러 들어오면(#발표id) 그 카드로 내려간다
  const ready = now > 0;
  useEffect(() => {
    if (!ready || !location.hash) return;
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ block: "start" });
  }, [ready]);

  if (!now) return <section className="card muted">불러오는 중…</section>;
  const top = bandPick(list, now);
  const upcoming = list.filter((r) => !r.out && r.at > now - grace(r) && r.at < now + AHEAD && r.id !== top?.r.id);
  const past = list.filter((r) => r.at <= now && now - r.at < BACK && (r.out || !r.band) && r.id !== top?.r.id).reverse();
  const byDay = new Map<string, Release[]>();
  for (const r of upcoming) byDay.set(kstDate(r.at), [...(byDay.get(kstDate(r.at)) ?? []), r]);

  return (
    <>
      {top && (
        <section className="card econ-top">
          <p className="econ-kicker">{top.mode === "result" ? "방금 나온 결과" : "다음 발표"}</p>
          <ReleaseCard r={top.r} now={now} dots={data.dots} big />
        </section>
      )}

      <section className="card">
        <h2 className="card-title">다가오는 발표</h2>
        {byDay.size === 0 && <p className="muted">앞으로 2주 안에 잡힌 발표가 없습니다.</p>}
        {[...byDay].map(([d, rs]) => (
          <div key={d} className="econ-day">
            <h3 className="econ-date">{dayLabel(d)}</h3>
            {rs.map((r) =>
              r.band ? <ReleaseCard key={r.id} r={r} now={now} dots={data.dots} /> : <MinorLine key={r.id} r={r} now={now} />,
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

/** 지난 발표 중 첫 지표가 그 판정인 수 */
const count = (rs: Release[], v: Verdict) => rs.filter((r) => r.band && r.out && r.metrics[0]?.verdict === v).length;

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

function ReleaseCard({ r, now, dots, big }: { r: Release; now: number; dots: Dots | null; big?: boolean }) {
  const waiting = !r.out && r.at <= now;
  return (
    <article className={`econ-rel${big ? " big" : ""}${r.out ? " out" : ""}`} id={r.id}>
      <header className="econ-rel-head">
        <span className="econ-rel-name">
          <span aria-hidden>{r.emoji}</span> {r.name}
        </span>
        <span className="econ-rel-when">{waiting ? "발표 직후 · 집계 중" : relWhen(r, now)}</span>
      </header>
      {r.metrics.map((m, i) => (
        <MetricRow key={i} m={m} out={r.out} lead={i === 0} />
      ))}
      {r.group === "fomc" && dots && <DotPlot d={dots} now={r.metrics[0]?.pv ?? null} />}
    </article>
  );
}

/** 예상·실제·직전 숫자와 한 줄 수직선(어디에 떨어졌는지) */
function MetricRow({ m, out, lead }: { m: Metric; out: boolean; lead: boolean }) {
  const has = out && m.av != null;
  return (
    <div className={`ev-m${lead ? " lead" : ""}`}>
      <div className="ev-m-head">
        <span className="ev-m-label">{m.label}</span>
        {has && <Badge v={m.verdict} />}
      </div>
      <div className="ev-nums">
        {has && (
          <span className={`ev-num act ${m.verdict ?? ""}`}>
            <small>실제</small>
            <b>{m.a}</b>
          </span>
        )}
        <span className="ev-num fc">
          <small>예상</small>
          <b>{m.f || "—"}</b>
        </span>
        <span className="ev-num pv">
          <small>{m.pLabel ?? "직전"}</small>
          <b>{m.p || "—"}</b>
        </span>
      </div>
      <NumberLine m={m} out={has} />
    </div>
  );
}

function NumberLine({ m, out }: { m: Metric; out: boolean }) {
  const pts = [m.pv, m.fv, out ? m.av : null].filter((v): v is number => v != null);
  if (pts.length < 2) return null;
  let lo = Math.min(...pts);
  let hi = Math.max(...pts);
  const pad = Math.max((hi - lo) * 0.3, Math.abs(hi) * 0.02, 1e-9);
  lo -= pad;
  hi += pad;
  const x = (v: number) => 12 + ((v - lo) / (hi - lo)) * 276;
  const W = 300;
  return (
    <svg className="ev-line" viewBox={`0 0 ${W} 26`} role="img" aria-label={`${m.pLabel ?? "직전"} ${m.p}, 예상 ${m.f}${out ? `, 실제 ${m.a}` : ""}`}>
      <line x1={8} x2={W - 8} y1={13} y2={13} className="ev-track" />
      {m.pv != null && <circle cx={x(m.pv)} cy={13} r={5} className="ev-pv" />}
      {m.fv != null && <rect x={x(m.fv) - 1.5} y={3} width={3} height={20} className="ev-fc" />}
      {out && m.fv != null && m.av != null && <line x1={x(m.fv)} x2={x(m.av)} y1={13} y2={13} className={`ev-gap ${m.verdict ?? ""}`} />}
      {out && m.av != null && <circle cx={x(m.av)} cy={13} r={7} className={`ev-act ${m.verdict ?? ""}`} />}
    </svg>
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
                {e.name}
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
                  {e.name}
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
