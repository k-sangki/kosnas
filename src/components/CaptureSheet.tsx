"use client";

import { useEffect, useState } from "react";
import { domToBlob } from "modern-screenshot";
import { Logo } from "./Logo";

interface Props {
  target: () => HTMLElement | null;
  fileName: string;
  shareTitle: string;
  shareUrl: string;
  onClose: () => void;
}

/** 캔버스 최대 면적(모바일 사파리 약 1,670만 px)을 넘지 않게 배율을 정한다 */
function pickScale(el: HTMLElement) {
  const area = el.scrollWidth * el.scrollHeight;
  // 휴대폰 크기는 3배로 선명하게, 모니터 크기는 2배까지
  const max = el.offsetWidth < 600 ? 3 : 2;
  return Math.max(1, Math.min(max, Math.sqrt(16_000_000 / area)));
}

/** 이미지 바탕색: 지금 화면 모드(라이트·다크)의 배경 */
const bgColor = () => getComputedStyle(document.body).backgroundColor || "#f2f4f6";

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/** 웹폰트 파일 → data URL. 한 번 받은 파일은 다시 받지 않는다 */
const fontData = new Map<string, Promise<string>>();
function dataUrl(url: string) {
  let p = fontData.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.blob())
      .then(
        (b) =>
          new Promise<string>((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => res(fr.result as string);
            fr.onerror = rej;
            fr.readAsDataURL(b);
          }),
      );
    p.catch(() => fontData.delete(url));
    fontData.set(url, p);
  }
  return p;
}

function covers(range: string, codes: number[]) {
  return range.split(",").some((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, "").split("-");
    const lo = parseInt(a.replace(/\?/g, "0"), 16);
    const hi = b ? parseInt(b, 16) : parseInt(a.replace(/\?/g, "F"), 16);
    return codes.some((c) => c >= lo && c <= hi);
  });
}

/**
 * 캡처에 쓰인 글자가 들어 있는 웹폰트 조각만 골라 @font-face로 만든다.
 * Pretendard는 92조각(약 3MB)이라 다 넣으면 캡처가 몇 초씩 걸린다.
 */
async function fontCss(el: HTMLElement): Promise<string | undefined> {
  const codes = Array.from(new Set(Array.from(el.textContent ?? "", (ch) => ch.codePointAt(0)!)));
  const rules: { css: string; url: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(list)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const range = rule.style.getPropertyValue("unicode-range");
      if (range && !covers(range, codes)) continue;
      const m = rule.style.getPropertyValue("src").match(/url\(["']?([^"')]+)["']?\)/);
      if (!m) continue;
      rules.push({ css: rule.cssText, url: new URL(m[1], sheet.href ?? location.href).href });
    }
  }
  if (!rules.length) return undefined;
  const parts = await Promise.all(
    rules.map(async ({ css, url }) => {
      const data = await dataUrl(url);
      return css.replace(/src:[^;]+;?/, `src: url("${data}") format("woff2");`);
    }),
  );
  return parts.join("\n");
}

/** globals.css의 색·모양 변수. 새 변수를 만들면 여기도 넣는다 */
const TOKENS = [
  "--amber",
  "--amber-ink",
  "--amber-soft",
  "--bg",
  "--card",
  "--chip",
  "--coral",
  "--coral-soft",
  "--down",
  "--down-soft",
  "--font",
  "--ink",
  "--ink-2",
  "--kr-line",
  "--line",
  "--line-2",
  "--mint",
  "--mint-ink",
  "--mint-soft",
  "--muted",
  "--pine",
  "--pine-2",
  "--radius",
  "--radius-sm",
  "--rain",
  "--rain-soft",
  "--shadow",
  "--shadow-2",
  "--up",
  "--up-soft",
];

const sides = (p: string, suf = "") => ["top", "right", "bottom", "left"].map((x) => `${p}-${x}${suf}`);
/**
 * 복사할 스타일 속성. 노드마다 모든 계산 스타일(약 350개)을 읽으면 표가 큰 캡처(3시간 간격 16일)는
 * 몇 초가 걸려서, 이 사이트 CSS가 실제로 쓰는 속성만 복사한다. globals.css에 새 속성을 쓰면 여기도 넣는다.
 */
const STYLE_PROPS = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "box-sizing",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  ...sides("margin"),
  ...sides("padding"),
  ...sides("border", "-width"),
  ...sides("border", "-style"),
  ...sides("border", "-color"),
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-collapse",
  "border-spacing",
  "table-layout",
  "caption-side",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "background-clip",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant-numeric",
  "font-feature-settings",
  "line-height",
  "letter-spacing",
  "text-align",
  "vertical-align",
  "white-space",
  "word-break",
  "overflow-wrap",
  "text-decoration-line",
  "text-decoration-color",
  "text-overflow",
  "text-transform",
  "overflow-x",
  "overflow-y",
  "visibility",
  "opacity",
  "transform",
  "transform-origin",
  "box-shadow",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "order",
  "align-items",
  "align-self",
  "align-content",
  "justify-content",
  "justify-items",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column-start",
  "grid-column-end",
  "object-fit",
  "object-position",
  "list-style-type",
  "fill",
  "stroke",
  "stroke-width",
  "-webkit-font-smoothing",
];

/**
 * 페이지 CSS 규칙을 모은다. 미디어 쿼리는 지금 화면 기준으로 풀어 넣는다
 * (이미지 안에서는 미디어 쿼리가 캡처 틀 크기로 다시 계산되기 때문).
 * @font-face는 fontCss가 글자에 맞는 조각만 따로 넣는다.
 */
function pageCss(): string {
  const out: string[] = [];
  const walk = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSFontFaceRule) continue;
      if (r instanceof CSSMediaRule) {
        if (window.matchMedia(r.conditionText).matches) walk(r.cssRules);
        continue;
      }
      if (r instanceof CSSSupportsRule) {
        if (CSS.supports(r.conditionText)) walk(r.cssRules);
        continue;
      }
      out.push(r.cssText);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      // 읽을 수 없는 외부 스타일시트
    }
  }
  return out.join("\n");
}

/**
 * SVG 이미지 안의 웹폰트는 decode() 뒤에 따로 풀려서, 바로 그리면 글자가 빠진다.
 * 작은 캔버스에 되풀이해 그려 보고 몇 번 연속으로 같아지면(글꼴이 다 들어오면) 끝낸다.
 */
async function fontsSettled(img: HTMLImageElement, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w / 3));
  c.height = Math.max(1, Math.round(h / 3));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const start = performance.now();
  let last = -1;
  let same = 0;
  while (performance.now() - start < 2500) {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 16) sum = (sum + d[i] * 31 + d[i + 3]) % 1_000_000_007;
    same = sum === last ? same + 1 : 0;
    last = sum;
    if (same >= 2 && performance.now() - start > 150) return;
    await new Promise((r) => setTimeout(r, 60));
  }
}

/**
 * 빠른 캡처: 노드를 그대로 복제하고 페이지 CSS를 통째로 넣은 SVG를 캔버스에 그린다.
 * 노드마다 계산 스타일을 읽어 인라인으로 박는 방식(modern-screenshot)보다 휴대폰에서 몇 배 빠르다.
 * 클래스만으로 모양이 정해지므로 같은 CSS를 넣으면 화면과 같게 그려진다. 트레이딩뷰 위젯(다른 사이트 iframe)은 그릴 수 없어 뺀다.
 */
async function fastCapture(el: HTMLElement, scale: number, fonts: string | undefined): Promise<Blob> {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".ad-slot, .no-capture").forEach((n) => n.remove());
  // html의 data-theme(다크 모드) 규칙이 이미지 안에서도 맞도록 감싸는 div에 같은 변수를 옮긴다
  const root = getComputedStyle(document.documentElement);
  // html·body에 걸린 글꼴·색 같은 상속 값은 감싸는 div에 옮긴다 (이미지 안에는 body가 없다)
  const body = getComputedStyle(document.body);
  const wrap = document.createElement("div");
  wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  for (const k of ["font-family", "color", "line-height", "word-break", "-webkit-font-smoothing"]) {
    wrap.style.setProperty(k, body.getPropertyValue(k));
  }
  for (const k of TOKENS) wrap.style.setProperty(k, root.getPropertyValue(k));
  wrap.style.setProperty("background", body.getPropertyValue("background-color"));
  // 모바일 크롬의 글자 자동 확대가 이미지 안에서 켜지지 않게 한다
  wrap.style.setProperty("-webkit-text-size-adjust", "100%");
  wrap.style.setProperty("text-size-adjust", "100%");
  wrap.style.width = `${w}px`;
  wrap.style.height = `${h}px`;
  wrap.appendChild(clone);
  // font-display: swap이면 이미지가 웹폰트를 기다리지 않고 대체 글꼴로 그려진다
  const faces = (fonts ?? "").replace(/font-display:\s*[\w-]+;?/g, "font-display: block;");
  const css = `${faces}\n${pageCss()}`.replace(/]]>/g, "]] >");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<style><![CDATA[${css}]]></style>` +
    `<foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(wrap)}</foreignObject></svg>`;
  const img = new Image();
  img.decoding = "sync";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  await fontsSettled(img, w, h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(w * scale);
  canvas.height = Math.floor(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = bgColor();
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("capture failed");
  return blob;
}

/** 예전 방식: 노드마다 계산 스타일을 복사한다. 빠른 캡처가 실패하면 쓴다 */
async function slowCapture(el: HTMLElement, scale: number, cssText: string | undefined): Promise<Blob> {
  const blob = await domToBlob(el, {
    font: cssText ? { cssText } : undefined,
    includeStyleProperties: STYLE_PROPS,
    scale,
    backgroundColor: bgColor(),
    type: "image/png",
    filter: (n) => !(n instanceof HTMLElement && (n.classList.contains("ad-slot") || n.classList.contains("no-capture"))),
  });
  if (!blob) throw new Error("capture failed");
  return blob;
}

export async function captureElement(el: HTMLElement): Promise<Blob> {
  el.classList.add("capturing");
  try {
    await document.fonts?.ready;
    await nextFrame();
    const cssText = await fontCss(el).catch(() => undefined);
    const scale = pickScale(el);
    try {
      return await fastCapture(el, scale, cssText);
    } catch {
      return await slowCapture(el, scale, cssText);
    }
  } finally {
    el.classList.remove("capturing");
  }
}

export function CaptureSheet({ target, fileName, shareTitle, shareUrl, onClose }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const el = target();
    if (!el) return;
    let url: string | null = null;
    captureElement(el)
      .then((b) => {
        url = URL.createObjectURL(b);
        setBlob(b);
        setPreview(url);
      })
      .catch(() => setError(true));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [target]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;
  const canShareFile = typeof navigator !== "undefined" && !!file && !!navigator.canShare?.({ files: [file] });

  // 아이폰은 웹에서 사진첩에 바로 넣을 수 없어 공유 메뉴의 "이미지 저장"을 쓴다.
  // 안드로이드·PC는 파일로 받으면 갤러리(Download 앨범)에 바로 보인다.
  const ios =
    typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  const save = async () => {
    if (!preview || !file) return;
    if (ios && canShareFile) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        // 사용자가 취소한 경우
      }
      return;
    }
    const a = document.createElement("a");
    a.href = preview;
    a.download = fileName;
    a.click();
    setToast(/Android/.test(navigator.userAgent) ? "갤러리에 저장했어요" : "이미지를 저장했어요");
  };

  const shareImage = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: shareTitle, text: `${shareTitle}\n${shareUrl}` });
    } catch {
      // 사용자가 취소한 경우
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      } catch {
        return;
      }
    }
    await copyLink();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("링크를 복사했어요");
    } catch {
      setToast("복사하지 못했어요");
    }
  };

  const naver = () => {
    const u = `https://share.naver.com/web/shareView?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`;
    window.open(u, "_blank", "noopener,noreferrer,width=600,height=700");
  };

  return (
    <div className="sheet-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label="캡처 공유">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Logo />
          <button onClick={onClose} aria-label="닫기" style={{ fontSize: 22, width: 36, height: 36 }}>
            ✕
          </button>
        </div>
        {error ? (
          <div className="error">캡처하지 못했습니다. 다시 시도해 주세요.</div>
        ) : preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="sheet-preview" src={preview} alt="대시보드 캡처 미리보기" />
        ) : (
          <div className="skeleton" />
        )}
        <div className="share-grid">
          <button className="share-btn primary" onClick={save} disabled={!blob}>
            이미지 저장
          </button>
          {canShareFile && (
            <button className="share-btn" onClick={shareImage} disabled={!blob}>
              이미지 공유하기 (카톡·인스타·카페·블로그)
            </button>
          )}
          <button className="share-btn" onClick={shareLink}>
            링크 공유
          </button>
          <button className="share-btn naver" onClick={naver}>
            네이버 블로그·카페
          </button>
          <button className="share-btn" onClick={copyLink}>
            링크 복사
          </button>
        </div>
        {ios && <p className="muted save-tip">저장 메뉴가 열리면 &quot;이미지 저장&quot;을 누르세요. 미리보기를 길게 눌러도 저장할 수 있어요.</p>}
        <p className="muted" style={{ marginTop: 12 }}>
          블로그·카페 글에는 저장한 이미지를 올리고 링크를 함께 붙여 보세요.
        </p>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
