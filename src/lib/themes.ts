/**
 * 테마 관련주 페이지(/kr/theme/{id}). 업종 분류로는 한 칸에 모이지 않지만 '로봇 관련주'처럼
 * 묶어 찾는 종목들이다. 종목 목록은 collector/themes.py 가 고르고 값은 src/data/kr-themes.json 에 있다.
 * 검색어는 네이버 키워드 도구(2026-10-28): 로봇관련주 7,740 · ESS관련주 6,010 · 원전관련주 5,800 · 양자컴퓨터관련주 4,300(월간).
 */
import raw from "@/data/kr-themes.json";
import { capText } from "./screens";
import { signed } from "./sectors";

export interface ThemeStock {
  code: string;
  name: string;
  market: string;
  rs: number | null;
  close: number;
  chg: number | null;
  fromHigh: number | null;
  above50: boolean;
  capEok: number;
  base: boolean;
  industry: string | null;
  r: Record<string, number | null>;
  note: string;
}

export interface Theme {
  id: string;
  name: string;
  /** 제목에 붙이는 다른 이름 */
  alias?: string;
  /** 검색어(붙여 쓴 것·띄어 쓴 것) */
  keywords: string[];
  /** 이 테마가 무엇인지(본문 첫 설명) */
  about: string;
  /** 무엇이 주가를 움직이나(접힌 설명) */
  drivers: string;
  /** 함께 볼 섹터·산업 페이지 */
  related: [name: string, path: string][];
}

export const THEMES: Theme[] = [
  {
    id: "robot",
    name: "로봇",
    alias: "휴머노이드",
    keywords: ["로봇 관련주", "로봇관련주", "로봇 대장주", "로봇대장주", "로봇주", "휴머노이드 관련주", "협동로봇 관련주", "감속기 관련주", "로봇 테마"],
    about:
      "로봇 관련주는 산업용·협동로봇과 휴머노이드를 만드는 회사, 그리고 로봇에 들어가는 감속기·모터·구동기·제어기 같은 부품 회사를 묶은 것입니다. 업종 분류로는 기계·전력기기·전자부품에 흩어져 있어 섹터 표만으로는 한눈에 보이지 않습니다.",
    drivers:
      "로봇 관련주는 실적보다 기대가 먼저 움직이는 경우가 많습니다. 해외 휴머노이드 발표, 대기업의 로봇 회사 지분 투자, 정부 지원 정책 소식에 한꺼번에 오르고, 기대가 식으면 함께 빠집니다. 완제품(로봇) 회사와 부품(감속기·모터) 회사는 수주가 나는 시점이 달라 같은 날에도 다르게 움직일 수 있습니다.",
    related: [
      ["기계 섹터", "/kr/sector/machinery"],
      ["전력기기 섹터", "/kr/sector/power"],
    ],
  },
  {
    id: "ess",
    name: "ESS",
    alias: "에너지저장장치",
    keywords: ["ESS 관련주", "ESS관련주", "ESS 대장주", "ESS대장주", "에너지저장장치 관련주", "ESS 배터리 관련주", "ESS주", "ESS 테마"],
    about:
      "ESS(에너지저장장치) 관련주는 전기를 저장했다가 필요할 때 내보내는 대형 배터리 설비와 관련된 회사입니다. 배터리 셀·양극재 회사, 배터리를 담는 함체와 전력 변환·배전 장치, 냉각 장치, ESS 운영 회사까지 묶었습니다.",
    drivers:
      "ESS 수요는 태양광·풍력처럼 발전량이 들쭉날쭉한 전기를 저장해야 할 때, 그리고 AI 데이터센터처럼 전기를 많이 쓰는 곳에 예비 전원이 필요할 때 커집니다. 미국 전력망 투자·관세 정책, 리튬인산철(LFP) 배터리 가격, 국내외 대형 수주 소식에 함께 움직입니다.",
    related: [
      ["2차전지 섹터", "/kr/sector/battery"],
      ["전력기기 섹터", "/kr/sector/power"],
    ],
  },
  {
    id: "nuclear",
    name: "원전",
    alias: "원자력",
    keywords: ["원전 관련주", "원전관련주", "원자력 관련주", "원자력관련주", "원전 대장주", "원전대장주", "원전주", "SMR 관련주", "소형모듈원전 관련주", "원전 테마"],
    about:
      "원전 관련주는 원자력 발전소를 설계·시공·정비하는 회사와 원자로·증기발생기 같은 주기기, 계측·제어 장치, 밸브·배전반 같은 기자재를 만드는 회사를 묶은 것입니다. 대형 원전과 소형모듈원전(SMR)을 함께 다룹니다.",
    drivers:
      "원전 관련주는 해외 원전 수주(체코·중동·미국 등), 정부의 에너지 정책, AI 데이터센터 전력 수요 기대, SMR 협력 발표에 함께 움직입니다. 설계·주기기 회사는 수주 발표 때, 정비·기자재 회사는 실제 공사가 진행되는 몇 년 동안 실적에 반영되는 편입니다.",
    related: [
      ["전력기기 섹터", "/kr/sector/power"],
      ["건설·자재 섹터", "/kr/sector/construction"],
      ["유틸리티 섹터", "/kr/sector/utilities"],
    ],
  },
  {
    id: "quantum",
    name: "양자컴퓨터",
    alias: "양자암호",
    keywords: ["양자컴퓨터 관련주", "양자컴퓨터관련주", "양자컴퓨터 대장주", "양자컴퓨터대장주", "양자 관련주", "양자암호 관련주", "양자암호통신 관련주", "양자내성암호 관련주", "양자주"],
    about:
      "국내 양자컴퓨터 관련주는 양자컴퓨터를 직접 만드는 회사라기보다 양자암호통신과 양자내성암호(양자컴퓨터로도 풀기 어려운 암호) 사업을 하는 통신·보안 회사가 대부분입니다. 통신 3사와 양자암호 장비·부품, 보안 소프트웨어·칩 회사를 묶었습니다.",
    drivers:
      "양자 관련주는 아이온큐·구글·IBM 같은 해외 양자컴퓨터 회사의 발표와 주가에 크게 반응합니다. 매출에서 양자 사업이 차지하는 몫이 작은 회사가 많아, 소식이 나온 날에는 함께 급등락하다가 다시 원래 사업 실적대로 돌아가는 일이 잦습니다.",
    related: [
      ["통신 섹터", "/kr/sector/telecom"],
      ["인터넷·소프트웨어 섹터", "/kr/sector/internet"],
    ],
  },
];

const DATA = raw as { asof: string; sparkFrom: string | null; themes: Record<string, { stocks: ThemeStock[]; ret: Record<string, number | null> }> };

export const themeAsof = DATA.asof;
export const themeSparkFrom = DATA.sparkFrom ?? undefined;

export const findTheme = (id: string) => THEMES.find((t) => t.id === id);

/** 시총 큰 순 종목과 테마 평균 등락률(종목 단순 평균) */
export const themeData = (id: string) => DATA.themes[id] ?? { stocks: [], ret: {} };

/** '로봇(휴머노이드)' */
export const themeLabel = (t: Theme) => (t.alias ? `${t.name}(${t.alias})` : t.name);

/** 자주 묻는 질문(본문과 FAQPage 구조화 데이터가 같이 쓴다) */
export function themeFaq(t: Theme): [string, string][] {
  const { stocks, ret } = themeData(t.id);
  const top = stocks.slice(0, 3);
  const byR20 = [...stocks].filter((s) => s.r["20"] != null).sort((a, b) => b.r["20"]! - a.r["20"]!);
  const best = byR20[0];
  const out: [string, string][] = [];
  if (top.length)
    out.push([
      `${t.name} 대장주는 어디인가요?`,
      `시가총액 기준으로는 ${top.map((s) => `${s.name}(${capText(s.capEok)}, ${s.note})`).join(", ")} 순입니다(${DATA.asof} 종가). 대장주는 보통 시가총액이 크고 테마 소식에 가장 먼저 반응하는 종목을 말하는데, 시점마다 달라질 수 있습니다.`,
    ]);
  out.push([
    `${t.name} 관련주는 몇 종목인가요?`,
    `코스나스가 사업 내용을 보고 고른 ${t.name} 관련주는 ${stocks.length}종목입니다.${ret["20"] != null ? ` 최근 20거래일 평균 등락률은 ${signed(ret["20"])}%` : ""}${
      best ? `, 같은 기간 가장 많이 오른 종목은 ${best.name}(${signed(best.r["20"])}%)입니다.` : "."
    }`,
  ]);
  out.push([
    "관련주는 어떻게 골랐나요?",
    "회사의 사업보고서와 공시에 적힌 사업 내용에 그 테마의 제품·서비스가 있는 코스피·코스닥 보통주를 골랐습니다. 테마 매출 비중이 작은 회사도 있으니 종목별 '관련 사업'을 함께 보세요. 특정 종목의 매수·매도를 권하지 않습니다.",
  ]);
  return out;
}
