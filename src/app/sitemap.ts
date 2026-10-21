import type { MetadataRoute } from "next";
import { MARKETS, US_ENABLED, sectorData } from "@/lib/sectors";
import { GUIDES } from "@/lib/guides";
import { SITE_URL } from "./layout";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/night", ...(US_ENABLED ? ["/us"] : []), ...GUIDES.map((g) => `/guide/${g.slug}`), "/guide", "/about", "/privacy", "/contact"];
  const sectors = MARKETS.flatMap((m) => sectorData(m).sectors.map((s) => `/${m}/sector/${s.id}`));
  return [...pages, ...sectors].map((p) => ({ url: `${SITE_URL}${p}` }));
}
