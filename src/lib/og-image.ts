import { OG_GLYPHS, OG_GLYPH_DATA, OG_H, OG_LEVELS, OG_PALETTE, OG_TEMPLATES, OG_TEXT_BASE, OG_W } from "./og-assets";
import type { NightData } from "./night";
import { hitRate, type PollState } from "./poll";

/**
 * 링크 미리보기 그림(카톡·네이버 등에 링크를 올리면 보이는 그림)에 그 순간의 값을 넣는다.
 * 무료 요금제 Worker의 CPU 10ms 안에 들도록 글꼴을 쓰지 않는다: 미리 그린 바탕과 글자 조각
 * (scripts/og/make_og_assets.py → og-assets.ts)의 팔레트 번호를 칸에 찍고, 내장 deflate로 PNG만 묶는다.
 */

const KST = 9 * 3600_000;
const STRIDE = OG_W + 1; // 줄마다 PNG 필터 바이트 하나

export const C_INK = 0;
export const C_MUTED = 1;
export const C_UP = 2;
export const C_DOWN = 3;

type Style = "big" | "chg" | "small" | "pct";

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pipe(data: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Response(data).body!.pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

// 한 번 푼 바탕·글자 조각은 Worker 인스턴스가 살아 있는 동안 다시 쓴다(요청마다 복사만)
let glyphData: Promise<Uint8Array> | null = null;
const glyphs = () => (glyphData ??= pipe(b64(OG_GLYPH_DATA), new DecompressionStream("deflate")));
const templates = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
function template(name: keyof typeof OG_TEMPLATES) {
  let p = templates.get(name);
  if (!p) templates.set(name, (p = pipe(b64(OG_TEMPLATES[name]), new DecompressionStream("deflate"))));
  return p;
}

/** 바탕 위에 글자를 찍는 그림판 */
export class Canvas {
  constructor(
    readonly px: Uint8Array<ArrayBuffer>,
    private readonly g: Uint8Array,
  ) {}

  static async of(name: keyof typeof OG_TEMPLATES) {
    const [px, g] = await Promise.all([template(name), glyphs()]);
    return new Canvas(px.slice(), g);
  }

  /** 없는 글자는 건너뛴다 */
  width(style: Style, text: string) {
    const t = OG_GLYPHS[style].g;
    let w = 0;
    for (const ch of text) w += t[ch]?.[1] ?? 0;
    return w;
  }

  /** x는 align 기준점, y는 글자 칸 위쪽 */
  text(style: Style, text: string, x: number, y: number, color: number, align: "left" | "right" | "center" = "left") {
    const { h, g } = OG_GLYPHS[style];
    const w = this.width(style, text);
    let cx = Math.round(align === "left" ? x : align === "right" ? x - w : x - w / 2);
    const base = OG_TEXT_BASE + color * OG_LEVELS - 1;
    for (const ch of text) {
      const e = g[ch];
      if (!e) continue;
      const [off, gw] = e;
      for (let r = 0; r < h; r++) {
        const yy = y + r;
        if (yy < 0 || yy >= OG_H) continue;
        const row = yy * STRIDE + 1;
        for (let c = 0; c < gw; c++) {
          const a = this.g[off + r * gw + c];
          const xx = cx + c;
          if (a && xx >= 0 && xx < OG_W) this.px[row + xx] = base + a;
        }
      }
      cx += gw;
    }
    return w;
  }

  rect(x: number, y: number, w: number, h: number, color: number) {
    const v = OG_TEXT_BASE + color * OG_LEVELS + OG_LEVELS - 1;
    for (let r = Math.max(0, y); r < Math.min(OG_H, y + h); r++) this.px.fill(v, r * STRIDE + 1 + Math.max(0, x), r * STRIDE + 1 + Math.min(OG_W, x + w));
  }

  async png() {
    const idat = await pipe(this.px, new CompressionStream("deflate"));
    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, OG_W);
    dv.setUint32(4, OG_H);
    ihdr.set([8, 3, 0, 0, 0], 8); // 8비트 팔레트
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("PLTE", b64(OG_PALETTE)), chunk("IDAT", idat), chunk("IEND", new Uint8Array())];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ out[i]) & 0xff] ^ (c >>> 8);
  dv.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
  return out;
}

const WD = "일월화수목금토";
const kst = (ms: number) => new Date(ms + KST);
const two = (n: number) => String(n).padStart(2, "0");
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 코스피 야간선물 추정: 추정값 크게, 등락, 기준 시각 */
export async function nightImage(d: NightData) {
  const cv = await Canvas.of("night");
  const t = d.chg > 0 ? C_UP : d.chg < 0 ? C_DOWN : C_INK;
  cv.text("big", fmt(d.est), 96, 290, C_INK);
  const arrow = d.chg > 0 ? "▲ " : d.chg < 0 ? "▼ " : "";
  cv.text("chg", `${arrow}${fmt(Math.abs(d.chg))}  ${d.chgPct > 0 ? "+" : d.chgPct < 0 ? "-" : ""}${fmt(Math.abs(d.chgPct))}%`, 100, 460, t);
  const k = kst(d.updated);
  const when = `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${two(k.getUTCHours())}:${two(k.getUTCMinutes())} 기준 · ${d.window.live ? "실시간" : "지난밤"}`;
  cv.text("small", when, 100, 552, C_MUTED);
  return cv.png();
}

const pctOf = (a: number, b: number) => (a + b ? Math.round((a / (a + b)) * 100) : 50);

/**
 * 오늘의 한 표: 투표 중에는 비율을 보이지 않는다(화면처럼 먼저 보면 따라 누르기 쉽다).
 * 마감 뒤(09:00~15:45)에는 비율과 막대.
 */
export async function pollImage(s: PollState) {
  const r = s.round;
  const d = new Date(`${r.target}T00:00:00Z`);
  const day = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WD[d.getUTCDay()]}) 장`;
  const crowd = hitRate(s.past);
  const foot = crowd.n > 0 ? `지난 판정 다수 적중 ${crowd.hit}/${crowd.n}회` : "";
  if (r.open) {
    const cv = await Canvas.of("pollOpen");
    cv.text("small", `${day} · 09:00 투표 마감`, 100, 316, C_MUTED);
    if (foot) cv.text("small", foot, 100, 552, C_MUTED);
    return cv.png();
  }
  const cv = await Canvas.of("pollClosed");
  cv.text("small", `${day} · 투표 마감 · 15:45 결과`, 100, 316, C_MUTED);
  const up = pctOf(r.up, r.down);
  cv.text("pct", `오른다 ${up}%`, 100, 370, C_UP);
  cv.text("pct", `${100 - up}% 내린다`, 1100, 370, C_DOWN, "right");
  const bar = 1000;
  const split = Math.round((bar * up) / 100);
  cv.rect(100, 480, split, 22, C_UP);
  cv.rect(100 + split, 480, bar - split, 22, C_DOWN);
  if (foot) cv.text("small", foot, 100, 552, C_MUTED);
  return cv.png();
}
