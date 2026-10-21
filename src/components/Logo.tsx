export function Logo() {
  return (
    <span className="logo">
      {/* kos(코스피·코스닥) + nas(나스닥) 사이에 민트 점. 글자는 o의 가운데를 경계로 위 빨강(상승)·아래 파랑(하락) */}
      <span className="logo-t">kos</span>
      <i className="logo-dot" aria-hidden />
      <span className="logo-t">nas</span>
    </span>
  );
}

/**
 * 캡처 이미지용 로고. 이미지로 그릴 때는 글자에 그라데이션을 입히는 CSS(background-clip: text)가 빠져서
 * SVG 글자에 같은 그라데이션(기준선에서 x높이까지, 가운데가 o의 가운데)을 입힌다.
 */
export function LogoSvg() {
  // 글자 크기 22, 기준선 y=20, x높이 약 0.53em
  return (
    <svg className="logo-svg" width="86" height="26" viewBox="0 0 86 26" aria-label="KosNas">
      <defs>
        <linearGradient id="logo-g" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="8.3">
          <stop offset="0" stopColor="var(--down)" />
          <stop offset="1" stopColor="var(--up)" />
        </linearGradient>
      </defs>
      <text x="0" y="20" fontSize="22" fontWeight="800" letterSpacing="-0.88" fill="url(#logo-g)">
        kos
      </text>
      <circle cx="41.9" cy="14.2" r="3.08" fill="var(--up)" />
      <text x="46.5" y="20" fontSize="22" fontWeight="800" letterSpacing="-0.88" fill="url(#logo-g)">
        nas
      </text>
    </svg>
  );
}
