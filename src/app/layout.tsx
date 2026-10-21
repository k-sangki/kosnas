import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kosnas.com";
// 시크릿에 줄바꿈이 섞여 들어와도 ads.txt·스크립트 주소가 깨지지 않게 다듬는다
const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();

// Google 애널리틱스 4 측정 ID (공개 값)
const GA_ID = "G-Z3JCEMSBJT";

const DESCRIPTION = "코스피·코스닥 섹터 흐름을 한눈에. 어느 업종이 강해지고 약해지는지, 섹터 안 종목의 상대강도 순위와 시장 폭까지.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KosNas - 코스피·코스닥 섹터 흐름",
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
      <body>
        {children}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
