import { describe, expect, it } from "vitest";
import { atOf, bandPick, kstDate, kstHm, parseNum, releases, RESULT_HOLD, speechLabel, verdictOf, type Row } from "./econ";

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

  it("연준 인사 이름", () => {
    expect(speechLabel("Fed Governor Jefferson Speaks")).toMatch(/^연준 이사 /);
    expect(speechLabel("Fed Chair Powell Testifies")).toMatch(/^연준 의장 .*의회 증언$/);
  });
});
