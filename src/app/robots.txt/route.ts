import { SITE_URL } from "../layout";

/** robots.txt. 다음 웹마스터도구 소유 확인 줄(주석)을 넣으려고 직접 쓴다 */
export const dynamic = "force-static";

/**
 * AI 검색·답변 로봇. ChatGPT·Claude·Perplexity·Gemini 답변에 코스나스가 인용되도록 이름을 적어 허용한다(2026-11-02 SK).
 * Cloudflare 관리형 robots.txt·'AI 봇 차단'이 켜져 있으면 그쪽이 앞에서 막으므로 대시보드에서 꺼야 한다.
 */
const AI_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

export function GET() {
  const body = [
    "#DaumWebMasterTool:34be2ef12b4f7268ef1fd3397e275c081c6953df8502fde647475cc8ac79ab2a:RXqVBM7XE5wroppTXsoV6g==",
    "User-Agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /lab/",
    "",
    ...AI_BOTS.map((b) => `User-Agent: ${b}`),
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /lab/",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
