import { describe, expect, it } from "vitest";
import { atOf, bandPick, barScale, diffText, earnReleases, kstDate, kstHm, mergeEarnings, parseNum, releases, RESULT_HOLD, speechLabel, verdictOf, whenLabel, type Row } from "./econ";

const row = (n: string, a: string, f: string, p: string, d = "2026-11-11", t = "08:30"): Row => ({ d, t, c: "United States", n, a, f, p });

describe("경제지표", () => {
  it("나스닥 달력 날짜는 하루 앞 미국 날짜, 시각은 UTC-5", () => {
    // date=11-11 의 08:30 = 미국 11/10 08:30 동부 = 한국 11/10 22:30
    const at = atOf({ d: "2026-11-11", t: "08:30" });
    expect(kstDate(at)).toBe("2026-11-10");
    expect(kstHm(at)).toBe("22:30");
  });

  it("단위를 읽는다", () => {
    expect(parseNum("194K")).toBe(194_000);
    expect(parseNum("7.523M")).toBeCloseTo(7_523_000);
    expect(parseNum("-0.3%")).toBe(-0.3);
    expect(parseNum("")).toBeNull();
  });

  it("예상치 자릿수로 부합·상회·하회", () => {
    expect(verdictOf("0.3%", "0.2%")).toBe("beat");
    expect(verdictOf("4.1%", "4.2%")).toBe("miss");
    expect(verdictOf("4.00%", "4.00%")).toBe("match");
    expect(verdictOf("1,718K", "1,710K")).toBe("beat");
    expect(verdictOf("", "0.2%")).toBeNull();
    expect(verdictOf("0.3%", "")).toBeNull();
  });

  it("같은 이름 두 줄은 전월·전년, 근원이 먼저", () => {
    const list = releases([row("CPI", "0.4%", "0.3%", "0.6%"), row("CPI", "3.1%", "3.0%", "3.0%"), row("Core CPI", "0.3%", "0.2%", "0.3%")]);
    expect(list).toHaveLength(1);
    const labels = list[0].metrics.map((m) => m.label);
    expect(labels[0]).toMatch(/근원/);
    expect(labels.some((l) => /전월/.test(l))).toBe(true);
    expect(labels.some((l) => /전년/.test(l))).toBe(true);
    expect(list[0].out).toBe(true);
  });

  it("띠: 결과는 12시간 두고 그 뒤 다음 발표", () => {
    const list = releases([
      row("Core CPI", "0.3%", "0.2%", "0.3%"),
      row("Initial Jobless Claims", "", "194K", "189K", "2026-11-13", "08:30"),
      row("Fed Logan Speaks", "", "", "", "2026-11-12", "09:35"),
    ]);
    const cpi = atOf({ d: "2026-11-11", t: "08:30" });
    expect(bandPick(list, cpi + 3600_000)).toMatchObject({ mode: "result", r: { group: "cpi" } });
    expect(bandPick(list, cpi + RESULT_HOLD + 60_000)).toMatchObject({ mode: "next", r: { group: "claims" } });
  });

  it("주목 기업 실적은 발표 한 건: 장 뒤는 한국 다음 날 아침, 결과 나오면 띠에", () => {
    const e = { symbol: "CRWV", name: "코어위브", date: "2026-11-10", when: "after" as const, capB: 27, quarter: "", f: -1.45, n: 5, a: null, s: null, ly: -0.6 };
    const [r] = earnReleases([e, { ...e, symbol: "ZZZZ" }]);
    expect(r.name).toBe("코어위브(CRWV) 실적");
    expect(kstDate(r.at)).toBe("2026-11-11");
    expect(whenLabel(r.at, Date.parse("2026-11-10T12:00:00+09:00"), r.whenText)).toBe("내일 아침");
    expect(r.metrics[0]).toMatchObject({ f: "-$1.45", p: "-$0.60", pLabel: "1년 전" });
    // 발표 뒤 값이 아직이면 집계 중으로 남는다
    const morning = Date.parse("2026-11-11T10:00:00+09:00");
    expect(bandPick([r], morning)).toMatchObject({ mode: "next" });
    // 실시간 값이 오면 결과
    const [done] = earnReleases(mergeEarnings([e], [{ ...e, name: "CRWV", when: "", a: -1.2, s: 17.2 }]));
    expect(done.name).toBe("코어위브(CRWV) 실적");
    expect(done.metrics[0].verdict).toBe("beat");
    expect(bandPick([done], morning)).toMatchObject({ mode: "result" });
  });

  it("차이를 예상치 단위로", () => {
    expect(diffText({ a: "0.3%", f: "0.2%" })).toBe("+0.1%p");
    expect(diffText({ a: "165K", f: "65K" })).toBe("+100K");
    expect(diffText({ a: "4.1%", f: "4.2%" })).toBe("−0.1%p");
    expect(diffText({ a: "1,718K", f: "1,710K" })).toBe("+8K");
    expect(diffText({ a: "-$0.09", f: "$0.02" })).toBe("−$0.11");
    expect(diffText({ a: "-$1.21", f: "-$1.45" })).toBe("+$0.24");
    expect(diffText({ a: "4.00%", f: "4.00%" })).toBe("±0.00%p");
    expect(diffText({ a: "", f: "0.2%" })).toBeNull();
  });

  it("연준 인사 이름", () => {
    expect(speechLabel("Fed Governor Jefferson Speaks")).toMatch(/^연준 이사 /);
    expect(speechLabel("Fed Chair Powell Testifies")).toMatch(/^연준 의장 .*의회 증언$/);
  });
});

describe("barScale", () => {
  it("모두 양수면 기준선이 바닥", () => {
    const b = barScale([2, 4, null]);
    expect(b.zero).toBe(100);
    expect(b.h(4)).toBe(100);
    expect(b.h(null)).toBe(0);
  });
  it("모두 음수면 기준선이 꼭대기, 손실이 줄면 막대가 짧다(코어위브 EPS)", () => {
    const b = barScale([-0.6, -1.55, -1.27]);
    expect(b.zero).toBe(0);
    expect(b.h(-1.55)).toBe(100);
    expect(b.h(-1.27)).toBeLessThan(b.h(-1.55));
  });
  it("양·음이 섞이면 그 사이", () => {
    const b = barScale([1, -1, 2]);
    expect(b.zero).toBeCloseTo(66.67, 1);
  });
});

describe("항목 페이지", () => {
  it("지표·기업 페이지 목록이 카드 링크 목록과 같다", async () => {
    const { ECON_PAGES, EARN_PAGES } = await import("./econ-pages");
    const { ECON_PAGE_IDS, EARN_FOCUS, itemHref } = await import("./econ");
    expect(ECON_PAGES.map((p) => p.id).sort()).toEqual([...ECON_PAGE_IDS].sort());
    expect(EARN_PAGES.map((p) => p.sym).sort()).toEqual([...EARN_FOCUS].sort());
    const { econOpen, earnOpen } = await import("./econ");
    // 열린 것만 링크
    for (const id of ECON_PAGE_IDS) expect(itemHref({ group: id })).toBe(econOpen(id) ? `/econ/${id}` : null);
    for (const s of EARN_FOCUS) expect(itemHref({ group: "earn", sym: s })).toBe(earnOpen(s) ? `/econ/earnings/${s.toLowerCase()}` : null);
    expect(itemHref({ group: "speech" })).toBeNull();
  });
});

describe("증시 쪽 해석(tone)", () => {
  it("CPI 0.1%p 상회는 악재, 0.2%p 이상은 강한 악재, 부합은 중립", async () => {
    const { toneOf } = await import("./econ");
    const t = [-1, 0.1, 0.2];
    expect(toneOf(0.3, 0.2, t, "beat")).toBe(-1);
    expect(toneOf(0.4, 0.2, t, "beat")).toBe(-2);
    expect(toneOf(0.1, 0.2, t, "miss")).toBe(1);
    expect(toneOf(0.2, 0.2, t, "match")).toBe(0);
  });
  it("고용 10만 상회는 강한 호재, 1만 차이는 중립", async () => {
    const { toneOf } = await import("./econ");
    const t = [1, 20000, 50000];
    expect(toneOf(165000, 65000, t, "beat")).toBe(2);
    expect(toneOf(75000, 65000, t, "beat")).toBe(0);
  });
  it("실적 EPS: 손실이 예상보다 크게 줄면 강한 호재(코어위브 -1.27 대 -1.55)", async () => {
    const { epsTone } = await import("./econ");
    expect(epsTone(-1.27, -1.55)).toBe(2);
    expect(epsTone(2.05, 1.98)).toBe(1);
    expect(epsTone(0.32, 0.32)).toBe(0);
    expect(epsTone(0.9, 1.0)).toBe(-1);
  });
});

describe("실적 매출·순이익", () => {
  const base = { symbol: "CRWV", name: "코어위브", date: "2026-11-10", when: "after" as const, capB: 27, quarter: "Sep/2026", f: -1.55, n: 10, a: -1.27, s: 18.18, ly: -0.22 };
  it("매출은 같은 단위로, 차이는 +$0.07B", () => {
    const [eps, rev, ni] = earnReleases([{ ...base, rf: 3.59e9, ra: 3.66e9, rly: 1.36e9, na: -7.09e8, nly: -1.1e8 }])[0].metrics;
    expect(eps.label).toBe("주당순이익(EPS)");
    expect([rev.label, rev.p, rev.f, rev.a, rev.verdict, rev.tone]).toEqual(["매출", "$1.36B", "$3.59B", "$3.66B", "beat", 1]);
    expect(diffText(rev)).toBe("+$0.07B");
    expect([ni.label, ni.p, ni.a, ni.f, ni.verdict]).toEqual(["순손실", "-$110M", "-$709M", "", null]);
  });
  it("매출·순이익 값이 없으면 EPS 한 줄", () => {
    expect(earnReleases([base])[0].metrics).toHaveLength(1);
  });
});
