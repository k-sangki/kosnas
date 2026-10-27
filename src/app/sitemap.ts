import { INVESTORS } from "@/lib/investors13f";
import type { MetadataRoute } from "next";
import { MARKETS, industryPages, sectorData } from "@/lib/sectors";
import { NIGHT_STOCKS } from "@/lib/night-stocks";
import { GUIDES } from "@/lib/guides";
import { DATA as RECENT } from "@/lib/investors";
import F13 from "@/data/investors-13f.json";
import { SITE_URL } from "./layout";
import { SCREENS } from "@/lib/screens";

type Entry = MetadataRoute.Sitemap[number];

/**
 * 검색 로봇용 주소 목록. lastModified 는 실제로 바뀐 날만 적는다 —
 * 늘 '지금'을 적으면 구글이 이 값을 믿지 않고 무시한다.
 * 실시간 화면만 지금, 자료 화면은 그 자료의 기준일, 글은 적지 않는다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const day = (d: string | undefined) => (d ? new Date(`${d}T00:00:00+09:00`) : undefined);
  const kr = day(sectorData("kr").asof);
  const recent = day(RECENT.updated);
  const f13 = day(F13.updated);
  const at = (path: string, extra: Partial<Entry> = {}): Entry => ({ url: `${SITE_URL}${path}`, ...extra });

  return [
    at("", { lastModified: now, changeFrequency: "hourly", priority: 1 }),
    at("/night", { lastModified: now, changeFrequency: "hourly", priority: 1 }),
    ...NIGHT_STOCKS.map((s) => at(`/night/${s.slug}`, { lastModified: now, changeFrequency: "hourly", priority: 0.8 })),
    at("/weekend-oil", { lastModified: now, changeFrequency: "hourly", priority: 0.9 }),
    at("/kr", { lastModified: kr, changeFrequency: "daily", priority: 0.9 }),
    at("/us", { lastModified: now, changeFrequency: "hourly", priority: 0.8 }),
    ...MARKETS.flatMap((m) =>
      sectorData(m).sectors.map((s) => at(`/${m}/sector/${s.id}`, { lastModified: day(sectorData(m).asof), changeFrequency: "daily", priority: 0.7 })),
    ),
    ...MARKETS.flatMap((m) =>
      industryPages(m).map((i) => at(`/${m}/industry/${i.id}`, { lastModified: day(sectorData(m).asof), changeFrequency: "daily", priority: 0.6 })),
    ),
    at("/kr/screener", { lastModified: kr, changeFrequency: "daily", priority: 0.8 }),
    ...SCREENS.map((s) => at(`/kr/screener/${s.slug}`, { lastModified: kr, changeFrequency: "daily", priority: 0.7 })),
    at("/investors", { lastModified: recent, changeFrequency: "daily", priority: 0.7 }),
    ...INVESTORS.map((i) => at(`/investors/${i.id}`, { lastModified: f13, changeFrequency: "weekly", priority: 0.5 })),
    at("/guide", { changeFrequency: "monthly", priority: 0.6 }),
    ...GUIDES.map((g) => at(`/guide/${g.slug}`, { changeFrequency: "monthly", priority: 0.6 })),
    at("/about", { changeFrequency: "yearly", priority: 0.3 }),
    at("/privacy", { changeFrequency: "yearly", priority: 0.2 }),
    at("/contact", { changeFrequency: "yearly", priority: 0.2 }),
  ];
}
