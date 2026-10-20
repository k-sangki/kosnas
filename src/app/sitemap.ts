import type { MetadataRoute } from "next";
import { sectorData } from "@/lib/sectors";
import { SITE_URL } from "./layout";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/us", "/about", "/privacy", "/contact"];
  const sectors = (["kr", "us"] as const).flatMap((m) => sectorData(m).sectors.map((s) => `/${m}/sector/${s.id}`));
  return [...pages, ...sectors].map((p) => ({ url: `${SITE_URL}${p}` }));
}
