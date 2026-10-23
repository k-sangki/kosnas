import { DurableObject } from "cloudflare:workers";
import {
  HIDE_REPORTS,
  HISTORY,
  KEEP_COUNT,
  KEEP_MS,
  checkText,
  cleanNick,
  quote,
  rateLimit,
  type ChatMsg,
  type ClientEvent,
  type ServerEvent,
} from "../src/lib/chat";

/**
 * 첫 화면 익명 채팅방 하나. 웹소켓은 휴면(hibernation) 방식이라 말이 없을 때는 요금이 들지 않는다.
 * 메시지는 이 객체의 SQLite에 24시간·300개까지만 둔다. IP는 저장하지 않고 그날의 해시 꼬리표만 쓴다.
 */
type Att = { tag: string };
type Row = { id: number; at: number; nick: string; tag: string; text: string; reply_id: number | null; reply_nick: string | null; reply_text: string | null };

/**
 * 운영자 키의 해시(키 자체는 저장소에 없다). 키를 바꾸려면:
 * printf %s "kosnas-chat-admin:<새 키>" | sha256sum 결과로 바꾼다.
 */
const ADMIN_HASH = "8f07591cc9cde0fbb483bbe8771477cd0de3b6b0acc28ca56abc9579cefc528b";
const BAN_MS = 24 * 3600_000;

async function isAdmin(key: unknown) {
  if (typeof key !== "string" || !key) return false;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kosnas-chat-admin:${key}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("") === ADMIN_HASH;
}

async function tagOf(ip: string, now: number) {
  const day = new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kosnas-chat:${day}:${ip}`));
  return Array.from(new Uint8Array(buf).slice(0, 2), (b) => b.toString(16).padStart(2, "0")).join("");
}

const toMsg = (r: Row): ChatMsg => ({
  id: r.id,
  at: r.at,
  nick: r.nick,
  tag: r.tag,
  text: r.text,
  ...(r.reply_id != null ? { reply: { id: r.reply_id, nick: r.reply_nick ?? "", text: r.reply_text ?? "" } } : {}),
});

export class ChatRoom extends DurableObject {
  /** 꼬리표마다 최근 보낸 시각(휴면에서 깨면 비지만 도배 막기에는 충분하다) */
  private sent = new Map<string, number[]>();

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS msg (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, nick TEXT NOT NULL, tag TEXT NOT NULL,
        text TEXT NOT NULL, reply_id INTEGER, reply_nick TEXT, reply_text TEXT, hidden INTEGER NOT NULL DEFAULT 0);
       CREATE TABLE IF NOT EXISTS report (msg_id INTEGER NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (msg_id, tag));
       CREATE TABLE IF NOT EXISTS ban (tag TEXT PRIMARY KEY, until INTEGER NOT NULL);`,
    );
  }

  private recent(now: number) {
    const rows = this.ctx.storage.sql
      .exec<Row>(`SELECT id, at, nick, tag, text, reply_id, reply_nick, reply_text FROM msg WHERE hidden = 0 AND at > ? ORDER BY id DESC LIMIT ?`, now - KEEP_MS, HISTORY)
      .toArray();
    return rows.reverse().map(toMsg);
  }

  private broadcast(e: ServerEvent) {
    const s = JSON.stringify(e);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(s);
      } catch {}
    }
  }

  async fetch(req: Request) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("웹소켓으로만 접속합니다", { status: 426 });
    const now = Date.now();
    const tag = await tagOf(req.headers.get("CF-Connecting-IP") ?? "", now);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ tag } satisfies Att);
    const online = this.ctx.getWebSockets().length;
    server.send(JSON.stringify({ type: "init", messages: this.recent(now), online, tag } satisfies ServerEvent));
    this.broadcast({ type: "online", online });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    const { tag } = ws.deserializeAttachment() as Att;
    const err = (text: string) => ws.send(JSON.stringify({ type: "error", text } satisfies ServerEvent));
    let e: ClientEvent;
    try {
      e = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
    } catch {
      return;
    }
    const now = Date.now();
    const sql = this.ctx.storage.sql;
    if (e?.type === "send") {
      if (sql.exec(`SELECT 1 FROM ban WHERE tag = ? AND until > ?`, tag, now).toArray().length) return err("운영 정책 위반으로 글쓰기가 제한됐어요.");
      const nick = cleanNick(e.nick);
      if (!nick) return err("닉네임을 입력해 주세요.");
      const times = this.sent.get(tag) ?? [];
      const slow = rateLimit(times, now);
      if (slow) return err(slow);
      const c = checkText(e.text);
      if (!c.ok) return err(c.why);
      const to =
        typeof e.replyTo === "number"
          ? sql.exec<{ nick: string; text: string }>(`SELECT nick, text FROM msg WHERE id = ? AND hidden = 0`, e.replyTo).toArray()[0]
          : undefined;
      const reply = to && { id: e.replyTo as number, nick: to.nick, text: quote(to.text) };
      const id = sql
        .exec<{ id: number }>(
          `INSERT INTO msg (at, nick, tag, text, reply_id, reply_nick, reply_text) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          now,
          nick,
          tag,
          c.text,
          reply?.id ?? null,
          reply?.nick ?? null,
          reply?.text ?? null,
        )
        .one().id;
      sql.exec(`DELETE FROM msg WHERE at < ? OR id <= ?`, now - KEEP_MS, id - KEEP_COUNT);
      sql.exec(`DELETE FROM report WHERE msg_id NOT IN (SELECT id FROM msg)`);
      this.sent.set(tag, [...times.filter((t) => now - t < 60_000), now]);
      this.broadcast({ type: "msg", message: { id, at: now, nick, tag, text: c.text, ...(reply ? { reply } : {}) } });
    } else if (e?.type === "admin" && typeof e.id === "number") {
      if (!(await isAdmin(e.key))) return err("운영자 키가 맞지 않아요.");
      const m = sql.exec<{ tag: string }>(`SELECT tag FROM msg WHERE id = ?`, e.id).toArray()[0];
      if (!m) return;
      const ids =
        e.action === "ban"
          ? sql.exec<{ id: number }>(`SELECT id FROM msg WHERE tag = ? AND hidden = 0`, m.tag).toArray().map((r) => r.id)
          : [e.id];
      if (e.action === "ban") sql.exec(`INSERT OR REPLACE INTO ban (tag, until) VALUES (?, ?)`, m.tag, now + BAN_MS);
      sql.exec(`DELETE FROM ban WHERE until < ?`, now);
      for (const id of ids) {
        sql.exec(`UPDATE msg SET hidden = 1 WHERE id = ?`, id);
        this.broadcast({ type: "hide", id });
      }
    } else if (e?.type === "report" && typeof e.id === "number") {
      const m = sql.exec<{ tag: string }>(`SELECT tag FROM msg WHERE id = ? AND hidden = 0`, e.id).toArray()[0];
      if (!m || m.tag === tag) return;
      sql.exec(`INSERT OR IGNORE INTO report (msg_id, tag) VALUES (?, ?)`, e.id, tag);
      const n = sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM report WHERE msg_id = ?`, e.id).one().n;
      if (n >= HIDE_REPORTS) {
        sql.exec(`UPDATE msg SET hidden = 1 WHERE id = ?`, e.id);
        this.broadcast({ type: "hide", id: e.id });
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    try {
      ws.close();
    } catch {}
    this.broadcast({ type: "online", online: this.ctx.getWebSockets().filter((w) => w !== ws).length });
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }
}
