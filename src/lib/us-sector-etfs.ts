/** 미장 섹터 ETF(트레이딩뷰 심볼, 이름). 섹터 지도 아래 시세와 메타·본문 검색어가 같이 쓴다 */
export const US_SECTOR_ETFS: [string, string][] = [
  ["AMEX:XLK", "기술"],
  ["NASDAQ:SMH", "반도체"],
  ["AMEX:XLC", "커뮤니케이션"],
  ["AMEX:XLY", "임의소비재"],
  ["AMEX:XLF", "금융"],
  ["AMEX:XLV", "헬스케어"],
  ["AMEX:XLI", "산업재"],
  ["AMEX:XLE", "에너지"],
  ["AMEX:XLB", "소재"],
  ["AMEX:XLU", "유틸리티"],
  ["AMEX:XLRE", "부동산"],
  ["AMEX:XLP", "필수소비재"],
];

export const US_SECTOR_NAMES = US_SECTOR_ETFS.map(([, name]) => name);
