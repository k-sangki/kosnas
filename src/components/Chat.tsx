"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_NICK, MAX_TEXT, randomNick, type ChatMsg, type ClientEvent, type ServerEvent } from "@/lib/chat";

/**
 * 첫 화면 익명 실시간 채팅. 처음에는 접혀 있지만 웹소켓은 늘 붙어 있어서(휴면 웹소켓이라 말이 없을 때는 비용이 없다)
 * 접힌 상태에서도 새 글 수와 최근 글 한 줄을 보인다. 마지막으로 본 글 번호는 이 브라우저에 저장한다.
 * 닉네임은 B급 이름을 하나 골라 이 브라우저에 저장하고, 직접 바꿀 수 있다. 캡처에는 들어가지 않는다.
 */
const NICK_KEY = "kosnas:chat:nick";
const SEEN_KEY = "kosnas:chat:seen";
/** 처음 온 사람에게는 최근 이만큼 사이의 글만 새 글로 센다 */
const FIRST_VISIT_MS = 3 * 3600_000;

function loadNick() {
  try {
    const v = localStorage.getItem(NICK_KEY);
    if (v) return v;
    const n = randomNick();
    localStorage.setItem(NICK_KEY, n);
    return n;
  } catch {
    return randomNick();
  }
}

function loadSeen(): number | null {
  try {
    const v = Number(localStorage.getItem(SEEN_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

const hhmm = (ms: number) => {
  const d = new Date(ms + 9 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

type Conn = "connecting" | "open" | "closed";

/** 채팅방 연결. 펼치든 접든 붙어 있고, 끊기면 2초부터 30초까지 늘려 가며 다시 붙는다 */
function useRoom() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [conn, setConn] = useState<Conn>("connecting");
  const [myTag, setMyTag] = useState("");
  const [error, setError] = useState("");
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stop = false;
    let wait = 2000;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      setConn("connecting");
      const s = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/chat`);
      ws.current = s;
      s.onopen = () => {
        wait = 2000;
        setConn("open");
      };
      s.onmessage = (m) => {
        let e: ServerEvent;
        try {
          e = JSON.parse(String(m.data));
        } catch {
          return;
        }
        if (e.type === "init") {
          setMsgs(e.messages);
          setMyTag(e.tag);
        } else if (e.type === "msg") setMsgs((v) => [...v.slice(-199), e.message]);
        else if (e.type === "hide") setMsgs((v) => v.filter((x) => x.id !== e.id));
        else if (e.type === "error") setError(e.text);
      };
      s.onclose = () => {
        if (ws.current === s) ws.current = null;
        if (stop) return;
        setConn("closed");
        timer = setTimeout(connect, wait);
        wait = Math.min(wait * 2, 30_000);
      };
    };
    connect();
    return () => {
      stop = true;
      clearTimeout(timer);
      ws.current?.close();
      ws.current = null;
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const send = (e: ClientEvent) => {
    if (ws.current?.readyState !== WebSocket.OPEN) {
      setError("연결 중이에요. 잠시 뒤에 다시 보내 주세요.");
      return false;
    }
    ws.current.send(JSON.stringify(e));
    return true;
  };

  return { msgs, conn, myTag, error, send };
}

export function Chat() {
  const room = useRoom();
  const [open, setOpen] = useState(false);
  // 마지막으로 본 글 번호(브라우저 저장). 처음 온 사람은 null
  // (서버 렌더에서는 null이지만 그때는 글이 없어 화면이 같다)
  const [seen, setSeen] = useState<number | null>(() => (typeof window === "undefined" ? null : loadSeen()));
  const [mountedAt] = useState(() => Date.now());

  const lastId = room.msgs.length ? room.msgs[room.msgs.length - 1].id : 0;
  // 펼쳐 둔 동안 들어온 글은 본 것으로 친다
  useEffect(() => {
    if (!open || !lastId) return;
    try {
      localStorage.setItem(SEEN_KEY, String(lastId));
    } catch {}
  }, [open, lastId]);

  const toggle = () => {
    if (open && lastId) setSeen(lastId);
    setOpen(!open);
  };

  const cutoff = mountedAt - FIRST_VISIT_MS;
  const unread = open ? [] : room.msgs.filter((m) => m.tag !== room.myTag && (seen != null ? m.id > seen : m.at > cutoff));
  const latest = room.msgs[room.msgs.length - 1];

  return (
    <section className="card chat no-capture" aria-label="실시간 채팅">
      <button type="button" className="chat-toggle" aria-expanded={open} onClick={toggle}>
        <span className="chat-head-text">
          <span className="chat-title">
            <i className={`chat-dot${room.conn === "open" ? " live" : ""}`} aria-hidden />
            실시간 채팅
          </span>
          {!open && latest && (
            <span className="chat-peek">
              <b>{latest.nick}</b> {latest.text}
            </span>
          )}
        </span>
        <span className="chat-head-right">
          {unread.length > 0 && <span className="chat-new">새 글 {unread.length > 99 ? "99+" : unread.length}</span>}
          <span className="chat-chev" aria-hidden />
        </span>
      </button>
      {open && <ChatBody room={room} />}
    </section>
  );
}

function ChatBody({ room }: { room: ReturnType<typeof useRoom> }) {
  const { msgs, conn, myTag, error, send } = room;
  // 펼친 뒤에만 그려지므로(서버 렌더 없음) 처음 값을 바로 읽는다
  const [nick, setNick] = useState(loadNick);
  const [editNick, setEditNick] = useState(false);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<ChatMsg | null>(null);
  const [reported, setReported] = useState<number[]>([]);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const input = useRef<HTMLInputElement>(null);

  // 맨 아래를 보고 있을 때만 새 메시지로 따라 내려간다(펼친 직후에는 맨 아래로)
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const saveNick = (v: string) => {
    const n = v.trim().slice(0, MAX_NICK) || randomNick();
    setNick(n);
    setEditNick(false);
    try {
      localStorage.setItem(NICK_KEY, n);
    } catch {}
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!text.trim()) return;
    stick.current = true;
    if (send({ type: "send", nick, text, ...(reply ? { replyTo: reply.id } : {}) })) {
      setText("");
      setReply(null);
    }
  };

  return (
    <div className="chat-body">
      <div
        className="chat-list"
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {msgs.length === 0 && (
          <p className="muted chat-empty">
            {conn === "open" ? "아직 메시지가 없어요. 첫 마디를 남겨 보세요." : conn === "connecting" ? "연결하는 중…" : "연결이 끊겼어요. 다시 연결하는 중…"}
          </p>
        )}
        {msgs.map((m) => {
          const mine = m.tag === myTag && m.nick === nick;
          return (
            <div key={m.id} className={`chat-msg${mine ? " mine" : ""}`}>
              <div className="chat-meta">
                <b>{m.nick}</b>
                <span className="chat-tag">#{m.tag}</span>
                <span className="chat-time">{hhmm(m.at)}</span>
              </div>
              {m.reply && (
                <p className="chat-quote">
                  ↳ <b>{m.reply.nick}</b> {m.reply.text}
                </p>
              )}
              <p className="chat-text">{m.text}</p>
              <div className="chat-actions">
                <button
                  type="button"
                  onClick={() => {
                    setReply(m);
                    input.current?.focus();
                  }}
                >
                  답글
                </button>
                {m.tag !== myTag && (
                  <button
                    type="button"
                    disabled={reported.includes(m.id)}
                    onClick={() => {
                      if (!confirm("이 메시지를 신고할까요? 여러 사람이 신고하면 숨겨집니다.")) return;
                      if (send({ type: "report", id: m.id })) setReported((v) => [...v, m.id]);
                    }}
                  >
                    {reported.includes(m.id) ? "신고함" : "신고"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {reply && (
        <div className="chat-replying">
          <span>
            ↳ <b>{reply.nick}</b>에게 답글
          </span>
          <button type="button" onClick={() => setReply(null)} aria-label="답글 취소">
            ×
          </button>
        </div>
      )}
      <form className="chat-form" onSubmit={submit}>
        {editNick ? (
          <input
            className="chat-nick-input"
            defaultValue={nick}
            maxLength={MAX_NICK}
            autoFocus
            aria-label="닉네임"
            onBlur={(e) => saveNick(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveNick(e.currentTarget.value);
              }
            }}
          />
        ) : (
          <button type="button" className="chat-nick" onClick={() => setEditNick(true)} title="닉네임 바꾸기">
            {nick} ✎
          </button>
        )}
        <div className="chat-send">
          <input ref={input} value={text} maxLength={MAX_TEXT} onChange={(e) => setText(e.target.value)} placeholder="메시지 입력" aria-label="메시지" />
          <button type="submit" disabled={!text.trim()}>
            보내기
          </button>
        </div>
      </form>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      <p className="muted small-note">
        누구나 보는 익명 채팅이에요. 욕설은 가려지고 링크·연락처는 올릴 수 없으며, 신고가 3건 모이면 숨겨집니다. 메시지는 24시간 뒤 지워져요. 종목 매수·매도 권유나
        광고는 삼가 주세요. 같은 날 같은 곳에서 쓴 글에는 같은 #꼬리표가 붙습니다.
      </p>
    </div>
  );
}
