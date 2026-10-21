/** 라이트·다크 모드. 고른 값은 이 브라우저에 남기고, 고른 적이 없으면 기기 설정을 따른다. */
export type Theme = "light" | "dark";
export const THEME_KEY = "kosnas:theme";
export const THEME_COLOR: Record<Theme, string> = { light: "#f2f4f6", dark: "#111216" };

/** 첫 그림 전에 <html data-theme>를 정하는 스크립트(깜빡임 방지) */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;}catch(e){}})();`;
