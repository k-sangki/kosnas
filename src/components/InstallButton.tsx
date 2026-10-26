"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DONE_KEY = "kosnas:installed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** 홈 화면 추가가 안 되는 앱 안 브라우저(네이버·카카오톡·다음·인스타·페이스북·라인 등) */
function inAppName(): string | null {
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/NAVER\(inapp|NaverMatome|Whale\/.*inapp/i.test(ua)) return "naver";
  if (/DaumApps|Instagram|FBAN|FBAV|Line\/|everytimeApp|BAND\//i.test(ua)) return "other";
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return "other";
  return null;
}

function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

/** 같은 주소를 바깥 브라우저로 연다. 열고 나면 설치 창을 띄우도록 ?install=1을 붙인다 */
function openOutside(app: string) {
  const u = new URL(location.href);
  u.searchParams.set("install", "1");
  const url = u.toString();
  if (app === "kakao") {
    location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    return true;
  }
  if (isAndroid()) {
    location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    return true;
  }
  return false;
}

function remembered() {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {}
}

/**
 * 홈 화면에 추가 버튼.
 * 안드로이드·PC 크롬은 브라우저 설치 창을 띄우고, 이미 설치했으면 브라우저가 알려주지 않아 버튼이 숨는다.
 * 아이폰은 설치 창을 띄울 수 없어 공유 메뉴 안내를 보여주고, "이미 추가했어요"를 누르면 다시 보이지 않는다.
 * 네이버·카카오톡 같은 앱 안 브라우저는 홈 화면 추가가 안 된다. 카카오톡은 바깥 브라우저로,
 * 안드로이드는 크롬으로 같은 주소를 열고(?install=1 → 설치 버튼 창), 아이폰의 다른 앱은 Safari로 여는 법을 안내한다.
 * 홈 화면에서 연 경우에는 항상 숨긴다.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [inApp, setInApp] = useState<string | null>(null);
  const [guide, setGuide] = useState<"ios" | "inapp" | "ready" | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    // 앱 안 브라우저에서 넘어온 경우: 설치 창은 누를 때만 뜨므로 큰 버튼 하나를 먼저 보인다
    const fromApp = new URLSearchParams(location.search).get("install") === "1";
    if (fromApp) {
      const u = new URL(location.href);
      u.searchParams.delete("install");
      history.replaceState(history.state, "", u.toString());
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      if (fromApp) setGuide("ready");
    };
    const onInstalled = () => {
      remember();
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const app = inAppName();
    /* eslint-disable react-hooks/set-state-in-effect -- 브라우저 정보는 그린 뒤에만 알 수 있다 */
    if (app && !remembered()) setInApp(app);
    else if (isIos() && !remembered()) {
      setIos(true);
      if (fromApp) setGuide("ios");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt && !ios && !inApp) return null;

  const install = async () => {
    if (!prompt) return;
    setGuide(null);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") remember();
    setPrompt(null);
  };

  const click = async () => {
    if (prompt) return install();
    if (inApp) {
      if (openOutside(inApp)) return;
      return setGuide("inapp");
    }
    setGuide("ios");
  };

  const done = () => {
    remember();
    setGuide(null);
    setIos(false);
    setInApp(null);
  };

  const close = () => setGuide(null);
  const shareIcon = (
    <svg className="ios-share-icon" viewBox="0 0 24 24" aria-label="공유" role="img">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <>
      <button className="fab fab-sub" onClick={click}>
        <span aria-hidden>＋</span> 홈 화면에 추가
      </button>
      {/* 버튼 줄이 transform을 써서, 안내 창은 body에 그려야 화면 전체를 덮는다 */}
      {guide &&
        createPortal(
          <div className={`sheet-bg${guide === "ios" ? " install-ios" : ""}`} onClick={close} role="dialog" aria-modal="true" aria-label="홈 화면에 추가 방법">
            <div className="sheet install-guide" onClick={(e) => e.stopPropagation()}>
              {guide === "ready" && (
                <>
                  <b>홈 화면에 KosNas 추가하기</b>
                  <p>아래 버튼을 누르고, 뜨는 창에서 <b>설치</b>를 누르면 끝이에요.</p>
                  <div className="install-actions">
                    <button className="share-btn" onClick={close}>
                      나중에
                    </button>
                    <button className="share-btn primary" onClick={install}>
                      홈 화면에 추가
                    </button>
                  </div>
                </>
              )}
              {guide === "inapp" && (
                <>
                  <b>지금 앱 안에서는 홈 화면에 추가할 수 없어요</b>
                  <ol>
                    <li>
                      화면 아래(또는 위)의 <b>⋯</b> 또는 <b>공유</b> 버튼을 누르세요.
                    </li>
                    <li>
                      <b>Safari로 열기</b>(또는 &lsquo;다른 브라우저로 열기&rsquo;)를 누르세요.
                    </li>
                    <li>
                      Safari에서 {shareIcon} <b>공유 → 홈 화면에 추가</b>를 누르세요.
                    </li>
                  </ol>
                  <div className="install-actions">
                    <button className="share-btn" onClick={done}>
                      이미 추가했어요
                    </button>
                    <button className="share-btn primary" onClick={close}>
                      확인
                    </button>
                  </div>
                </>
              )}
              {guide === "ios" && (
                <>
                  <b>홈 화면에 KosNas 추가하기</b>
                  <ol>
                    <li>
                      화면 아래의 {shareIcon} <b>공유</b> 버튼을 누르세요. 안 보이면 <b>⋯</b>를 먼저 누르세요.
                    </li>
                    <li>
                      메뉴를 내려 <b>홈 화면에 추가</b>를 누르세요.
                    </li>
                    <li>
                      오른쪽 위 <b>추가</b>를 누르면 끝이에요.
                    </li>
                  </ol>
                  <div className="install-actions">
                    <button className="share-btn" onClick={done}>
                      이미 추가했어요
                    </button>
                    <button className="share-btn primary" onClick={close}>
                      확인
                    </button>
                  </div>
                </>
              )}
            </div>
            {guide === "ios" && (
              <span className="install-arrow" aria-hidden>
                ↓
              </span>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
