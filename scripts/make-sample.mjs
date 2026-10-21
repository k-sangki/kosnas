// 0단계 화면 확인용 표본 자료를 만든다. 숫자는 모두 가짜(고정 난수)이고 종목 이름·티커만 실제다.
// 수집기가 붙으면 같은 모양의 자료를 collector가 만든다. 실행: npm run sample
import { writeFileSync } from "node:fs";

const PERIODS = [5, 10, 20, 30, 60];

const KR = {
  "semis": ["반도체", [["005930", "삼성전자"], ["000660", "SK하이닉스"], ["042700", "한미반도체"], ["240810", "원익IPS"], ["058470", "리노공업"]]],
  "battery": ["2차전지", [["373220", "LG에너지솔루션"], ["006400", "삼성SDI"], ["247540", "에코프로비엠"], ["086520", "에코프로"], ["003670", "포스코퓨처엠"]]],
  "power": ["전력", [["267260", "HD현대일렉트릭"], ["298040", "효성중공업"], ["010120", "LS ELECTRIC"], ["006260", "LS"], ["103590", "일진전기"]]],
  "ship": ["조선", [["329180", "HD현대중공업"], ["009540", "HD한국조선해양"], ["042660", "한화오션"], ["010140", "삼성중공업"], ["010620", "HD현대미포"]]],
  "defense": ["방산", [["012450", "한화에어로스페이스"], ["079550", "LIG넥스원"], ["064350", "현대로템"], ["047810", "한국항공우주"], ["103140", "풍산"]]],
  "bio": ["바이오", [["207940", "삼성바이오로직스"], ["068270", "셀트리온"], ["196170", "알테오젠"], ["000100", "유한양행"], ["128940", "한미약품"]]],
  "auto": ["자동차", [["005380", "현대차"], ["000270", "기아"], ["012330", "현대모비스"], ["204320", "HL만도"], ["011210", "현대위아"]]],
  "bank": ["금융", [["105560", "KB금융"], ["055550", "신한지주"], ["086790", "하나금융지주"], ["316140", "우리금융지주"], ["138040", "메리츠금융지주"]]],
  "internet": ["인터넷", [["035420", "NAVER"], ["035720", "카카오"], ["259960", "크래프톤"], ["036570", "엔씨소프트"], ["251270", "넷마블"]]],
  "nuclear": ["원전", [["034020", "두산에너빌리티"], ["052690", "한전기술"], ["051600", "한전KPS"], ["083650", "비에이치아이"], ["105840", "우진"]]],
  "cosmetics": ["화장품", [["090430", "아모레퍼시픽"], ["192820", "코스맥스"], ["161890", "한국콜마"], ["278470", "에이피알"], ["018290", "브이티"]]],
  "steel": ["철강", [["005490", "POSCO홀딩스"], ["004020", "현대제철"], ["001230", "동국홀딩스"], ["460860", "동국제강"], ["014820", "동원시스템즈"]]],
};

const US = {
  "tech": ["기술", [["NASDAQ:NVDA", "NVIDIA"], ["NASDAQ:AAPL", "Apple"], ["NASDAQ:MSFT", "Microsoft"], ["NASDAQ:AVGO", "Broadcom"], ["NASDAQ:AMD", "AMD"]]],
  "comm": ["커뮤니케이션", [["NASDAQ:GOOGL", "Alphabet"], ["NASDAQ:META", "Meta"], ["NASDAQ:NFLX", "Netflix"], ["NYSE:DIS", "Disney"], ["NASDAQ:TMUS", "T-Mobile"]]],
  "discretionary": ["경기소비재", [["NASDAQ:AMZN", "Amazon"], ["NASDAQ:TSLA", "Tesla"], ["NYSE:HD", "Home Depot"], ["NYSE:MCD", "McDonald's"], ["NASDAQ:BKNG", "Booking"]]],
  "staples": ["필수소비재", [["NASDAQ:COST", "Costco"], ["NYSE:WMT", "Walmart"], ["NYSE:PG", "Procter & Gamble"], ["NYSE:KO", "Coca-Cola"], ["NASDAQ:PEP", "PepsiCo"]]],
  "health": ["헬스케어", [["NYSE:LLY", "Eli Lilly"], ["NYSE:UNH", "UnitedHealth"], ["NYSE:JNJ", "Johnson & Johnson"], ["NYSE:ABBV", "AbbVie"], ["NASDAQ:ISRG", "Intuitive Surgical"]]],
  "financials": ["금융", [["NYSE:JPM", "JPMorgan"], ["NYSE:V", "Visa"], ["NYSE:MA", "Mastercard"], ["NYSE:BAC", "Bank of America"], ["NYSE:GS", "Goldman Sachs"]]],
  "industrials": ["산업재", [["NYSE:GE", "GE Aerospace"], ["NYSE:CAT", "Caterpillar"], ["NYSE:RTX", "RTX"], ["NYSE:UBER", "Uber"], ["NYSE:ETN", "Eaton"]]],
  "energy": ["에너지", [["NYSE:XOM", "Exxon Mobil"], ["NYSE:CVX", "Chevron"], ["NYSE:COP", "ConocoPhillips"], ["NYSE:SLB", "SLB"], ["NYSE:EOG", "EOG Resources"]]],
  "utilities": ["유틸리티", [["NYSE:NEE", "NextEra"], ["NYSE:SO", "Southern"], ["NASDAQ:CEG", "Constellation"], ["NYSE:VST", "Vistra"], ["NYSE:DUK", "Duke Energy"]]],
  "materials": ["소재", [["NYSE:LIN", "Linde"], ["NYSE:SHW", "Sherwin-Williams"], ["NYSE:FCX", "Freeport-McMoRan"], ["NYSE:NEM", "Newmont"], ["NYSE:ECL", "Ecolab"]]],
  "realestate": ["부동산", [["NYSE:PLD", "Prologis"], ["NASDAQ:EQIX", "Equinix"], ["NYSE:AMT", "American Tower"], ["NYSE:WELL", "Welltower"], ["NYSE:O", "Realty Income"]]],
};

// 고정 난수 (mulberry32) — 실행할 때마다 같은 표본이 나온다
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v) => Math.round(v * 100) / 100;

function quadrant(x, y) {
  if (x >= 0) return y >= 0 ? "lead" : "weaken";
  return y >= 0 ? "watch" : "lag";
}

function build(market, table, seed) {
  const r = rng(seed);
  const raw = Object.entries(table).map(([id, [name, stocks]]) => ({
    id,
    name,
    ret: Object.fromEntries(PERIODS.map((p) => [p, round((r() - 0.45) * p * 0.9)])),
    prevX: Object.fromEntries(PERIODS.map((p) => [p, round((r() - 0.5) * p * 0.6)])),
    above50: Math.round(r() * 100),
    newHighs: Math.floor(r() * 4),
    stocks: stocks
      .map(([code, sname]) => ({
        code,
        name: sname,
        tv: market === "kr" ? `KRX:${code}` : code,
        rs: Math.round(20 + r() * 79),
      }))
      .sort((a, b) => b.rs - a.rs),
  }));
  const mean = Object.fromEntries(PERIODS.map((p) => [p, raw.reduce((s, x) => s + x.ret[p], 0) / raw.length]));
  const sectors = raw.map(({ prevX, ...s }) => {
    const x = Object.fromEntries(PERIODS.map((p) => [p, round(s.ret[p] - mean[p])]));
    const y = Object.fromEntries(PERIODS.map((p) => [p, round(x[p] - prevX[p])]));
    const q = Object.fromEntries(PERIODS.map((p) => [p, quadrant(x[p], y[p])]));
    // 이동선: 앞쪽에서 오늘 위치로 흔들리며 다가오는 가짜 경로
    const path = Object.fromEntries(
      PERIODS.map((p) => [p, Array.from({ length: p }, (_, i) => { const t = (i + 1) / p; return [round(x[p] * t + (r() - 0.5) * 3 * (1 - t)), round(y[p] * t + (r() - 0.5) * 3 * (1 - t))]; })]),
    );
    return { ...s, x, y, q, path };
  });
  return { market, sample: true, asof: "2026-10-20", periods: PERIODS, sectors };
}

writeFileSync(new URL("../src/data/kr-sectors.json", import.meta.url), JSON.stringify(build("kr", KR, 7), null, 1) + "\n");
writeFileSync(new URL("../src/data/us-sectors.json", import.meta.url), JSON.stringify(build("us", US, 11), null, 1) + "\n");
console.log("표본 자료를 src/data에 썼습니다.");
