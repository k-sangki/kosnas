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
 * 홈 화면에서 연 경우에는 항상 숨긴다.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => {
      remember();
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저 정보는 그린 뒤에만 알 수 있다
    if (isIos() && !remembered()) setIos(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt && !ios) return null;

  const click = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") remember();
      setPrompt(null);
      return;
    }
    setGuide(true);
  };

  const done = () => {
    remember();
    setGuide(false);
    setIos(false);
  };

  return (
    <>
      <button className="fab fab-sub" onClick={click}>
        <span aria-hidden>＋</span> 홈 화면에 추가
      </button>
      {/* 버튼 줄이 transform을 써서, 안내 창은 body에 그려야 화면 전체를 덮는다 */}
      {guide &&
        createPortal(
          <div className="sheet-bg" onClick={() => setGuide(false)} role="dialog" aria-modal="true" aria-label="홈 화면에 추가 방법">
            <div className="sheet install-guide" onClick={(e) => e.stopPropagation()}>
              <b>홈 화면에 KosNas 추가하기</b>
              <ol>
                <li>
                  화면 아래(또는 위)의{" "}
                  <span className="ios-share" aria-label="공유">
                    공유
                  </span>{" "}
                  버튼을 누르세요.
                </li>
                <li>
                  메뉴를 내려 <b>홈 화면에 추가</b>를 누르세요.
                </li>
              </ol>
              <div className="install-actions">
                <button className="share-btn" onClick={done}>
                  이미 추가했어요
                </button>
                <button className="share-btn primary" onClick={() => setGuide(false)}>
                  확인
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
