import { SITE_URL } from "../layout";

/** robots.txt. 다음 웹마스터도구 소유 확인 줄(주석)을 넣으려고 직접 쓴다 */
export const dynamic = "force-static";

export function GET() {
  const body = [
    "#DaumWebMasterTool:34be2ef12b4f7268ef1fd3397e275c081c6953df8502fde647475cc8ac79ab2a:RXqVBM7XE5wroppTXsoV6g==",
    "User-Agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /lab/",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
