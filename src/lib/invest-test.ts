/**
 * 투자 성향 테스트(/test). 12문항에 답하면 투자 방식이 서로 다른 대가 8명과 얼마나 닮았는지 % 로 낸다.
 * 대가 id는 /investors/{id}(13F 포트폴리오) 주소와 같다. 종목을 권하지 않고, 공개된 투자 철학만 요약한다.
 */
export type TypeId =
  | "buffett"
  | "wood"
  | "burry"
  | "druckenmiller"
  | "dalio"
  | "marks"
  | "ackman"
  | "icahn";

export interface Master {
  id: TypeId;
  emoji: string;
  name: string;
  /** 결과 카드 별명(국장 말투) */
  nick: string;
  /** 한 줄 요약 */
  line: string;
  /** 결과 카드 특징 2개 */
  traits: [string, string];
}

export const MASTERS: Master[] = [
  {
    id: "buffett",
    emoji: "🐢",
    name: "워런 버핏",
    nick: "삼전 10년 존버러",
    line: "좋은 회사를 싸게 사서 오래 들고 간다",
    traits: ["시세보다 회사를 본다", "흔들려도 쉽게 팔지 않는다"],
  },
  {
    id: "wood",
    emoji: "🚀",
    name: "캐시 우드",
    nick: "2차전지 풀매수러",
    line: "세상을 바꿀 혁신에 크게 건다",
    traits: ["5년 뒤 세상을 먼저 그린다", "−30%에도 확신이 남아 있다"],
  },
  {
    id: "burry",
    emoji: "🐻",
    name: "마이클 버리",
    nick: "인버스 장전러",
    line: "남들과 반대로 가고, 거품을 먼저 본다",
    traits: ["모두가 살 때 의심부터 한다", "하락에 거는 것도 두렵지 않다"],
  },
  {
    id: "druckenmiller",
    emoji: "🌊",
    name: "스탠리 드러켄밀러",
    nick: "주도주 갈아타기 장인",
    line: "큰 흐름을 읽고, 맞으면 크게 싣는다",
    traits: ["금리·돈의 흐름부터 본다", "틀리면 미련 없이 자른다"],
  },
  {
    id: "dalio",
    emoji: "⚖️",
    name: "레이 달리오",
    nick: "국장·미장·금 반반러",
    line: "나눠 담아서 어떤 장에서도 버틴다",
    traits: ["예측보다 대비를 믿는다", "주식·채권·금을 함께 담는다"],
  },
  {
    id: "marks",
    emoji: "🦉",
    name: "하워드 막스",
    nick: "폭락장 줍줍러",
    line: "위기에 사고, 늘 위험부터 따진다",
    traits: ["시장의 온도부터 잰다", "모두 겁낼 때 장바구니를 연다"],
  },
  {
    id: "ackman",
    emoji: "🎯",
    name: "빌 애크먼",
    nick: "한 종목 몰빵러",
    line: "확신하는 몇 종목에 집중한다",
    traits: ["많이 알기보다 깊이 안다", "확신이 서면 크게 싣는다"],
  },
  {
    id: "icahn",
    emoji: "🦈",
    name: "칼 아이칸",
    nick: "주주총회 출석러",
    line: "지분을 사서 회사를 직접 바꾼다",
    traits: ["주주로서 목소리를 낸다", "배당·자사주를 꼼꼼히 챙긴다"],
  },
];

export const findMaster = (id: string) => MASTERS.find((m) => m.id === id);

/**
 * 웃자고 넣은 보기(ant)를 절반 넘게 고르면 대가 대신 나오는 특별 결과.
 * 대가 비중은 그대로 계산해 '그래도 닮은 대가'로 보인다.
 */
export const ANT: Omit<Master, "id"> & { id: "ant" } = {
  id: "ant",
  emoji: "🐜",
  name: "개미",
  nick: "뼛속부터 개미",
  line: "대가보다 내 감, 공시보다 커뮤니티",
  traits: ["앱 알림이 곧 심장 박동", "물리면 그때부터 장기 투자"],
};

export type ResultId = TypeId | "ant";
export const findResult = (id: string) => (id === "ant" ? ANT : findMaster(id));

/** 이 비율(%) 이상 웃자고 넣은 보기를 고르면 개미형 */
export const ANT_MIN = 50;

/** 웃자고 넣은 보기를 고른 비율(%, 문항 수 대비) */
export function antPct(answers: number[]): number {
  const n = answers.filter((a, i) => QUESTIONS[i]?.options[a]?.ant).length;
  return Math.round((n / QUESTIONS.length) * 100);
}

/** 결과 주소: 개미형이거나 가장 닮은 대가 + 비중(s)·개미력(a) */
export function resultPath(answers: number[]): string {
  const r = score(answers);
  const a = antPct(answers);
  return `/test/${a >= ANT_MIN ? "ant" : r[0].id}?s=${encodePcts(r)}&a=${a}`;
}

type Points = Partial<Record<TypeId, number>>;

export interface Question {
  q: string;
  /** ant: 웃자고 넣은 보기(개미력) */
  options: { text: string; p: Points; ant?: boolean }[];
}

export const QUESTIONS: Question[] = [
  {
    q: "주식 앱, 얼마나 자주 여나요?",
    options: [
      { text: "하루에도 수십 번", p: { druckenmiller: 2, burry: 1 } },
      { text: "하루 한두 번", p: { ackman: 1, icahn: 1, wood: 1 } },
      { text: "일주일에 한 번쯤", p: { dalio: 2, marks: 1 } },
      { text: "몇 달 안 열어도 괜찮다", p: { buffett: 2 } },
      {
        text: "알림 꺼 두고 잊고 산다 😴",
        p: { buffett: 1, dalio: 1 },
        ant: true,
      },
    ],
  },
  {
    q: "산 종목이 하루에 −10%! 나는?",
    options: [
      { text: "기회다, 더 산다", p: { marks: 2, buffett: 1 } },
      { text: "틀렸으면 바로 판다", p: { druckenmiller: 2 } },
      { text: "원래 흔들리는 종목, 버틴다", p: { wood: 2, ackman: 1 } },
      { text: "회사에 따지고 싶다", p: { icahn: 2 } },
      { text: "앱을 지운다 🙈", p: { buffett: 1, marks: 1 }, ant: true },
    ],
  },
  {
    q: "가장 끌리는 회사는?",
    options: [
      { text: "10년 뒤에도 1등일 회사", p: { buffett: 2 } },
      { text: "세상을 바꿀 혁신 회사", p: { wood: 2 } },
      { text: "다들 싫어해서 싸진 회사", p: { burry: 2, marks: 1 } },
      { text: "경영만 바뀌면 확 좋아질 회사", p: { icahn: 2, ackman: 1 } },
      {
        text: "요즘 커뮤니티에서 제일 핫한 회사 🔥",
        p: { druckenmiller: 1, wood: 1 },
        ant: true,
      },
    ],
  },
  {
    q: "내 계좌 모양은?",
    options: [
      { text: "1~3종목에 집중", p: { ackman: 2, icahn: 1 } },
      { text: "4~10종목", p: { buffett: 1, druckenmiller: 1, marks: 1 } },
      { text: "10종목 넘게", p: { wood: 2 } },
      { text: "주식·채권·금·달러로 나눠 담음", p: { dalio: 2 } },
      {
        text: "뭘 샀는지 기억이 안 난다 🤔",
        p: { dalio: 1, buffett: 1 },
        ant: true,
      },
    ],
  },
  {
    q: '"곧 폭락이 온다"는 뉴스를 보면?',
    options: [
      { text: "현금을 챙겨 기회를 기다린다", p: { marks: 2 } },
      { text: "역시! 하락에 건다", p: { burry: 2 } },
      { text: "금리·환율부터 확인한다", p: { druckenmiller: 1, dalio: 1 } },
      { text: "신경 안 쓴다, 좋은 회사면 된다", p: { buffett: 2, wood: 1 } },
      {
        text: "그런 뉴스는 매일 나온다 🙄",
        p: { ackman: 1, icahn: 1 },
        ant: true,
      },
    ],
  },
  {
    q: "모두가 사는 종목이 있다",
    options: [
      { text: "같이 탄다, 추세가 친구", p: { druckenmiller: 2, wood: 1 } },
      { text: "거품 같다, 거리를 둔다", p: { burry: 2, marks: 1 } },
      { text: "내가 잘 아는 회사인지 본다", p: { buffett: 1, ackman: 1 } },
      { text: "정해 둔 비중만 지킨다", p: { dalio: 2 } },
      {
        text: "나는 이미 타 있다 😎",
        p: { druckenmiller: 1, ackman: 1 },
        ant: true,
      },
    ],
  },
  {
    q: "가장 먼저 보는 숫자는?",
    options: [
      { text: "PER·PBR, 싼지 비싼지", p: { buffett: 1, burry: 1, marks: 1 } },
      { text: "매출이 얼마나 빨리 크는지", p: { wood: 2 } },
      { text: "금리·환율·돈의 양", p: { druckenmiller: 1, dalio: 2 } },
      { text: "대주주 지분·배당·자사주", p: { icahn: 2 } },
      { text: "차트만 본다 📈", p: { druckenmiller: 2 }, ant: true },
      { text: "눈 감고 산다 🙈", p: { wood: 1, ackman: 1 }, ant: true },
    ],
  },
  {
    q: "확신이 오면 얼마나 넣나요?",
    options: [
      { text: "계좌의 절반도 넣는다", p: { ackman: 2, druckenmiller: 1 } },
      { text: "그래도 한 종목은 20% 안", p: { dalio: 1, marks: 1 } },
      { text: "조금씩 나눠서 계속 산다", p: { wood: 1, buffett: 1 } },
      { text: "회사를 움직일 만큼 산다", p: { icahn: 2 } },
      { text: "영끌한다 💸", p: { ackman: 1, icahn: 1 }, ant: true },
    ],
  },
  {
    q: "주주총회 소집 공시가 왔다",
    options: [
      { text: "가서 질문까지 한다", p: { icahn: 2, ackman: 1 } },
      { text: "안건만 꼼꼼히 읽는다", p: { buffett: 1, ackman: 1 } },
      { text: "관심 없다, 흐름이 중요", p: { druckenmiller: 2 } },
      { text: "회사보다 산업 전체를 본다", p: { wood: 1, dalio: 1 } },
      {
        text: "주주총회가 뭐예요? 🙋",
        p: { druckenmiller: 1, burry: 1 },
        ant: true,
      },
    ],
  },
  {
    q: "손실이 났을 때 드는 생각",
    options: [
      { text: "틀렸으면 빨리 인정하자", p: { druckenmiller: 2 } },
      { text: "남들이 겁낼 때가 기회", p: { marks: 2 } },
      { text: "내가 맞다, 시장이 틀렸다", p: { burry: 1, ackman: 1, wood: 1 } },
      { text: "그래서 나눠 담는 거다", p: { dalio: 2 } },
      {
        text: "본전 올 때까지 존버 🧘",
        p: { buffett: 1, marks: 1 },
        ant: true,
      },
    ],
  },
  {
    q: "이상적인 보유 기간은?",
    options: [
      { text: "며칠에서 몇 주", p: { druckenmiller: 2 } },
      {
        text: "1~2년, 목표에 닿을 때까지",
        p: { icahn: 1, ackman: 1, burry: 1 },
      },
      { text: "5년 이상", p: { wood: 2 } },
      { text: "영원히", p: { buffett: 2 } },
      {
        text: "물리면 강제로 장기 투자 😇",
        p: { marks: 1, burry: 1 },
        ant: true,
      },
    ],
  },
  {
    q: "내 투자 좌우명에 가장 가까운 것은?",
    options: [
      {
        text: "남들이 욕심낼 때 조심하고, 겁낼 때 산다",
        p: { marks: 1, buffett: 1, burry: 1 },
      },
      { text: "세상을 바꿀 기술에 남보다 먼저 탄다", p: { wood: 2 } },
      { text: "미래는 모르니 골고루 나눠 담는다", p: { dalio: 2 } },
      { text: "주주라면 회사에 할 말은 한다", p: { icahn: 1, ackman: 1 } },
      { text: "가즈아! 🚀", p: { wood: 1, druckenmiller: 1 }, ant: true },
    ],
  },
];

/** 대가마다 얻을 수 있는 최대 점수(문항마다 그 대가에게 가장 많이 주는 답) */
export const MAX_POINTS: Record<TypeId, number> = Object.fromEntries(
  MASTERS.map((m) => [
    m.id,
    QUESTIONS.reduce(
      (s, q) => s + Math.max(0, ...q.options.map((o) => o.p[m.id] ?? 0)),
      0,
    ),
  ]),
) as Record<TypeId, number>;

/**
 * 답(문항마다 고른 보기 번호) → 대가별 비중(%, 8명 합계 100). 대가마다 받을 수 있는 최대 점수로 먼저 나눠
 * 문항 수가 다른 대가끼리도 견줄 수 있게 한 뒤, 합이 100이 되게 나눈다(반올림 나머지는 큰 순으로 1씩).
 * 많이 닮은 순으로, 같으면 MASTERS 순서.
 */
export function score(answers: number[]): { id: TypeId; pct: number }[] {
  const pts = Object.fromEntries(MASTERS.map((m) => [m.id, 0])) as Record<
    TypeId,
    number
  >;
  answers.forEach((a, i) => {
    const o = QUESTIONS[i]?.options[a];
    if (!o) return;
    for (const [k, v] of Object.entries(o.p)) pts[k as TypeId] += v ?? 0;
  });
  const rel = MASTERS.map((m) => pts[m.id] / MAX_POINTS[m.id]);
  const sum = rel.reduce((s, x) => s + x, 0) || 1;
  const raw = rel.map((x) => (x / sum) * 100);
  const pct = raw.map(Math.floor);
  let rest = 100 - pct.reduce((s, x) => s + x, 0);
  for (const k of raw
    .map((x, i) => ({ i, f: x - Math.floor(x) }))
    .sort((a, b) => b.f - a.f || a.i - b.i)) {
    if (rest-- <= 0) break;
    pct[k.i]++;
  }
  return MASTERS.map((m, i) => ({ id: m.id, i, pct: pct[i], raw: raw[i] }))
    .sort((a, b) => b.raw - a.raw || a.i - b.i)
    .map(({ id, pct }) => ({ id, pct }));
}

/** 공유 주소에 싣는 비중: MASTERS 순서대로 두 자리 숫자(100은 99로). 예: 8162... */
export function encodePcts(r: { id: TypeId; pct: number }[]): string {
  return MASTERS.map((m) =>
    String(Math.min(99, r.find((x) => x.id === m.id)?.pct ?? 0)).padStart(
      2,
      "0",
    ),
  ).join("");
}

/** encodePcts 를 되돌린다. 형식이 틀리면 null */
export function decodePcts(
  s: string | null,
): { id: TypeId; pct: number }[] | null {
  if (!s || !/^\d{16}$/.test(s)) return null;
  return MASTERS.map((m, i) => ({
    id: m.id,
    i,
    pct: Number(s.slice(i * 2, i * 2 + 2)),
  }))
    .sort((a, b) => b.pct - a.pct || a.i - b.i)
    .map(({ id, pct }) => ({ id, pct }));
}
