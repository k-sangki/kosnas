import { writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { NightData } from "./night";
import { nightImage, pollImage } from "./og-image";
import type { PollState } from "./poll";

/** PNG 머리·IHDR를 읽고 IDAT를 풀어 줄 수를 확인한다 */
function check(png: Uint8Array) {
  expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const dv = new DataView(png.buffer, png.byteOffset);
  expect(dv.getUint32(16)).toBe(1200);
  expect(dv.getUint32(20)).toBe(630);
  let o = 8;
  const idat: Uint8Array[] = [];
  while (o < png.length) {
    const n = dv.getUint32(o);
    const type = String.fromCharCode(...png.slice(o + 4, o + 8));
    if (type === "IDAT") idat.push(png.slice(o + 8, o + 8 + n));
    o += 12 + n;
  }
  expect(inflateSync(Buffer.concat(idat)).length).toBe(630 * 1201);
}

const night = {
  window: { start: Date.UTC(2026, 9, 28, 6, 45), end: Date.UTC(2026, 9, 29, 0), live: true },
  est: 412.35,
  chg: 3.45,
  chgPct: 0.84,
  updated: Date.UTC(2026, 9, 28, 17, 13),
} as unknown as NightData;

const poll = (open: boolean): PollState => ({
  round: { target: "2026-10-29", open, closes: 0, end: 0, up: 62, down: 38, mine: null },
  past: [{ target: "2026-10-28", up: 10, down: 4, pct: 0.4 }] as PollState["past"],
});

describe("링크 미리보기 그림", () => {
  it("야간 추정", async () => {
    const png = await nightImage(night);
    check(png);
    if (process.env.OG_OUT) writeFileSync(`${process.env.OG_OUT}/night.png`, png);
  });
  it("야간 추정 하락", async () => {
    check(await nightImage({ ...night, chg: -2.1, chgPct: -0.51 }));
  });
  it("한 표 투표 중·마감", async () => {
    const a = await pollImage(poll(true));
    const b = await pollImage(poll(false));
    check(a);
    check(b);
    if (process.env.OG_OUT) {
      writeFileSync(`${process.env.OG_OUT}/poll-open.png`, a);
      writeFileSync(`${process.env.OG_OUT}/poll-closed.png`, b);
    }
  });
});

describe("글자 조각", () => {
  it("그림에 쓰는 한글이 모두 있다", async () => {
    const { OG_GLYPHS } = await import("./og-assets");
    for (const ch of "지난 판정 다수 적중회 투표 마감 결과 기준 실시간 지난밤 장 월일화수목금토 0123456789:/()·")
      expect(OG_GLYPHS.small.g[ch], ch).toBeDefined();
  });
});
