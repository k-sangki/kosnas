"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_NICK, MAX_TEXT, randomNick, type ChatMsg, type ClientEvent, type ServerEvent } from "@/lib/chat";

/**
 * 첫 화면 익명 실시간 채팅. 처음에는 접혀 있고, 펼친 동안에만 웹소켓으로 붙는다.
 * 닉네임은 B급 이름을 하나 골라 이 브라우저에 저장하고, 직접 바꿀 수 있다. 캡처에는 들어가지 않는다.
 */
const NICK_KEY = "kosnas:chat:nick";

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

const hhmm = (ms: number) => {
  const d = new Date(ms + 9 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

export function Chat() {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState<number | null>(null);
  return (
    <section className="card chat no-capture" aria-label="실시간 채팅">
      <button type="button" className="chat-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="chat-title">
          실시간 채팅
          {open && online != null && <span className="chat-online">{online}명 접속</span>}
        </span>
        <span className="chat-chev" aria-hidden />
      </button>
      {open && <ChatBody onOnline={setOnline} />}
    </section>
  );
}

function ChatBody({ onOnline }: { onOnline: (n: number | null) => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [state, setState] = useState<"connecting" | "open" | "closed">("connecting");
  const [myTag, setMyTag] = useState("");
  // 펼친 뒤에만 그려지므로(서버 렌더 없음) 처음 값을 바로 읽는다
  const [nick, setNick] = useState(loadNick);
  const [editNick, setEditNick] = useState(false);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<ChatMsg | null>(null);
  const [error, setError] = useState("");
  const [reported, setReported] = useState<number[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stop = false;
    let wait = 2000;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      setState("connecting");
      const s = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/chat`);
      ws.current = s;
      s.onopen = () => {
        wait = 2000;
        setState("open");
      };
      s.onmessage = (m) => {
        let e: ServerEvent;
        try {
          e = JSON.parse(String(m.data));
        } catch {
          return;
        }
        if (e.type === "init") {
          stick.current = true;
          setMsgs(e.messages);
          setMyTag(e.tag);
          onOnline(e.online);
        } else if (e.type === "msg") setMsgs((v) => [...v.slice(-199), e.message]);
        else if (e.type === "hide") setMsgs((v) => v.filter((x) => x.id !== e.id));
        else if (e.type === "online") onOnline(e.online);
        else if (e.type === "error") setError(e.text);
      };
      s.onclose = () => {
        if (ws.current === s) ws.current = null;
        onOnline(null);
        if (stop) return;
        setState("closed");
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
      onOnline(null);
    };
  }, [onOnline]);

  // 맨 아래를 보고 있을 때만 새 메시지로 따라 내려간다
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

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
            {state === "open" ? "아직 메시지가 없어요. 첫 마디를 남겨 보세요." : state === "connecting" ? "연결하는 중…" : "연결이 끊겼어요. 다시 연결하는 중…"}
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
