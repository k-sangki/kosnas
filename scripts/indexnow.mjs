// 배포 뒤 바뀐 주소를 IndexNow(네이버·빙 등)에 알린다. 구글은 IndexNow를 쓰지 않아 사이트맵으로 본다.
// 기본은 사이트맵에서 최근 2일 안에 바뀐 주소만, INDEXNOW_ALL=1 이면 전부. 실패해도 배포는 실패로 치지 않는다.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kosnas.com";
const KEY = "de23a2ebf659341aa2af3ba6f44f5015"; // public/de23a2ebf659341aa2af3ba6f44f5015.txt 와 같은 값(공개 값)
const all = process.env.INDEXNOW_ALL === "1";

try {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  const since = Date.now() - 2 * 86400e3;
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map(([, u]) => ({ loc: u.match(/<loc>(.*?)<\/loc>/)?.[1], mod: u.match(/<lastmod>(.*?)<\/lastmod>/)?.[1] }))
    .filter((u) => u.loc && (all || (u.mod && Date.parse(u.mod) >= since)))
    .map((u) => u.loc);
  if (!urls.length) {
    console.log("IndexNow: 알릴 주소 없음");
  } else {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls }),
    });
    console.log(`IndexNow: ${urls.length}개 -> ${res.status}`);
    console.log(urls.join("\n"));
  }
} catch (e) {
  console.log("::warning::IndexNow 알림 실패", e);
}
