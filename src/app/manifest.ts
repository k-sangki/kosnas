import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KosNas - 코스피·코스닥·나스닥 섹터 흐름",
    short_name: "KosNas",
    description: "코스피·코스닥·나스닥 섹터 흐름을 한눈에",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2f4f6",
    theme_color: "#f2f4f6",
    lang: "ko",
  };
}
