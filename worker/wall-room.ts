import { DurableObject } from "cloudflare:workers";
import {
  WALL_HIDE_REPORTS,
  WALL_SHOW,
  checkWallText,
  isThumb,
  isVoterId,
  wallDay,
  wallLimit,
  type WallAction,
  type WallPost,
  type WallState,
} from "../src/lib/wall";
import { isAdmin } from "./chat-room";

/**
 * 첫 화면 '오늘의 한 줄' 담벼락(글·👍👎·신고). 웹소켓 없이 화면이 1분마다 GET으로 받아 간다.
 * 글은 그날(아침 8시 기준) 것만 보이고 이틀 지난 것은 지운다. IP는 저장하지 않고 그날의 해시 꼬리표만 쓴다.
 * 운영자 키(채팅과 같은 키)로는 쓰기 제한 없이 쓰고, 글을 지우거나 그 꼬리표를 그날 막을 수 있다.
 */
async function tagOf(ip: string, now: number) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kosnas-wall:${wallDay(now)}:${ip}`));
  return Array.from(new Uint8Array(buf).slice(0, 2), (b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

type Row = { id: number; at: number; tag: string; text: string; up: number; down: number; mine: number | null };

export class WallRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS post (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, at INTEGER NOT NULL, tag TEXT NOT NULL,
         text TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0);
       CREATE INDEX IF NOT EXISTS post_day ON post (day, hidden, id);
       CREATE TABLE IF NOT EXISTS thumb (post_id INTEGER NOT NULL, voter TEXT NOT NULL, tag TEXT NOT NULL, v INTEGER NOT NULL,
         PRIMARY KEY (post_id, voter));
       CREATE TABLE IF NOT EXISTS report (post_id INTEGER NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (post_id, tag));
       CREATE TABLE IF NOT EXISTS ban (tag TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (tag, day));`,
    );
  }

  private state(now: number, voter: string | null, tag: string): WallState {
    const sql = this.ctx.storage.sql;
    const day = wallDay(now);
    const rows = sql
      .exec<Row>(
        `SELECT p.id, p.at, p.tag, p.text,
           (SELECT COUNT(*) FROM thumb t WHERE t.post_id = p.id AND t.v = 1) AS up,
           (SELECT COUNT(*) FROM thumb t WHERE t.post_id = p.id AND t.v = -1) AS down,
           (SELECT v FROM thumb t WHERE t.post_id = p.id AND t.voter = ?) AS mine
         FROM post p WHERE p.day = ? AND p.hidden = 0 ORDER BY p.id DESC LIMIT ?`,
        voter ?? "",
        day,
        WALL_SHOW,
      )
      .toArray();
    const total = sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM post WHERE day = ? AND hidden = 0`, day).one().n;
    const posts: WallPost[] = rows.map((r) => ({
      id: r.id,
      at: r.at,
      tag: r.tag,
      text: r.text,
      up: r.up,
      down: r.down,
      mine: r.mine === 1 ? 1 : r.mine === -1 ? -1 : 0,
    }));
    return { day, total, posts, tag };
  }

  /** 이틀 지난 글과 거기 달린 표·신고, 지난 차단을 지운다 */
  private sweep(now: number) {
    const sql = this.ctx.storage.sql;
    const old = wallDay(now - 2 * 86_400_000);
    sql.exec(`DELETE FROM post WHERE day < ?`, old);
    sql.exec(`DELETE FROM thumb WHERE post_id NOT IN (SELECT id FROM post)`);
    sql.exec(`DELETE FROM report WHERE post_id NOT IN (SELECT id FROM post)`);
    sql.exec(`DELETE FROM ban WHERE day < ?`, wallDay(now));
  }

  async fetch(req: Request) {
    const now = Date.now();
    const tag = await tagOf(req.headers.get("CF-Connecting-IP") ?? "", now);
    const url = new URL(req.url);
    if (req.method === "GET") {
      const v = url.searchParams.get("voter");
      return json(this.state(now, isVoterId(v) ? v : null, tag));
    }
    if (req.method !== "POST") return new Response("method", { status: 405 });
    let a: WallAction;
    try {
      a = await req.json();
    } catch {
      return json({ error: "잘못된 요청" }, 400);
    }
    const sql = this.ctx.storage.sql;
    const day = wallDay(now);
    const voter = "voter" in a && isVoterId(a.voter) ? a.voter : null;

    if (a?.type === "post") {
      const admin = await isAdmin(a.key);
      if (!admin) {
        if (sql.exec(`SELECT 1 FROM ban WHERE tag = ? AND day = ?`, tag, day).toArray().length) return json({ error: "운영 정책 위반으로 오늘은 글쓰기가 제한됐어요." }, 403);
        const times = sql.exec<{ at: number }>(`SELECT at FROM post WHERE day = ? AND tag = ?`, day, tag).toArray().map((r) => r.at);
        const slow = wallLimit(times, now);
        if (slow) return json({ error: slow }, 429);
      }
      const c = checkWallText(a.text);
      if (!c.ok) return json({ error: c.why }, 400);
      sql.exec(`INSERT INTO post (day, at, tag, text) VALUES (?, ?, ?, ?)`, day, now, tag, c.text);
      this.sweep(now);
      return json(this.state(now, voter, tag));
    }

    if (a?.type === "thumb" && typeof a.id === "number" && voter && isThumb(a.v)) {
      const p = sql.exec<{ tag: string }>(`SELECT tag FROM post WHERE id = ? AND day = ? AND hidden = 0`, a.id, day).toArray()[0];
      if (!p) return json({ error: "지금은 누를 수 없는 글이에요." }, 404);
      if (a.v === 0) sql.exec(`DELETE FROM thumb WHERE post_id = ? AND voter = ?`, a.id, voter);
      else {
        // 한 곳(꼬리표)에서 브라우저를 바꿔 가며 누르는 것을 막는다: 글 하나에 꼬리표당 3표까지
        const had = sql.exec(`SELECT 1 FROM thumb WHERE post_id = ? AND voter = ?`, a.id, voter).toArray().length > 0;
        const n = sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM thumb WHERE post_id = ? AND tag = ?`, a.id, tag).one().n;
        if (!had && n >= 3) return json({ error: "이미 눌렀어요." }, 429);
        sql.exec(`INSERT OR REPLACE INTO thumb (post_id, voter, tag, v) VALUES (?, ?, ?, ?)`, a.id, voter, tag, a.v);
      }
      return json(this.state(now, voter, tag));
    }

    if (a?.type === "report" && typeof a.id === "number") {
      const p = sql.exec<{ tag: string }>(`SELECT tag FROM post WHERE id = ? AND hidden = 0`, a.id).toArray()[0];
      if (p && p.tag !== tag) {
        sql.exec(`INSERT OR IGNORE INTO report (post_id, tag) VALUES (?, ?)`, a.id, tag);
        const n = sql.exec<{ n: number }>(`SELECT COUNT(*) AS n FROM report WHERE post_id = ?`, a.id).one().n;
        if (n >= WALL_HIDE_REPORTS) sql.exec(`UPDATE post SET hidden = 1 WHERE id = ?`, a.id);
      }
      return json(this.state(now, voter, tag));
    }

    if (a?.type === "admin" && typeof a.id === "number") {
      if (!(await isAdmin(a.key))) return json({ error: "운영자 키가 맞지 않아요." }, 403);
      const p = sql.exec<{ tag: string; day: string }>(`SELECT tag, day FROM post WHERE id = ?`, a.id).toArray()[0];
      if (p) {
        if (a.action === "ban") {
          sql.exec(`INSERT OR IGNORE INTO ban (tag, day) VALUES (?, ?)`, p.tag, p.day);
          sql.exec(`UPDATE post SET hidden = 1 WHERE tag = ? AND day = ?`, p.tag, p.day);
        } else sql.exec(`UPDATE post SET hidden = 1 WHERE id = ?`, a.id);
      }
      return json(this.state(now, voter, tag));
    }

    return json({ error: "잘못된 요청" }, 400);
  }
}
