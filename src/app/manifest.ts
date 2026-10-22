import type { MetadataRoute } from "next";

/** 휴대폰 홈 화면에 앱처럼 추가할 때 쓰는 정보. 아이콘은 로고의 k•n(위 빨강·아래 파랑) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "코스나스 - 코스피 야간선물·섹터 순환 대시보드",
    short_name: "코스나스",
    description: "코스피 야간선물 실시간 추정, 시세 대시보드, 코스피·코스닥 섹터 순환, 미국 증시 흐름",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#16181f",
    theme_color: "#111216",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
