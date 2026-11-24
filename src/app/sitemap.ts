import { krUpdated } from "@/lib/schedule";
import { LIVE_QUOTES } from "@/lib/live-quotes";
import { INVESTORS } from "@/lib/investors13f";
import type { MetadataRoute } from "next";
import {
  MARKETS,
  industryIndexable,
  industryPages,
  sectorData,
} from "@/lib/sectors";
import { NIGHT_STOCKS } from "@/lib/night-stocks";
import { GUIDES } from "@/lib/guides";
import { DATA as RECENT } from "@/lib/investors";
import F13 from "@/data/investors-13f.json";
import { SITE_URL } from "./layout";
import { SCREENS } from "@/lib/screens";
import { THEMES } from "@/lib/themes";
import { CHANGELOG } from "@/lib/changelog";
import { EARN_INDEXABLE, econIndexable, econUpdated, openEarn, openEcon } from "@/lib/econ-pages";

type Entry = MetadataRoute.Sitemap[number];

/**
 * 실시간 화면은 값이 몇 초마다 바뀌어도 페이지 내용(제목·설명·안내 글)은 그대로라, 그 글을 마지막으로 고친 날을 적는다.
 * 요청 시각(지금)을 적으면 구글이 사이트 전체의 lastmod를 믿지 않는다(2026-11-25 외부 검색 진단).
 * 이 페이지들의 글을 고치면 여기 날짜도 함께 고친다.
 */
const PAGE_DATES = {
  home: "2026-11-25",
  night: "2026-11-25",
  nightStock: "2026-11-25",
  live: "2026-11-25",
  weekendOil: "2026-11-25",
  us: "2026-11-25",
} as const;

/**
 * 검색 로봇용 주소 목록. lastModified 는 실제로 바뀐 날만 적는다 —
 * 늘 '지금'을 적으면 구글이 이 값을 믿지 않고 무시한다.
 * 실시간 화면은 그 화면 글을 고친 날(PAGE_DATES), 자료 화면은 그 자료의 기준일, 글은 쓴 날(모르면 적지 않는다).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const day = (d: string | undefined) =>
    d ? new Date(`${d}T00:00:00+09:00`) : undefined;
  const kr = day(sectorData("kr").asof);
  const recent = day(RECENT.updated);
  const page = (k: keyof typeof PAGE_DATES) => day(PAGE_DATES[k]);
  // 가이드 목록은 가장 최근에 고친 글의 날
  const guideDay = [...GUIDES.map((g) => g.updated).filter((d): d is string => !!d)].sort().at(-1);
  const f13 = day(F13.updated);
  const at = (path: string, extra: Partial<Entry> = {}): Entry => ({
    url: `${SITE_URL}${path}`,
    ...extra,
  });

  return [
    at("", { lastModified: page("home"), changeFrequency: "hourly", priority: 1 }),
    at("/night", { lastModified: page("night"), changeFrequency: "hourly", priority: 1 }),
    ...NIGHT_STOCKS.map((s) =>
      at(`/night/${s.slug}`, {
        lastModified: page("nightStock"),
        changeFrequency: "hourly",
        priority: 0.8,
      }),
    ),
    ...LIVE_QUOTES.map((q) =>
      at(`/live/${q.slug}`, {
        lastModified: page("live"),
        changeFrequency: "hourly",
        priority: 0.8,
      }),
    ),
    at("/test", { changeFrequency: "monthly", priority: 0.7 }),
    at("/weekend-oil", {
      lastModified: page("weekendOil"),
      changeFrequency: "hourly",
      priority: 0.9,
    }),
    at("/kr", { lastModified: kr, changeFrequency: "daily", priority: 0.9 }),
    at("/us", { lastModified: page("us"), changeFrequency: "hourly", priority: 0.8 }),
    ...MARKETS.flatMap((m) =>
      sectorData(m).sectors.map((s) =>
        at(`/${m}/sector/${s.id}`, {
          lastModified: day(sectorData(m).asof),
          changeFrequency: "daily",
          priority: 0.7,
        }),
      ),
    ),
    ...MARKETS.flatMap((m) =>
      industryPages(m)
        .filter((i) => industryIndexable(m, i))
        .map((i) =>
          at(`/${m}/industry/${i.id}`, {
            lastModified: day(sectorData(m).asof),
            changeFrequency: "daily",
            priority: 0.6,
          }),
        ),
    ),
    at("/econ", {
      lastModified: day(econUpdated.slice(0, 10)),
      changeFrequency: "daily",
      priority: 0.8,
    }),
    // 지표·기업별 페이지는 발표가 일주일 안으로 다가온 것부터 차례로(2026-11-11 SK)
    // 본문이 얇은 페이지(한국은행 금리·JOLTS, 실적 페이지 전부)는 보강 전까지 빼 둔다(noindex, 2026-11-25)
    ...openEcon.filter((p) => econIndexable(p.id)).map((p) =>
      at(`/econ/${p.id}`, { lastModified: day(econUpdated.slice(0, 10)), changeFrequency: "daily", priority: 0.6 }),
    ),
    ...(EARN_INDEXABLE ? openEarn : []).map((p) =>
      at(`/econ/earnings/${p.slug}`, { lastModified: day(econUpdated.slice(0, 10)), changeFrequency: "daily", priority: 0.6 }),
    ),
    at("/schedule", {
      lastModified: krUpdated ? new Date(krUpdated) : undefined,
      changeFrequency: "daily",
      priority: 0.8,
    }),
    at("/kr/screener", {
      lastModified: kr,
      changeFrequency: "daily",
      priority: 0.8,
    }),
    ...SCREENS.map((s) =>
      at(`/kr/screener/${s.slug}`, {
        lastModified: kr,
        changeFrequency: "daily",
        priority: 0.7,
      }),
    ),
    ...THEMES.map((t) =>
      at(`/kr/theme/${t.id}`, {
        lastModified: kr,
        changeFrequency: "daily",
        priority: 0.7,
      }),
    ),
    at("/investors", {
      lastModified: recent,
      changeFrequency: "daily",
      priority: 0.7,
    }),
    ...INVESTORS.map((i) =>
      at(`/investors/${i.id}`, {
        lastModified: f13,
        changeFrequency: "weekly",
        priority: 0.5,
      }),
    ),
    at("/guide", { lastModified: day(guideDay), changeFrequency: "monthly", priority: 0.6 }),
    ...GUIDES.map((g) =>
      at(`/guide/${g.slug}`, {
        lastModified: day(g.updated),
        changeFrequency: "monthly",
        priority: 0.6,
      }),
    ),
    at("/updates", {
      lastModified: day(CHANGELOG[0].date),
      changeFrequency: "weekly",
      priority: 0.4,
    }),
    at("/about", {
      lastModified: day("2026-11-09"),
      changeFrequency: "yearly",
      priority: 0.3,
    }),
    at("/privacy", { changeFrequency: "yearly", priority: 0.2 }),
    at("/contact", { changeFrequency: "yearly", priority: 0.2 }),
  ];
}
