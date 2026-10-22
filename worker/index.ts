/**
 * Workers 진입점. 채팅 웹소켓(/api/chat)만 채팅방(Durable Object)으로 보내고 나머지는 OpenNext(Next.js)가 받는다.
 * .open-next/worker.js 는 빌드 때 생긴다.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore 빌드 산출물
import handler from "../.open-next/worker.js";
import { ChatRoom } from "./chat-room";

type Env = { CHAT: DurableObjectNamespace<ChatRoom> };

export { ChatRoom };

const worker = {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (url.pathname === "/api/chat") {
      // 다른 사이트에서 붙지 못하게 같은 주소에서 연 웹소켓만 받는다
      let host = "";
      try {
        host = new URL(req.headers.get("Origin") ?? "").host;
      } catch {}
      if (host !== url.host) return new Response("forbidden", { status: 403 });
      return env.CHAT.get(env.CHAT.idFromName("main")).fetch(req);
    }
    return handler.fetch(req, env, ctx);
  },
};

export default worker;
