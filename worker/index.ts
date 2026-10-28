/**
 * Workers 진입점. 채팅 웹소켓(/api/chat)은 채팅방, 투표(/api/poll)는 투표함(둘 다 Durable Object)으로 보내고
 * 나머지는 OpenNext(Next.js)가 받는다.
 * .open-next/worker.js 는 빌드 때 생긴다.
 *
 * 무료 요금제의 요청당 CPU 10ms 안에 들도록 Next.js를 되도록 거치지 않는다(2026-10-24, P50 83ms였다):
 * - /api/night·/api/us 는 여기서 바로 처리한다(엣지 캐시 적중이면 1ms 안팎).
 * - 페이지는 모두 빌드 때 만든 정적 페이지라, Next.js가 한 번 만든 응답(HTML·RSC)을 배포 버전별로 엣지 캐시에 담아 다시 쓴다.
 * - www·http 는 Next.js 대신 여기서 https://kosnas.com 으로 한 번에 보낸다(검색엔진이 http 주소를 따로 모으지 않게).
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore 빌드 산출물
import handler from "../.open-next/worker.js";
import { nightGET } from "../src/lib/night-api";
import type { NightData } from "../src/lib/night";
import { nightImage, pollImage } from "../src/lib/og-image";
import type { PollState } from "../src/lib/poll";
import { usGET } from "../src/lib/us-api";
import { ChatRoom } from "./chat-room";
import { PollRoom } from "./poll-room";

type Env = {
  CHAT: DurableObjectNamespace<ChatRoom>;
  POLL: DurableObjectNamespace<PollRoom>;
  CF_VERSION_METADATA?: { id: string };
  /** kosnas 저장소 Actions 쓰기만 되는 GitHub 토큰(wrangler secret). 없으면 예약 작업이 아무것도 하지 않는다 */
  GH_DISPATCH_TOKEN?: string;
};

export { ChatRoom, PollRoom };

/** 국장 시세 수집 워크플로를 건다(wrangler.jsonc triggers.crons). 이미 받은 날이면 그 작업은 금방 끝난다 */
async function dispatchCollectKr(env: Env) {
  if (!env.GH_DISPATCH_TOKEN) return console.log("GH_DISPATCH_TOKEN 없음 — 국장 시세 수집을 걸지 않음");
  const res = await fetch("https://api.github.com/repos/k-sangki/kosnas/actions/workflows/collect-kr.yml/dispatches", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kosnas-worker",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) throw new Error(`collect-kr 실행 실패 ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log("collect-kr 실행을 걸었습니다");
}

/** 페이지 응답을 엣지에 두는 시간. 배포마다 키가 바뀌므로 자료 갱신(재배포)은 바로 보인다 */
const PAGE_TTL = 24 * 3600;
/** Next.js가 같은 주소에 다른 응답(RSC·프리페치)을 내는 요청 머리 */
const NEXT_HEADERS = ["rsc", "next-router-prefetch", "next-router-segment-prefetch", "next-router-state-tree", "next-url"];

async function hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 공유 링크에 붙는 꼬리(카톡 미리보기 캐시를 피하는 t, 유입 표시 utm_*). 페이지 캐시 키에서는 뺀다 */
const isShareParam = (k: string) => k === "t" || k.startsWith("utm_");

async function pageKey(req: Request, version: string) {
  const u = new URL(req.url);
  for (const k of [...u.searchParams.keys()]) if (isShareParam(k)) u.searchParams.delete(k);
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

/** 미리보기 그림 주소를 5분마다 바꾼다(카톡은 같은 그림 주소를 오래 기억한다) */
const slot = () => Math.floor(Date.now() / 300_000).toString(36);

/**
 * 링크 미리보기 그림을 그 순간의 값으로: 첫 화면·야간 페이지는 야간 추정, 한 표 공유 링크(utm_source=poll_ask)는 투표.
 * 페이지 자체는 정적이라 Worker가 내보낼 때 og:image·twitter:image 주소만 바꾼다.
 */
function withLiveOg(req: Request, res: Response) {
  if (!(res.headers.get("content-type") ?? "").startsWith("text/html") || res.status !== 200) return res;
  const u = new URL(req.url);
  const kind = u.pathname === "/" && u.searchParams.get("utm_source") === "poll_ask" ? "poll" : u.pathname === "/" || u.pathname === "/night" ? "night" : null;
  if (!kind) return res;
  const img = `${u.origin}/og/${kind}.png?t=${slot()}`;
  const set = { element: (el: Element) => void el.setAttribute("content", img) };
  return new HTMLRewriter().on('meta[property="og:image"]', set).on('meta[name="twitter:image"]', set).transform(res);
}

const OG_TTL = { night: 300, poll: 120 };

/** /og/night.png·/og/poll.png. 같은 주소(t)는 엣지 캐시로 한 번만 그린다. 자료를 못 받으면 기본 그림으로 */
async function ogImage(req: Request, env: Env, kind: "night" | "poll") {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(req.url);
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit;
  const origin = new URL(req.url).origin;
  try {
    let png: Uint8Array;
    if (kind === "night") {
      const r = await nightGET(new Request(`${origin}/api/night`));
      if (!r.ok) throw new Error(`night ${r.status}`);
      png = await nightImage((await r.json()) as NightData);
    } else {
      const r = await env.POLL.get(env.POLL.idFromName("main")).fetch(new Request(`${origin}/api/poll`));
      if (!r.ok) throw new Error(`poll ${r.status}`);
      png = await pollImage((await r.json()) as PollState);
    }
    const res = new Response(png, { headers: { "content-type": "image/png", "Cache-Control": `public, max-age=${OG_TTL[kind]}` } });
    await cache?.put(key, res.clone()).catch(() => undefined);
    return res;
  } catch (e) {
    console.log("미리보기 그림 실패", String(e));
    return Response.redirect(`${origin}/og.png`, 302);
  }
}

async function page(req: Request, env: Env, ctx: ExecutionContext) {
  return withLiveOg(req, await cachedPage(req, env, ctx));
}

async function cachedPage(req: Request, env: Env, ctx: ExecutionContext) {
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
    if (url.hostname === "www.kosnas.com" || (url.hostname === "kosnas.com" && url.protocol === "http:")) {
      url.hostname = "kosnas.com";
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/manifest.webmanifest") {
      // 앱 설치용 파일이라 검색 결과에 넣지 않는다
      const res = (await handler.fetch(req, env, ctx)) as Response;
      const out = new Response(res.body, res);
      out.headers.set("X-Robots-Tag", "noindex");
      return out;
    }
    if (url.pathname === "/api/night") return nightGET(req);
    if (url.pathname === "/og/night.png") return ogImage(req, env, "night");
    if (url.pathname === "/og/poll.png") return ogImage(req, env, "poll");
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
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(dispatchCollectKr(env));
  },
};

export default worker;
