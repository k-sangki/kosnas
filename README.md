# KosNas

코스피·코스닥·나스닥 섹터 흐름을 보여주는 웹/모바일 사이트. 디자인은 트립날씨(tripnal)와 같은 바탕이고, Next.js + OpenNext로 Cloudflare Workers에 올린다.

## 자료 원칙

- 섹터 강도·순위는 공개 시세로 **직접 계산한 값**만 싣는다. 종목 가격·차트는 트레이딩뷰 위젯이 보여준다(출처 표시를 지우거나 가리지 않는다).
- 국내 원천은 금융위원회 주식시세정보(공공데이터포털, 이용 제한 없음, 다음 영업일 13시 뒤 제공). 미국 원천은 정하는 중.
- 매수·매도를 권하는 문구를 쓰지 않는다. 모든 이용자에게 같은 정보를 보여준다.
- 지금 `src/data/*.json`은 화면 확인용 **표본**(가짜 숫자, `npm run sample`로 생성)이다.

## 개발

```
npm install
npm run dev          # http://localhost:3000
npm run typecheck && npm run lint && npm test
```

- `/` 국내 섹터, `/us` 미국 섹터, `/{kr|us}/sector/{id}` 섹터 종목
- `/lab/widgets` 트레이딩뷰 위젯 시험(검색 제외): 국내 종목·지수가 외부 사이트 위젯에 나오는지 확인용
- 광고는 `src/components/AdSlot.tsx`의 `ADS_ENABLED`로 켠다(지금 꺼짐). 자동 광고는 쓰지 않는다.
