import type { MetadataRoute } from "next";
import { MARKETS, sectorData } from "@/lib/sectors";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "./layout";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/kr", "/night", "/us", ...GUIDES.map((g) => `/guide/${g.slug}`), "/guide", "/investors", "/about", "/privacy", "/contact"];
  const sectors = MARKETS.flatMap((m) => sectorData(m).sectors.map((s) => `/${m}/sector/${s.id}`));
  const now = new Date();
  // 실시간 화면은 자주 바뀐다고 알려 검색 로봇이 자주 오게 한다
  const live: Record<string, Partial<MetadataRoute.Sitemap[number]>> = {
    "": { changeFrequency: "hourly", priority: 1 },
    "/night": { changeFrequency: "hourly", priority: 1 },
    "/us": { changeFrequency: "hourly", priority: 0.8 },
    "/kr": { changeFrequency: "daily", priority: 0.9 },
  };
  return [...pages, ...sectors].map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, ...live[p] }));
}
