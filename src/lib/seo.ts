import type { Metadata } from "next";

/** 검색 결과에 보이는 사이트 이름. 구글은 WebSite 이름·og:site_name·제목이 같은 이름일 때 따른다 */
export const SITE_NAME = "코스나스";
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "KosNas - 코스피 야간선물 실시간 추정, 국내 섹터 순환, 미국 증시 흐름" };

/**
 * 페이지 메타데이터. 하위 페이지의 openGraph 는 상위 것을 통째로 덮으므로
 * 공유 미리보기(제목·주소·이미지)가 빠지지 않게 페이지마다 한 번에 채운다.
 */
export function pageMeta(p: { title: string; description: string; path: string; keywords?: string[] }): Metadata {
  const full = `${p.title} | ${SITE_NAME}`;
  return {
    title: p.title,
    description: p.description,
    ...(p.keywords ? { keywords: p.keywords } : {}),
    alternates: { canonical: p.path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
      title: full,
      description: p.description,
      url: p.path,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: full, description: p.description, images: [OG_IMAGE.url] },
  };
}

/** 섹터 화면 공통 검색어 */
export const SECTOR_KEYWORDS = ["섹터", "순환매", "국장 순환매", "섹터 순위", "섹터 등락", "섹터 등락률", "업종 순위", "업종 등락률", "섹터 순환"];

type Crumb = [name: string, path: string];

/** 검색 결과에 '홈 › 가이드 › …' 경로로 보이게 하는 BreadcrumbList */
export function breadcrumbLd(site: string, crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [[SITE_NAME, "/"] as Crumb, ...crumbs].map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${site}${path === "/" ? "" : path}`,
    })),
  };
}

/** 사이트 이름(검색 결과의 'KosNas' 표시)과 운영 주체 */
export function siteLd(site: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: site,
        name: SITE_NAME,
        alternateName: ["KosNas", "kosnas.com"],
        description,
        inLanguage: "ko-KR",
        publisher: { "@id": `${site}/#org` },
      },
      {
        "@type": "Organization",
        "@id": `${site}/#org`,
        name: SITE_NAME,
        url: site,
        logo: { "@type": "ImageObject", url: `${site}/icon-512.png`, width: 512, height: 512 },
        email: "contact@kosnas.com",
      },
    ],
  };
}

/** 산업 이름과 다르게 더 많이 찾는 이름(네이버 키워드 도구 2026-10-28: 2차전지·방산·HBM 관련주 등). 제목에 첫 별칭을 괄호로 붙인다 */
export const INDUSTRY_ALIASES: Record<string, string[]> = {
  메모리: ["HBM", "메모리 반도체"],
  시스템반도체: ["비메모리"],
  "배터리 셀": ["2차전지", "이차전지"],
  "배터리 소재": ["2차전지 소재", "이차전지 소재"],
  무기: ["방산", "방산주"],
  "변압기·배전반": ["전력기기"],
  "항공·우주": ["우주항공"],
};

/** 산업 관련주 페이지 이름: "무기(방산)" */
export const industryLabel = (name: string) => (INDUSTRY_ALIASES[name] ? `${name}(${INDUSTRY_ALIASES[name][0]})` : name);

/** 산업 관련주 검색어: 띄어쓴 것·붙여 쓴 것 둘 다 */
export const industryKeywords = (name: string) =>
  [name, ...(INDUSTRY_ALIASES[name] ?? [])].flatMap((n) => [n, `${n} 관련주`, `${n.replace(/\s+/g, "")}관련주`, `${n} 주가`]);
