/**
 * 밤사이 가격 페이지(/night/{slug})로 따로 내는 국내 종목. coin 은 trade.xyz 무기한선물 이름이고
 * 값은 /api/night 의 inputs(원/달러 무기한선물로 원화 환산)를 그대로 쓴다.
 */
export type NightStock = {
  slug: string;
  coin: "SMSN" | "SKHX";
  name: string;
  code: string;
  /** 이 종목이 들어 있는 국장 섹터 페이지 */
  sector: string;
  keywords: string[];
};

export const NIGHT_STOCKS: NightStock[] = [
  {
    slug: "samsung-electronics",
    coin: "SMSN",
    name: "삼성전자",
    code: "005930",
    sector: "semis",
    keywords: ["삼성전자 야간", "삼성전자 야간 주가", "삼성전자 야간 시세", "삼성전자 야간 추정가", "삼성전자 밤 시세", "삼성전자 무기한선물", "삼성전자 해외 시세", "삼성전자 내일 시가"],
  },
  {
    slug: "sk-hynix",
    coin: "SKHX",
    name: "SK하이닉스",
    code: "000660",
    sector: "semis",
    keywords: ["SK하이닉스 야간", "하이닉스 야간", "SK하이닉스 야간 주가", "SK하이닉스 야간 시세", "SK하이닉스 야간 추정가", "SK하이닉스 밤 시세", "SK하이닉스 무기한선물", "하이닉스 내일 시가"],
  },
];

export const findNightStock = (slug: string) => NIGHT_STOCKS.find((s) => s.slug === slug);

/** 종목 페이지의 자주 묻는 질문(본문과 FAQPage 구조화 데이터가 같이 쓴다) */
export function nightStockFaq(s: NightStock): [string, string][] {
  return [
    [
      `${s.name} 야간 주가는 어디서 보나요?`,
      `국내에서는 넥스트레이드 애프터마켓이 끝나는 20:00부터 다음 날 08:00 프리마켓 전까지 ${s.name}를 거래할 곳이 없습니다. 이 페이지는 그 시간에도 해외에서 24시간 거래되는 ${s.name} 무기한선물 가격을 원화로 바꿔 밤사이 흐름을 보여 줍니다.`,
    ],
    [
      `여기 가격이 실제 ${s.name} 주가인가요?`,
      `아닙니다. Hyperliquid의 trade.xyz 시장에서 거래되는 ${s.name} 무기한선물 가격(달러)에 원/달러 무기한선물 값을 곱한 참고용 추정치입니다. 거래가 국내보다 훨씬 적어 가격이 계단처럼 움직일 수 있고, 다음 날 국내 시가와 다를 수 있습니다.`,
    ],
    [
      "등락률은 무엇과 비교한 값인가요?",
      `국내 정규장이 끝난 15:45 무렵의 무기한선물 가격 대비입니다. 한국거래소 종가 대비가 아니어서, 장 마감 직후의 종가와 무기한선물 가격 차이만큼 증권사 앱의 등락률과 다를 수 있습니다.`,
    ],
    [
      "주말에도 가격이 움직이나요?",
      "무기한선물은 주말에도 거래되지만 해외 주식 시장이 쉬는 주말에는 거의 움직이지 않습니다. 월요일 국내 장이 열리기 전까지의 뉴스는 아직 가격에 다 들어가지 않았을 수 있습니다.",
    ],
  ];
}
