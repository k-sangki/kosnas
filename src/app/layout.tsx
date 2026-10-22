import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { OG_IMAGE, SITE_NAME, siteLd } from "@/lib/seo";
import { THEME_SCRIPT } from "@/lib/theme-script";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kosnas.com";
// 시크릿에 줄바꿈이 섞여 들어와도 ads.txt·스크립트 주소가 깨지지 않게 다듬는다
const ADSENSE = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() || "ca-pub-2807429912252096";

// Google 애널리틱스 4 측정 ID (공개 값)
const GA_ID = "G-Z3JCEMSBJT";

const DESCRIPTION =
  "코스피 야간선물 실시간 추정, 삼성전자·SK하이닉스·나스닥·원/달러 시세 대시보드, 코스피·코스닥 섹터 순환과 상대강도, 미국 증시 흐름을 한곳에서.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "코스나스 - 코스피 야간선물·섹터 순환 대시보드",
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ["코스나스", "KosNas", "코스피 야간선물", "야간선물 실시간", "섹터 순환", "코스피 섹터", "코스닥 섹터", "나스닥 섹터", "주도 섹터", "상대강도"],
  openGraph: { type: "website", siteName: SITE_NAME, locale: "ko_KR", title: "코스나스 - 코스피 야간선물·섹터 순환 대시보드", description: DESCRIPTION, url: "/", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  formatDetection: { telephone: false },
  other: {
    "naver-site-verification": "1f7273a6d588ea39e5b60c5c8e84f6741f5b6056",
    ...(ADSENSE ? { "google-adsense-account": ADSENSE } : {}),
  },
};

export const viewport: Viewport = {
  themeColor: "#111216",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {ADSENSE && <script async crossOrigin="anonymous" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE}`} />}
      </head>
      <body>
        <JsonLd data={siteLd(SITE_URL, DESCRIPTION)} />
        {children}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
