"""
공유 미리보기 그림(/og/night.png·/og/poll.png)의 바탕과 글자 조각을 만든다 → src/lib/og-assets.ts

무료 요금제 Worker는 요청 하나에 CPU 10ms라 그 자리에서 글꼴로 그림을 그릴 수 없다(satori·resvg는 수십 ms).
그래서 바탕(고정 글자·로고)과 숫자·짧은 한글 글자의 알파 조각을 여기서 미리 그려 두고,
Worker(src/lib/og-image.ts)는 팔레트 번호를 칸에 찍은 뒤 브라우저 내장 deflate로 PNG만 묶는다.

다시 만들기(글꼴은 저장소에 넣지 않는다):
  cd /tmp && npm pack pretendard@1.3.9 && tar xzf pretendard-1.3.9.tgz
  python3 scripts/og/make_og_assets.py /tmp/package/dist/public/static
"""

import base64
import json
import sys
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/package/dist/public/static")
W, H = 1200, 630

BG = (22, 24, 31)
# 글자 색(사이트 다크 모드 값). 순서가 og-image.ts 의 C_INK… 번호다
COLORS = {"ink": (232, 233, 236), "muted": (128, 133, 143), "up": (255, 90, 104), "down": (77, 149, 255)}
LEVELS = 15  # 알파 1~15단계
TEMPLATE_COLORS = 255 - len(COLORS) * LEVELS - 1  # 0번은 바탕


def font(weight: str, size: int):
    return ImageFont.truetype(str(FONTS / f"Pretendard-{weight}.otf"), size)


def logo(im: Image.Image):
    """기존 og.png 의 로고(k·n KosNas) 자리를 그대로 옮긴다"""
    og = Image.open(ROOT / "public/og.png").convert("RGB")
    box = (90, 90, 560, 190)
    im.paste(og.crop(box), box[:2])


def base() -> Image.Image:
    im = Image.new("RGB", (W, H), BG)
    logo(im)
    d = ImageDraw.Draw(im)
    d.text((1100, 552), "kosnas.com", font=font("SemiBold", 34), fill=COLORS["muted"], anchor="ra")
    return im


def night():
    im = base()
    d = ImageDraw.Draw(im)
    d.text((100, 225), "코스피 야간선물 실시간 추정", font=font("SemiBold", 46), fill=COLORS["ink"])
    return im


def poll(open_: bool):
    im = base()
    d = ImageDraw.Draw(im)
    d.text((100, 222), "다음 장 코스피, 오를까 내릴까?", font=font("Bold", 64), fill=COLORS["ink"])
    if open_:
        f = font("Bold", 46)
        for x0, label, c in ((100, "▲ 오른다", "up"), (620, "▼ 내린다", "down")):
            d.rounded_rectangle((x0, 390, x0 + 480, 490), radius=18, outline=COLORS[c], width=4)
            d.text((x0 + 240, 440), label, font=f, fill=COLORS[c], anchor="mm")
    return im


DIGITS = "0123456789"
HANGUL = "월일화수목금토장기준투표마감결과다수적중회실시간지난밤오른내참여명상승하락보합판정"
# 이름: (굵기, 크기, 글자)
STYLES = {
    "big": ("ExtraBold", 140, DIGITS + ".,"),
    "chg": ("Bold", 58, DIGITS + ".,+-%() ▲▼"),
    "small": ("SemiBold", 36, DIGITS + ".,:/()·%+- ▲▼" + HANGUL),
    "pct": ("ExtraBold", 76, DIGITS + "% " + "오른다내린"),
}


def glyphs():
    out, blob = {}, bytearray()
    for name, (weight, size, chars) in STYLES.items():
        f = font(weight, size)
        asc, desc = f.getmetrics()
        h = asc + desc
        table = {}
        for ch in dict.fromkeys(chars):
            adv = round(f.getlength(ch))
            g = Image.new("L", (max(adv, 1), h), 0)
            ImageDraw.Draw(g).text((0, 0), ch, font=f, fill=255)
            px = bytes(round(v * LEVELS / 255) for v in g.getdata())
            table[ch] = [len(blob), adv]
            blob += px
        out[name] = {"h": h, "g": table}
    return out, bytes(blob)


def palette_and_indices(imgs: dict[str, Image.Image]):
    """바탕 그림들을 한 팔레트로 묶는다. 0번 = 바탕색, 1..TEMPLATE_COLORS = 바탕 그림 색, 그 뒤 = 글자 색 단계"""
    strip = Image.new("RGB", (W, H * len(imgs)))
    for i, im in enumerate(imgs.values()):
        strip.paste(im, (0, H * i))
    q = strip.quantize(colors=TEMPLATE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[: TEMPLATE_COLORS * 3]
    pal += list(BG) * (TEMPLATE_COLORS - len(pal) // 3)
    # 바탕색을 0번으로
    cols = [tuple(pal[i * 3 : i * 3 + 3]) for i in range(TEMPLATE_COLORS)]
    bg_i = min(range(len(cols)), key=lambda i: sum((a - b) ** 2 for a, b in zip(cols[i], BG)))
    order = [bg_i] + [i for i in range(len(cols)) if i != bg_i]
    remap = {old: new for new, old in enumerate(order)}
    colors = [cols[i] for i in order]
    colors[0] = BG
    for c in COLORS.values():
        for a in range(1, LEVELS + 1):
            t = a / LEVELS
            colors.append(tuple(round(BG[k] * (1 - t) + c[k] * t) for k in range(3)))
    data = list(q.getdata())
    out = {}
    for i, name in enumerate(imgs):
        rows = bytearray()
        for y in range(H):
            rows.append(0)  # PNG 필터 없음
            rows += bytes(remap[v] for v in data[(H * i + y) * W : (H * i + y + 1) * W])
        out[name] = rows
    return colors, out


def b64z(b: bytes) -> str:
    return base64.b64encode(zlib.compress(b, 9)).decode()


def main():
    imgs = {"night": night(), "pollOpen": poll(True), "pollClosed": poll(False)}
    colors, rows = palette_and_indices(imgs)
    meta, blob = glyphs()
    for name, im in imgs.items():
        im.save(f"/tmp/og-template-{name}.png")
    ts = [
        "// scripts/og/make_og_assets.py 가 만든 파일이다. 손으로 고치지 않는다.",
        f"export const OG_W = {W};",
        f"export const OG_H = {H};",
        f"export const OG_LEVELS = {LEVELS};",
        f"/** 글자 색 단계가 시작하는 팔레트 번호: {', '.join(COLORS)} 순서로 {LEVELS}개씩 */",
        f"export const OG_TEXT_BASE = {TEMPLATE_COLORS};",
        f"export const OG_PALETTE = \"{base64.b64encode(bytes(v for c in colors for v in c)).decode()}\";",
        "/** 바탕 그림: 줄마다 필터 바이트(0) + 팔레트 번호, zlib */",
        "export const OG_TEMPLATES = {",
        *[f"  {k}: \"{b64z(v)}\"," for k, v in rows.items()],
        "} as const;",
        "/** 글자 조각: 스타일마다 높이 h, 글자마다 [조각 시작, 폭]. 조각은 h×폭 알파(0~15) */",
        f"export const OG_GLYPHS: Record<string, {{ h: number; g: Record<string, [number, number]> }}> = {json.dumps(meta, ensure_ascii=False)};",
        f"export const OG_GLYPH_DATA = \"{b64z(blob)}\";",
        "",
    ]
    assert len(colors) == TEMPLATE_COLORS + len(COLORS) * LEVELS <= 256, len(colors)
    (ROOT / "src/lib/og-assets.ts").write_text("\n".join(ts), encoding="utf-8")


if __name__ == "__main__":
    main()
