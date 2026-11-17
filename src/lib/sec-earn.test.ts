import { describe, expect, it } from "vitest";
import { nonGaapEps, plainText, readRelease, revenue } from "./sec-earn";

// 엔비디아 보도자료 모양(2026-11-17 3분기 FY27: 매출 $115.8B, GAAP $2.70 · Non-GAAP $2.68)
const NVDA = `<p>NVIDIA Announces Financial Results for Third Quarter Fiscal 2027</p>
<ul><li>Record revenue of $115.8 billion, up 103% from a year ago</li></ul>
<p>NVIDIA reported revenue for the third quarter ended October 25, 2026, of $115.8 billion. GAAP and non-GAAP gross margins were 74.8% and 74.9%, respectively. For the quarter, GAAP and non-GAAP earnings per diluted share were $2.70 and $2.68, respectively.</p>
<table><tr><td>GAAP</td></tr><tr><td>($ in millions, except earnings per share)</td><td>Q3 FY27</td></tr>
<tr><td>Revenue</td><td>$</td><td>115,800</td></tr><tr><td>Diluted earnings per share</td><td>$</td><td>2.70</td></tr></table>
<table><tr><td>Non-GAAP</td></tr><tr><td>Diluted earnings per share</td><td>$</td><td>2.68</td></tr></table>`;

describe("SEC 실적 보도자료", () => {
  it("엔비디아: 문장의 Non-GAAP EPS·매출", () => {
    const t = plainText(NVDA);
    expect(nonGaapEps(t)).toBe(2.68);
    expect(revenue(t)).toBe(115.8e9);
    expect(readRelease(NVDA, 2.49, 108.7e9)).toEqual({ a: 2.68, ra: 115.8e9 });
  });
  it("문장이 없으면 표의 Non-GAAP 줄(GAAP 줄은 건너뜀)", () => {
    const t = plainText(NVDA.replace(/For the quarter, GAAP and non-GAAP[^<]*/, ""));
    expect(nonGaapEps(t)).toBe(2.68);
  });
  it("Adjusted 문장·괄호 음수", () => {
    expect(nonGaapEps("Adjusted diluted EPS was $(0.12) compared with")).toBe(-0.12);
    expect(nonGaapEps("Adjusted EPS of $1.95 versus")).toBe(1.95);
  });
  it("GAAP만 있으면 쓰지 않는다 · 예상에서 너무 먼 값도", () => {
    expect(nonGaapEps("Diluted earnings per share $ 2.70")).toBeNull();
    expect(readRelease(NVDA, 1.2, 108.7e9).a).toBeNull();
    expect(readRelease(NVDA, 2.49, 50e9).ra).toBeNull();
  });
  it("표 단위로 매출", () => {
    expect(revenue("(in millions) Total revenues $ 12,345 $ 11,000")).toBe(12_345e6);
  });
});
