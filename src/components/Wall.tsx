"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { WALL_MAX, type Thumb, type WallAction, type WallPost, type WallState } from "@/lib/wall";

/**
 * 첫 화면 '오늘의 한 줄' 담벼락. 가입 없이 60자 한 줄, 아침 8시에 비워지고 최근 30개만 보인다. 글마다 👍👎 숫자와 신고.
 * 글은 화면에서 따로 받아 오므로(서버 렌더 없음) 검색 로봇이 보는 페이지 내용에는 남이 쓴 글이 들어가지 않는다.
 * 캡처에는 들어가지 않는다.
 */
/** 애드센스 승인 전까지 꺼 둔다(2026-11-17 SK). 꺼져 있어도 운영자 키가 있는 브라우저에는 보인다 */
export const WALL_ENABLED = false;

/** 투표함과 같은 브라우저 익명 번호를 쓴다 */
const VOTER_KEY = "kosnas:poll:voter";
/** 운영자 키(채팅과 같다. https://kosnas.com/?chatadmin=<키> 로 한 번 열면 저장된다) */
const ADMIN_KEY = "kosnas:chat:admin";
const REFRESH_MS = 60_000;

function voterId() {
  try {
    let v = localStorage.getItem(VOTER_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VOTER_KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}

function readAdmin() {
  try {
    const u = new URL(location.href);
    const k = u.searchParams.get("chatadmin");
    if (k != null) {
      if (k === "off" || !k) localStorage.removeItem(ADMIN_KEY);
      else localStorage.setItem(ADMIN_KEY, k);
    }
    return localStorage.getItem(ADMIN_KEY) ?? "";
  } catch {
    return "";
  }
}
const noop = () => () => {};

function ago(at: number, now: number) {
  const m = Math.max(0, Math.floor((now - at) / 60_000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  return `${Math.floor(m / 60)}시간 전`;
}

export function Wall() {
  const admin = useSyncExternalStore(noop, readAdmin, () => "");
  if (!WALL_ENABLED && !admin) return null;
  return <WallCard admin={admin} />;
}

function WallCard({ admin }: { admin: string }) {
  const [s, setS] = useState<WallState | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/wall?voter=${encodeURIComponent(voterId())}`, { cache: "no-store" });
      if (r.ok) setS(await r.json());
    } catch {}
    setNow(Date.now());
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [load]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const send = async (a: WallAction) => {
    const r = await fetch("/api/wall", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(a) }).catch(() => null);
    if (!r) {
      setError("연결이 끊겼어요. 잠시 뒤에 다시 해 주세요.");
      return false;
    }
    const body = (await r.json().catch(() => null)) as (WallState & { error?: string }) | null;
    if (!r.ok || !body || body.error) {
      setError(body?.error ?? "잠시 뒤에 다시 해 주세요.");
      return false;
    }
    setS(body);
    return true;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    if (await send({ type: "post", text, voter: voterId(), ...(admin ? { key: admin } : {}) })) setText("");
    setBusy(false);
  };

  const thumb = (p: WallPost, v: Exclude<Thumb, 0>) => {
    const next: Thumb = p.mine === v ? 0 : v;
    // 먼저 화면에 반영하고 서버 답으로 맞춘다
    setS((cur) =>
      cur && {
        ...cur,
        posts: cur.posts.map((x) =>
          x.id !== p.id
            ? x
            : {
                ...x,
                mine: next,
                up: x.up - (x.mine === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
                down: x.down - (x.mine === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
              },
        ),
      },
    );
    send({ type: "thumb", id: p.id, voter: voterId(), v: next }).then((ok) => {
      if (!ok) load();
    });
  };

  const len = Array.from(text).length;

  return (
    <section className="card wall no-capture" aria-label="오늘의 한 줄">
      <h2 className="wall-title">
        오늘 시장, 한 줄로
        {!WALL_ENABLED && <span className="chat-admin-note">운영자에게만 보임</span>}
      </h2>
      <p className="muted wall-sub">가입 없이 · {WALL_MAX}자 · 매일 아침 8시에 비워져요</p>
      <form className="wall-form" onSubmit={submit}>
        <input
          value={text}
          maxLength={WALL_MAX}
          onChange={(e) => setText(e.target.value)}
          placeholder="지금 시장 느낌을 한 줄로"
          aria-label="한 줄"
        />
        <span className="wall-count">
          {len}/{WALL_MAX}
        </span>
        <button type="submit" disabled={!text.trim() || busy}>
          남기기
        </button>
      </form>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      <div className="wall-head">
        <span>오늘 남긴 한 줄{s ? ` · ${s.total}개` : ""}</span>
        {s && s.total > s.posts.length && <span className="muted">최근 {s.posts.length}개</span>}
      </div>
      {s && s.posts.length === 0 && <p className="muted wall-empty">아직 오늘 남긴 한 줄이 없어요. 첫 줄을 남겨 보세요.</p>}
      {!s && <p className="muted wall-empty">불러오는 중…</p>}
      <ul className="wall-list">
        {s?.posts.map((p) => (
          <li key={p.id} className="wall-item">
            <span className="wall-tag">#{p.tag}</span>
            <p className="wall-text">
              {p.text}
              <small>{ago(p.at, now)}</small>
            </p>
            <div className="wall-actions">
              <button type="button" className={`wall-thumb${p.mine === 1 ? " on up" : ""}`} aria-pressed={p.mine === 1} aria-label="좋아요" onClick={() => thumb(p, 1)}>
                👍 <b>{p.up}</b>
              </button>
              <button
                type="button"
                className={`wall-thumb${p.mine === -1 ? " on down" : ""}`}
                aria-pressed={p.mine === -1}
                aria-label="싫어요"
                onClick={() => thumb(p, -1)}
              >
                👎 <b>{p.down}</b>
              </button>
              {s.tag !== p.tag && (
                <button
                  type="button"
                  className="wall-report"
                  disabled={reported.includes(p.id)}
                  onClick={() => {
                    if (!confirm("이 글을 신고할까요? 여러 사람이 신고하면 숨겨집니다.")) return;
                    setReported((v) => [...v, p.id]);
                    send({ type: "report", id: p.id, voter: voterId() });
                  }}
                >
                  {reported.includes(p.id) ? "신고함" : "신고"}
                </button>
              )}
              {admin && (
                <>
                  <button type="button" className="wall-report chat-admin" onClick={() => send({ type: "admin", id: p.id, key: admin, action: "delete" })}>
                    삭제
                  </button>
                  <button
                    type="button"
                    className="wall-report chat-admin"
                    onClick={() => {
                      if (confirm(`#${p.tag}의 오늘 글을 모두 지우고 오늘 글쓰기를 막을까요?`)) send({ type: "admin", id: p.id, key: admin, action: "ban" });
                    }}
                  >
                    차단
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small-note">
        누구나 보는 익명 한 줄이에요. 욕설은 가려지고 링크·연락처·종목 추천·단톡방 홍보는 올릴 수 없으며, 신고가 3번 모이면 숨겨집니다. #꼬리표는 같은 날 같은 곳에서 쓴
        글에 같게 붙는 짧은 표시예요(IP는 저장하지 않아요). 투자 판단은 본인 몫이에요.
      </p>
    </section>
  );
}
