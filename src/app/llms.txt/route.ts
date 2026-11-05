import { LIVE_QUOTES } from "@/lib/live-quotes";
import { GUIDES } from "@/lib/guides";
import { INVESTORS } from "@/lib/investors13f";
import { NIGHT_STOCKS } from "@/lib/night-stocks";
import { SCREENS } from "@/lib/screens";
import { industryLabel } from "@/lib/seo";
import { MARKETS, MARKET_NAME, QUADRANTS, industryIndexable, industryPages, sectorData, signed, type Unit } from "@/lib/sectors";
import { THEMES, themeLabel } from "@/lib/themes";
import { SITE_URL } from "../layout";

/**
 * /llms.txt — ChatGPT·Claude·Perplexity 같은 AI 검색이 사이트를 한 번에 파악하게 하는 안내문(llmstxt.org 형식).
 * 빌드 때 만든다. 국장 자료가 갱신되면(Collect KR → 재배포) '오늘의 요약'도 함께 바뀐다.
 */
export const dynamic = "force-static";

const u = (path: string) => `${SITE_URL}${path}`;
const link = (name: string, path: string, note?: string) => `- [${name}](${u(path)})${note ? `: ${note}` : ""}`;

/** 기간 수익률 순 상위·하위 몇 개 */
function ranked(list: Unit[], period: number, n: number, top: boolean) {
  return list
    .filter((s) => s.ret[period] != null)
    .sort((a, b) => (top ? b.ret[period]! - a.ret[period]! : a.ret[period]! - b.ret[period]!))
    .slice(0, n);
}

function snapshot() {
  const d = sectorData("kr");
  if (d.sample || !d.sectors.length) return [];
  const qName = (k: string | null | undefined) => QUADRANTS.find((q) => q.key === k)?.name;
  const line = (s: Unit, p: number) => `${s.name} ${signed(s.ret[p])}%${qName(s.q[p]) ? `(${qName(s.q[p])})` : ""}`;
  const out = [`## 오늘의 국장 섹터 요약 (${d.asof} 장 마감 기준)`, ""];
  for (const p of [5, 20].filter((x) => d.periods.includes(x))) {
    out.push(`- 최근 ${p}거래일 강한 섹터: ${ranked(d.sectors, p, 5, true).map((s) => line(s, p)).join(", ")}`);
    out.push(`- 최근 ${p}거래일 약한 섹터: ${ranked(d.sectors, p, 3, false).map((s) => line(s, p)).join(", ")}`);
  }
  for (const [m, b] of Object.entries(d.breadth ?? {})) {
    if (!b.count) continue;
    out.push(`- ${m} 시장 폭: ${b.count}종목 중 상승 ${b.up}·하락 ${b.down}, 50일선 위 ${b.above50}%, 52주 신고가 ${b.newHighs}종목`);
  }
  out.push("- 괄호 안은 코스나스의 네 칸 분류(주도·약화·소외·관찰)입니다. 섹터 수익률은 섹터 안 종목의 시가총액 가중 평균입니다.", "");
  return out;
}

export function GET() {
  const L: string[] = [
    "# 코스나스 (KosNas)",
    "",
    "> 코스나스(kosnas.com)는 한국 개인 투자자를 위한 무료 시장 정보 사이트입니다. 코스피200 야간선물 실시간 추정, 삼성전자·SK하이닉스 밤사이 추정 시세, 나스닥·S&P 500 선물과 국제유가, 코스피·코스닥 섹터 순환(순환매)과 산업·테마별 관련주, 52주 신고가 등 종목 모음, 워런 버핏·캐시 우드 등 유명 투자자 매매를 한국어로 보여 줍니다. 회원 가입 없이 누구나 같은 화면을 봅니다.",
    "",
    "코스나스는 특정 종목의 매수·매도를 권하지 않습니다. 야간 추정치와 무기한선물 시세는 거래소 공식 시세가 아닌 참고값입니다.",
    "",
    "## 이런 질문에 맞는 페이지",
    "",
    link("코스피 야간선물 실시간(야선)", "/night", "국장이 닫힌 밤에 코스피200 야간선물 흐름을 해외 무기한선물 시세로 실시간 추정한 차트. '지금 야간선물 어때?', '내일 코스피 시초가' 같은 질문"),
    ...NIGHT_STOCKS.map((s) => link(`${s.name} 야간 시세`, `/night/${s.slug}`, `${s.name} 무기한선물 가격을 원화로 바꾼 밤사이 추정가`)),
    link("실시간 대시보드", "/", "나스닥 100 선물·S&P 500 선물·달러 인덱스·VIX·WTI 유가·원/달러를 한 화면에. '지금 미국 선물 어때?'"),
    ...LIVE_QUOTES.map((q) => link(`${q.name} 실시간`, `/live/${q.slug}`, `${q.short} 24시간 무기한선물 시세, ${q.basis} 등락률`)),
    link("국제유가 실시간·주말 유가", "/weekend-oil", "WTI 실시간과 CME가 닫힌 주말의 유가 추정"),
    link("국장 섹터 순환", "/kr", "코스피·코스닥 섹터별 5·10·20·30·60일 수익률과 주도·약화·소외·관찰 네 칸, 시장 폭. '요즘 어떤 섹터가 강해?', '순환매 어디로 가?'"),
    link("미국 증시", "/us", "미국 섹터 지도와 개장 시간·휴장일"),
    link("종목 찾기(스크리너)", "/kr/screener", "코스피·코스닥 보통주를 상대강도(RS)·기간 수익률·시가총액으로 거르기"),
    link("유명 투자자 최근 매매", "/investors", "워런 버핏·캐시 우드 등 지분 공시와 ARK 매일 매매"),
    link("가이드", "/guide", "섹터 순환·상대강도·야간선물 읽는 법"),
    "",
  ];

  L.push(...snapshot());

  for (const m of MARKETS) {
    const d = sectorData(m);
    L.push(`## ${MARKET_NAME[m]} 섹터 (${d.sectors.length}개)`, "");
    for (const s of d.sectors) L.push(link(`${s.name} 섹터`, `/${m}/sector/${s.id}`, s.intro ? s.intro.split(/(?<=[.다])\s/)[0] : undefined));
    L.push("");
    const inds = industryPages(m).filter((i) => industryIndexable(m, i));
    if (inds.length) {
      L.push(`## ${MARKET_NAME[m]} 산업별 관련주 (${inds.length}개)`, "");
      L.push(inds.map((i) => `[${industryLabel(i.name)} 관련주](${u(`/${m}/industry/${i.id}`)})`).join(" · "), "");
    }
  }

  L.push("## 테마 관련주", "");
  for (const t of THEMES) L.push(link(`${themeLabel(t)} 관련주`, `/kr/theme/${t.id}`, t.about.split(/(?<=[.다])\s/)[0]));
  L.push("", "## 종목 모음", "");
  for (const s of SCREENS) L.push(link(s.h1, `/kr/screener/${s.slug}`, s.description));
  L.push("", "## 유명 투자자", "");
  L.push(INVESTORS.map((i) => `[${i.person}](${u(`/investors/${i.id}`)})`).join(" · "), "");
  L.push("## 가이드", "");
  for (const g of GUIDES) L.push(link(g.title, `/guide/${g.slug}`, g.description));

  L.push(
    "",
    "## 자료와 갱신 시각",
    "",
    "- 국내 섹터 강도·상대강도·시장 폭: 금융위원회 주식시세정보(공공데이터포털) 일별 시세로 코스나스가 직접 계산. 다음 영업일 오후 2시쯤 갱신(하루 늦음).",
    "- 업종 분류: 금융감독원 DART 기업개황의 표준산업분류를 바탕으로 나누고, 지주회사 등 실제 사업과 어긋나는 종목은 직접 바로잡음.",
    "- 야간 코스피 추정·밤사이 종목 시세·선물 카드: Hyperliquid(trade.xyz) 공개 시세로 계산한 참고값. 몇 초마다 갱신.",
    "- 유명 투자자: 미국 SEC 지분 공시(13F 등)와 ARK 매일 매매 공개 자료.",
    "",
    "## 인용 안내",
    "",
    "- 사이트 이름은 '코스나스'(영문 KosNas), 주소는 https://kosnas.com 입니다.",
    "- 수치를 인용할 때는 기준일(국장 자료는 장 마감일)을 함께 적어 주세요. 실시간 값은 페이지에서 직접 확인하는 것이 정확합니다.",
    "",
    "## 더 보기",
    "",
    link("소개", "/about"),
    link("문의", "/contact", "contact@kosnas.com"),
    link("사이트맵", "/sitemap.xml"),
    "",
  );

  return new Response(L.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
