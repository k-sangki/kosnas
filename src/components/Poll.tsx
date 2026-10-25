"use client";

import { useCallback, useEffect, useState } from "react";
import { hitRate, majority, outcome, type PollState, type Side } from "@/lib/poll";

/**
 * 첫 화면 '오늘의 한 표'. 버튼 두 개만 보이고, 누른 뒤에야 비율을 보인다(먼저 보면 따라 누르기 쉽다).
 * 투표자 번호와 내가 누른 쪽은 이 브라우저에만 저장한다. 캡처에는 들어가지 않는다.
 */
const VOTER_KEY = "kosnas:poll:voter";
const MINE_KEY = "kosnas:poll:mine";

function voterId() {
  try {
    let v = localStorage.getItem(VOTER_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VOTER_KEY, v);
    }
    return v;
  } catch {
    return null;
  }
}

function loadMine(): Record<string, Side> {
  try {
    return JSON.parse(localStorage.getItem(MINE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function saveMine(target: string, side: Side) {
  try {
    const m = loadMine();
    m[target] = side;
    // 오래된 회차는 60개만 남긴다
    const keep = Object.keys(m).sort().slice(-60);
    localStorage.setItem(MINE_KEY, JSON.stringify(Object.fromEntries(keep.map((k) => [k, m[k]]))));
  } catch {}
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
function dayLabel(target: string) {
  const d = new Date(`${target}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WD[d.getUTCDay()]})`;
}

const pctOf = (a: number, b: number) => (a + b ? Math.round((a / (a + b)) * 100) : 0);

export function Poll() {
  const [s, setS] = useState<PollState | null>(null);
  const [mine, setMine] = useState<Record<string, Side>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const v = voterId();
    const r = await fetch(`/api/poll${v ? `?voter=${v}` : ""}`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setS(await r.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장값은 화면이 뜬 뒤에만 읽을 수 있다
    setMine(loadMine());
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 120_000);
    return () => clearInterval(t);
  }, [load]);

  if (!s) return null;
  const r = s.round;
  const my = r.mine ?? mine[r.target] ?? null;
  const shown = my != null || !r.open;
  const total = r.up + r.down;

  const vote = async (side: Side) => {
    const voter = voterId();
    if (!voter || busy || !r.open) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/poll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voter, side }),
    }).catch(() => null);
    setBusy(false);
    if (!res) return setErr("연결이 끊겼어요. 잠시 뒤 다시 눌러 주세요.");
    const body = await res.json().catch(() => null);
    if (!res.ok) return setErr(body?.error ?? "투표하지 못했어요.");
    setS(body);
    saveMine(r.target, side);
    setMine(loadMine());
  };

  const last = s.past[0];
  const lastOut = last && outcome(last.pct);
  const crowd = hitRate(s.past);
  let myN = 0;
  let myHit = 0;
  for (const p of s.past) {
    const o = outcome(p.pct);
    if (!o || !mine[p.target]) continue;
    myN++;
    if (mine[p.target] === o) myHit++;
  }

  return (
    <section className="card poll no-capture" aria-label="오늘의 한 표">
      <h2 className="card-title">다음 장 코스피, 오를까 내릴까?</h2>
      <p className="muted poll-when">
        {dayLabel(r.target)} 장 · {r.open ? "09:00 투표 마감" : "투표 마감 · 15:45 장 끝나면 결과"}
      </p>
      <div className="poll-btns">
        {(["up", "down"] as const).map((side) => (
          <button
            key={side}
            type="button"
            className={`poll-btn ${side}${my === side ? " on" : ""}`}
            disabled={!r.open || busy}
            onClick={() => vote(side)}
            aria-pressed={my === side}
          >
            {side === "up" ? "▲ 오른다" : "▼ 내린다"}
          </button>
        ))}
      </div>
      {shown && (
        <div className="poll-result">
          <div className="poll-bar" aria-hidden>
            <i className="up-fill" style={{ width: `${total ? pctOf(r.up, r.down) : 50}%` }} />
          </div>
          <p className="poll-share">
            <span className="up">오른다 {pctOf(r.up, r.down)}%</span>
            <span className="down">내린다 {total ? 100 - pctOf(r.up, r.down) : 0}%</span>
          </p>
          {r.open && <p className="muted small-note">마감 전에는 다른 쪽을 눌러 바꿀 수 있어요.</p>}
        </div>
      )}
      {err && <p className="notice poll-err">{err}</p>}
      {last && (
        <p className="poll-last">
          {dayLabel(last.target)} 결과{" "}
          {lastOut ? (
            <b className={lastOut}>
              {lastOut === "up" ? "▲ 상승" : "▼ 하락"} {last.pct! > 0 ? "+" : ""}
              {last.pct!.toFixed(2)}%
            </b>
          ) : (
            <b>{last.pct == null ? "판정 못 함" : "보합"}</b>
          )}
          {last.up + last.down > 0 && (
            <>
              {" "}
              · &apos;{majority(last.up, last.down) === "down" ? "내린다" : "오른다"}&apos;{" "}
              {majority(last.up, last.down) === "down" ? 100 - pctOf(last.up, last.down) : pctOf(last.up, last.down)}%
              {lastOut && majority(last.up, last.down) && (majority(last.up, last.down) === lastOut ? " · 다수 적중" : " · 다수 빗나감")}
            </>
          )}
        </p>
      )}
      <p className="muted small-note">
        {crowd.n > 0 && `다수 적중 ${crowd.hit}/${crowd.n}회 · `}
        {myN > 0 && `내 적중 ${myHit}/${myN}회 · `}
        판정은 코스피200 무기한선물의 전 거래일 대비 15:45 가격. 재미로 하는 투표예요.
      </p>
    </section>
  );
}
