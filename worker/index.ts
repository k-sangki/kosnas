/**
 * Workers 진입점. 채팅 웹소켓(/api/chat)은 채팅방, 투표(/api/poll)는 투표함(둘 다 Durable Object)으로 보내고
 * 나머지는 OpenNext(Next.js)가 받는다.
 * .open-next/worker.js 는 빌드 때 생긴다.
 *
 * 무료 요금제의 요청당 CPU 10ms 안에 들도록 Next.js를 되도록 거치지 않는다(2026-10-24, P50 83ms였다):
 * - /api/night·/api/us 는 여기서 바로 처리한다(엣지 캐시 적중이면 1ms 안팎).
 * - 페이지는 모두 빌드 때 만든 정적 페이지라, Next.js가 한 번 만든 응답(HTML·RSC)을 배포 버전별로 엣지 캐시에 담아 다시 쓴다.
 * - www 는 Next.js 대신 여기서 kosnas.com 으로 보낸다.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore 빌드 산출물
import handler from "../.open-next/worker.js";
import { nightGET } from "../src/lib/night-api";
import { usGET } from "../src/lib/us-api";
import { ChatRoom } from "./chat-room";
import { PollRoom } from "./poll-room";

type Env = {
  CHAT: DurableObjectNamespace<ChatRoom>;
  POLL: DurableObjectNamespace<PollRoom>;
  CF_VERSION_METADATA?: { id: string };
};

export { ChatRoom, PollRoom };

/** 페이지 응답을 엣지에 두는 시간. 배포마다 키가 바뀌므로 자료 갱신(재배포)은 바로 보인다 */
const PAGE_TTL = 24 * 3600;
/** Next.js가 같은 주소에 다른 응답(RSC·프리페치)을 내는 요청 머리 */
const NEXT_HEADERS = ["rsc", "next-router-prefetch", "next-router-segment-prefetch", "next-router-state-tree", "next-url"];

async function hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function pageKey(req: Request, version: string) {
  const u = new URL(req.url);
  u.searchParams.set("__v", version);
  const vary = NEXT_HEADERS.map((h) => `${h}:${req.headers.get(h) ?? ""}`).join("\n");
  if (NEXT_HEADERS.some((h) => req.headers.has(h))) u.searchParams.set("__h", await hex(vary));
  return new Request(u.toString());
}

/** 정적 페이지(HTML·RSC)와 없는 주소(404)만 담는다. 쿠키를 심는 응답은 담지 않는다 */
function cacheable(res: Response) {
  if (res.status !== 200 && res.status !== 404) return false;
  if (res.headers.has("set-cookie")) return false;
  const type = res.headers.get("content-type") ?? "";
  return type.startsWith("text/html") || type.startsWith("text/x-component");
}

async function page(req: Request, env: Env, ctx: ExecutionContext) {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (!cache || req.method !== "GET") return handler.fetch(req, env, ctx) as Promise<Response>;
  const key = await pageKey(req, env.CF_VERSION_METADATA?.id ?? "dev");
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) {
    const out = new Response(hit.body, hit);
    out.headers.set("Cache-Control", hit.headers.get("x-kn-cc") ?? "public, max-age=0, must-revalidate");
    out.headers.delete("x-kn-cc");
    return out;
  }
  const res = (await handler.fetch(req, env, ctx)) as Response;
  if (cacheable(res)) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set("x-kn-cc", res.headers.get("cache-control") ?? "public, max-age=0, must-revalidate");
    copy.headers.set("Cache-Control", `public, max-age=${PAGE_TTL}`);
    copy.headers.delete("vary");
    ctx.waitUntil(cache.put(key, copy).catch(() => undefined));
  }
  return res;
}

const worker = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (url.hostname === "www.kosnas.com") {
      url.hostname = "kosnas.com";
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname === "/api/night") return nightGET(req);
    if (url.pathname === "/api/us") return usGET(req);
    if (url.pathname === "/api/chat") {
      // 다른 사이트에서 붙지 못하게 같은 주소에서 연 웹소켓만 받는다
      let host = "";
      try {
        host = new URL(req.headers.get("Origin") ?? "").host;
      } catch {}
      if (host !== url.host) return new Response("forbidden", { status: 403 });
      return env.CHAT.get(env.CHAT.idFromName("main")).fetch(req);
    }
    if (url.pathname === "/api/poll") {
      // 표는 같은 주소의 화면에서 보낸 것만 받는다
      if (req.method === "POST") {
        let host = "";
        try {
          host = new URL(req.headers.get("Origin") ?? "").host;
        } catch {}
        if (host !== url.host) return new Response("forbidden", { status: 403 });
      }
      return env.POLL.get(env.POLL.idFromName("main")).fetch(req);
    }
    return page(req, env, ctx);
  },
};

export default worker;
