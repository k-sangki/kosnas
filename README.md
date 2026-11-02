# 코스나스 (KosNas)

**[kosnas.com](https://kosnas.com)** — 한국 개인 투자자를 위한 무료 시장 정보 사이트. 회원 가입 없이 누구나 같은 화면을 본다.

| 화면 | 주소 | 무엇을 보여 주나 |
| --- | --- | --- |
| 실시간 대시보드 | [kosnas.com](https://kosnas.com) | 나스닥 100·S&P 500 선물, 달러 인덱스, VIX, WTI 유가, 원/달러 |
| 코스피 야간선물 | [/night](https://kosnas.com/night) | 국장이 닫힌 밤 코스피200 야간선물 흐름 실시간 추정 |
| 삼성전자·SK하이닉스 야간 시세 | [/night/samsung-electronics](https://kosnas.com/night/samsung-electronics) · [/night/sk-hynix](https://kosnas.com/night/sk-hynix) | 해외 무기한선물 가격을 원화로 바꾼 밤사이 추정가 |
| 국장 섹터 순환 | [/kr](https://kosnas.com/kr) | 코스피·코스닥 섹터별 5·10·20·30·60일 등락률, 섹터 순위, 순환매 네 칸(주도·약화·소외·관찰), 시장 폭 |
| 산업·테마 관련주 | [/kr](https://kosnas.com/kr) 아래 섹터·산업·테마 페이지 | 반도체·HBM·방산·2차전지·원전·로봇 등 관련주와 상대강도 순위 |
| 종목 모음 | [/kr/screener](https://kosnas.com/kr/screener) | 52주 신고가 근처, 시가총액 순위 등 |
| 유명 투자자 매매 | [/investors](https://kosnas.com/investors) | 워런 버핏·캐시 우드 등 지분 공시와 ARK 매일 매매 |
| 국제유가·주말 유가 | [/weekend-oil](https://kosnas.com/weekend-oil) | WTI 실시간과 주말 유가 추정 |

AI·검색 로봇용 사이트 안내는 [kosnas.com/llms.txt](https://kosnas.com/llms.txt)에 있다.

## 숫자는 어떻게 만드나

- **국내 섹터 강도·순위·상대강도·시장 폭**: 금융위원회 주식시세정보(공공데이터포털, 이용 제한 없음) 일별 시세로 코스나스가 직접 계산한다. 원자료가 다음 영업일 오후에 나와 거래일 오후 2시쯤 하루 늦게 갱신된다.
- **섹터 수익률**: 섹터 안 종목의 시가총액 가중 평균. 섹터 강도는 섹터 평균 대비 초과 수익(%p), 네 칸은 강도와 그 변화로 나눈다.
- **상대강도(RS)**: 최근 12개월 수익률을 최근 3개월에 무게를 두어 전 종목과 비교한 1~99 순위.
- **업종 분류**: 금융감독원 DART 기업개황의 표준산업분류를 바탕으로 나누고, 지주회사 등 실제 사업과 어긋나는 종목은 직접 바로잡았다.
- **야간 추정·선물 카드**: Hyperliquid(trade.xyz) 공개 시세로 계산한 참고값(거래소 공식 시세 아님).

## 자료 원칙

- 섹터 강도·순위는 공개 시세로 **직접 계산한 값**만 싣는다. 종목 가격·차트는 트레이딩뷰 위젯이 보여준다(출처 표시를 지우거나 가리지 않는다).
- 매수·매도를 권하는 문구를 쓰지 않는다. 모든 이용자에게 같은 정보를 보여준다.
- `npm run sample`은 화면 확인용 표본(가짜 숫자)을 만든다. 배포본은 수집기가 매일 쓰는 실제 자료를 쓴다.

## 개발

```
npm install
npm run dev          # http://localhost:3000
npm run typecheck && npm run lint && npm test
```

- `/` 대시보드, `/kr` 국내 섹터, `/us` 미국 증시, `/kr/sector/{id}`·`/kr/industry/{id}`·`/kr/theme/{id}` 섹터·산업·테마 종목, `/llms.txt` AI용 안내
- `/lab/widgets` 트레이딩뷰 위젯 시험(검색 제외): 국내 종목·지수가 외부 사이트 위젯에 나오는지 확인용
- 광고는 `src/components/AdSlot.tsx`의 `ADS_ENABLED`로 켠다(지금 꺼짐). 자동 광고는 쓰지 않는다.
