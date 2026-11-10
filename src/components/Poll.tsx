"use client";

import { useCallback, useEffect, useState } from "react";
import {
  hitRate,
  leanRate,
  majority,
  monthMarks,
  myStreak,
  outcome,
  shareText,
  verdict,
  type PollState,
  type Side,
} from "@/lib/poll";

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
    localStorage.setItem(
      MINE_KEY,
      JSON.stringify(Object.fromEntries(keep.map((k) => [k, m[k]]))),
    );
  } catch {}
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
function dayLabel(target: string) {
  const d = new Date(`${target}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WD[d.getUTCDay()]})`;
}

/**
 * '단톡방에 물어보기'로 보내는 주소. 받은 사람은 첫 화면의 투표 칸으로 바로 내려가고, 미리보기에는 투표 그림이 뜬다.
 * t: 카톡이 같은 주소의 미리보기를 오래 기억하지 않게 5분 단위로 바꾼다
 */
/** '단톡방에 물어보기' 버튼. 일단 감춰 둔다(2026-11-02 SK 결정). 다시 켜려면 true */
const ASK_ENABLED = false;
/** 투표 인원수는 합계가 이만큼 넘어야 보인다 */
const COUNT_MIN = 100;

const askUrl = () =>
  `https://kosnas.com/?utm_source=poll_ask&t=${Math.floor(Date.now() / 300_000).toString(36)}#poll`;

/** 남은 시간: 1시간 넘으면 'N시간 M분', 안쪽이면 'MM:SS' */
function remain(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${String(m).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

const pctOf = (a: number, b: number) =>
  a + b ? Math.round((a / (a + b)) * 100) : 0;

/** weekend: 토요일 06:00 ~ 월요일 09:00에는 제목을 "월요일 코스피"로(2026-11-10 SK) */
export function Poll({ weekend = false }: { weekend?: boolean }) {
  const lead = weekend ? "월요일" : "다음 장";
  const [s, setS] = useState<PollState | null>(null);
  const [mine, setMine] = useState<Record<string, Side>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [now, setNow] = useState(0);
  const [recOpen, setRecOpen] = useState(false);
  const [recNote, setRecNote] = useState("");

  const load = useCallback(async () => {
    const v = voterId();
    const r = await fetch(`/api/poll${v ? `?voter=${v}` : ""}`, {
      cache: "no-store",
    }).catch(() => null);
    if (r?.ok) setS(await r.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 저장값은 화면이 뜬 뒤에만 읽을 수 있다
    setMine(loadMine());
    load();
    const t = setInterval(
      () => document.visibilityState === "visible" && load(),
      120_000,
    );
    return () => clearInterval(t);
  }, [load]);

  // 공유받은 주소(#poll)로 들어오면 투표 칸이 자료를 받은 뒤에 생기므로 그때 한 번 내려간다
  const ready = s != null;
  useEffect(() => {
    if (ready && location.hash === "#poll")
      document.getElementById("poll")?.scrollIntoView({ block: "center" });
  }, [ready]);

  // 마감·결과까지 남은 시간. 1시간 안쪽은 초 단위로, 그 밖은 분 단위로 고친다
  const deadline = s ? (s.round.open ? s.round.closes : s.round.end) : 0;
  useEffect(() => {
    if (!deadline) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      const left = deadline - n;
      // 시각이 지나면 새 상태(마감·판정)를 받는다. 판정은 원천 확정을 기다려 몇 분 늦을 수 있다
      if (left <= 0) {
        t = setTimeout(() => load().then(tick), 60_000);
        return;
      }
      t = setTimeout(
        tick,
        left > 3_600_000
          ? 1000 * (60 - new Date(n).getSeconds())
          : 1000 - (n % 1000),
      );
    };
    tick();
    return () => clearTimeout(t);
  }, [deadline, load]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(""), 1800);
    return () => clearTimeout(t);
  }, [note]);

  if (!s) return null;
  const r = s.round;
  const my = r.mine ?? mine[r.target] ?? null;
  const shown = my != null || !r.open;
  const total = r.up + r.down;
  /** 참여가 적을 때 "9명 / 2명"은 방문자가 적다는 신호라 비율만 보인다(2026-11-10 SK) */
  const counts = total >= COUNT_MIN;
  const left = (r.open ? r.closes : r.end) - now;

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

  // 투표한 사람만, 마감 전에만 보인다. 받은 사람이 같은 질문에 바로 답할 수 있을 때만 묻는다
  const ask = async () => {
    if (!my) return;
    const text = `${dayLabel(r.target)} 코스피, 나는 '${my === "up" ? "오른다" : "내린다"}'에 한 표 했어요. 당신은?`;
    const url = askUrl();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${lead} 코스피, 오를까 내릴까?`,
          text,
          url,
        });
      } catch {
        // 사용자가 취소한 경우
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setNote("링크를 복사했어요. 단톡방에 붙여 넣어 주세요");
    } catch {
      setNote("복사하지 못했어요");
    }
  };

  const streak = myStreak(s.past, mine);
  // 워들식 월간 기록: 내가 마지막으로 누른 끝난 회차의 달
  const month = s.past.find((p) => mine[p.target])?.target.slice(0, 7) ?? null;
  const marks = month ? monthMarks(s.past, mine, month) : [];
  const lean = leanRate(s.past);
  const shareRec = async () => {
    if (!month) return;
    const text = shareText(month, marks, streak);
    const url = "https://kosnas.com/?utm_source=poll_record#poll";
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setRecNote("기록을 복사했어요. 붙여 넣어 자랑해 보세요");
    } catch {
      setRecNote("복사하지 못했어요");
    }
  };
  // 투표 마감 뒤 판정 전: 내가 누른 쪽이 지금 가격으로 맞는지 한 줄만(숫자는 보이지 않는다)
  const live =
    !r.open && my && r.live
      ? r.live === "flat"
        ? "flat"
        : r.live === my
          ? "hit"
          : "miss"
      : null;

  const last = s.past[0];
  const lastOut = last && outcome(last.pct);
  const v = last ? verdict(last, mine[last.target]) : null;
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
    <section
      id="poll"
      className="card poll no-capture"
      aria-label="오늘의 한 표"
    >
      <h2 className="card-title">{lead} 코스피, 오를까 내릴까?</h2>
      <p className="muted poll-when">
        {dayLabel(r.target)} 장 ·{" "}
        {now > 0 && left > 0 ? (
          <span
            className={`poll-count${r.open && left < 3_600_000 ? " soon" : ""}`}
          >
            {r.open ? "마감까지" : "결과까지"} <b>{remain(left)}</b>
          </span>
        ) : r.open ? (
          "09:00 투표 마감"
        ) : (
          "투표 마감 · 15:45 장 끝나면 결과"
        )}
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
            <i
              className="up-fill"
              style={{ width: `${total ? pctOf(r.up, r.down) : 50}%` }}
            />
          </div>
          <p className="poll-share">
            <span className="up">
              오른다 {pctOf(r.up, r.down)}%{" "}
              {counts && (
                <small className="poll-n">{r.up.toLocaleString()}명</small>
              )}
            </span>
            <span className="down">
              {counts && (
                <small className="poll-n">{r.down.toLocaleString()}명</small>
              )}{" "}
              내린다 {total ? 100 - pctOf(r.up, r.down) : 0}%
            </span>
          </p>
          {ASK_ENABLED && r.open && my && (
            <button type="button" className="poll-ask" onClick={ask}>
              단톡방에 물어보기
            </button>
          )}
          {note && <p className="muted small-note">{note}</p>}
        </div>
      )}
      {live && (
        <p className={`poll-live ${live}`}>
          {live === "hit"
            ? "지금 가격이면 적중 중이에요"
            : live === "miss"
              ? "지금 가격이면 빗나가는 중이에요"
              : "지금은 보합 근처예요"}
          <span className="muted"> · 15:45에 확정</span>
        </p>
      )}
      {err && <p className="notice poll-err">{err}</p>}
      {/* 지난 결과·내 기록·안내는 한 줄로 접어 둔다(2026-11-10 SK) */}
      <details className="fold poll-more">
        <summary>지난 결과 · 적중 기록</summary>
        <div className="fold-body">
          {last && (
            <p className="poll-last">
              {dayLabel(last.target)}{" "}
              {lastOut ? (
                <b className={lastOut}>
                  {lastOut === "up" ? "▲" : "▼"} {last.pct! > 0 ? "+" : ""}
                  {last.pct!.toFixed(2)}%
                </b>
              ) : (
                <b>{last.pct == null ? "판정 못 함" : "보합"}</b>
              )}
              {last.up + last.down > 0 &&
                lastOut &&
                majority(last.up, last.down) && (
                  <>
                    {majority(last.up, last.down) === lastOut
                      ? " · 다수 적중"
                      : " · 다수 빗나감"}
                  </>
                )}
              {v && (
                <span className={`poll-verdict ${v.hit ? "hit" : "miss"}`}>
                  {" · "}
                  {v.minority
                    ? "🎯 소수파 적중"
                    : v.hit
                      ? "🎯 적중"
                      : "나는 빗나감"}
                </span>
              )}
              {streak >= 2 && (
                <span className="poll-streak"> · 🔥 {streak}연속</span>
              )}
            </p>
          )}
          {month && marks.length > 0 && (
            <div className="poll-rec">
              <button type="button" className="poll-rec-btn" aria-expanded={recOpen} onClick={() => setRecOpen(!recOpen)}>
                📅 {Number(month.slice(5, 7))}월 내 기록 {marks.filter((m) => m.mark === "🟩").length}/{marks.filter((m) => m.mark !== "⬜").length}
              </button>
              {recOpen && (
                <>
                  <p className="poll-marks" aria-label="날짜별 적중">
                    {marks.map((m) => (
                      <span key={m.target} title={dayLabel(m.target)}>
                        {m.mark}
                      </span>
                    ))}
                  </p>
                  <button type="button" className="poll-ask" onClick={shareRec}>
                    기록 공유하기
                  </button>
                  {recNote && <p className="muted small-note">{recNote}</p>}
                </>
              )}
            </div>
          )}
          <p className="muted poll-foot">
            {crowd.n > 0 && `다수 적중 ${crowd.hit}/${crowd.n}회 · `}
            {lean.n >= 3 && `80% 넘게 쏠린 날 다수 적중 ${lean.hit}/${lean.n}회 · `}
            {myN > 0 && `내 적중 ${myHit}/${myN}회 · `}
            코스피200 무기한선물 15:45 기준 · 재미로 하는 투표
          </p>
        </div>
      </details>
    </section>
  );
}
