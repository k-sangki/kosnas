/**
 * 작은 태극기 아이콘(윈도에서는 🇰🇷 이모지가 글자로 나와 SVG로 그린다).
 * 도안은 flag-icons(MIT)의 kr.svg와 같은 좌표: 태극은 대각선 위 빨강·아래 파랑(빨강 머리가 왼쪽 위),
 * 건(☰) 왼쪽 위 · 곤(☷) 오른쪽 아래 · 감(☵) 오른쪽 위 · 리(☲) 왼쪽 아래. 3:2 국기 위 원점 기준 0.5배.
 */
const BARS =
  "M-6-26H6v2H-6Zm0 3H6v2H-6Zm0 3H6v2H-6ZM-6 18H6v2H-6Zm0 3H6v2H-6Zm0 3H6v2H-6Z";

export function KrFlag({ className = "kr-flag" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 24" aria-hidden>
      <rect
        x="0.25"
        y="0.25"
        width="35.5"
        height="23.5"
        rx="2"
        fill="#fff"
        stroke="#d6d9de"
        strokeWidth="0.5"
      />
      <g transform="translate(18 12) rotate(-56.3) scale(0.5)">
        <path fill="#000" d={BARS} />
        <path stroke="#fff" d="M0 17v10" />
        <path fill="#cd2e3a" d="M0-12a12 12 0 0 1 0 24Z" />
        <path fill="#0047a0" d="M0-12a12 12 0 0 0 0 24A6 6 0 0 0 0 0Z" />
        <circle cy="-6" r="6" fill="#cd2e3a" />
      </g>
      <g transform="translate(18 12) rotate(-123.7) scale(0.5)">
        <path fill="#000" d={BARS} />
        <path stroke="#fff" d="M0-23.5v3M0 17v3.5m0 3v3" />
      </g>
    </svg>
  );
}
