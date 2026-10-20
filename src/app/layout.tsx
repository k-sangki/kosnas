import type { Metadata, Viewport } from "next";
import "./globals.css";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kosnas.com";
// 시크릿에 줄바꿈이 섞여 들어와도 ads.txt·스크립트 주소가 깨지지 않게 다듬는다
const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();

const DESCRIPTION = "코스피·코스닥·나스닥 섹터 흐름을 한눈에. 어느 섹터가 강해지고 약해지는지, 섹터 안 종목의 상대강도 순위까지.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KosNas - 코스피·코스닥·나스닥 섹터 흐름",
    template: "%s | KosNas",
  },
  description: DESCRIPTION,
  applicationName: "KosNas",
  keywords: ["KosNas", "섹터 순환", "코스피 섹터", "코스닥 섹터", "나스닥 섹터", "주도 섹터", "상대강도"],
  openGraph: { type: "website", siteName: "KosNas", locale: "ko_KR", description: DESCRIPTION },
  formatDetection: { telephone: false },
  other: ADSENSE ? { "google-adsense-account": ADSENSE } : {},
};

export const viewport: Viewport = {
  themeColor: "#f2f4f6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {ADSENSE && (
          <script
            async
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
