/** 작은 태극기 아이콘(윈도에서는 🇰🇷 이모지가 글자로 나와 SVG로 그린다) */
export function KrFlag({ className = "kr-flag" }: { className?: string }) {
  // 괘: 건(☰ 왼쪽 위)·곤(☷ 오른쪽 아래)·감(☵ 오른쪽 위)·리(☲ 왼쪽 아래). 1 = 이어진 막대, 0 = 끊긴 막대
  const bars: [number, number, number, number[]][] = [
    [8.2, 5.6, -56.3, [1, 1, 1]],
    [27.8, 18.4, -56.3, [0, 0, 0]],
    [27.8, 5.6, 56.3, [0, 1, 0]],
    [8.2, 18.4, 56.3, [1, 0, 1]],
  ];
  return (
    <svg className={className} viewBox="0 0 36 24" aria-hidden>
      <rect
        x="0.5"
        y="0.5"
        width="35"
        height="23"
        rx="2.5"
        fill="#fff"
        stroke="#d6d9de"
      />
      <g transform="rotate(33.7 18 12)">
        <circle cx="18" cy="12" r="6" fill="#0047a0" />
        <path
          d="M12 12a6 6 0 0 1 12 0a3 3 0 0 1-6 0a3 3 0 0 0-6 0z"
          fill="#cd2e3a"
        />
      </g>
      {bars.map(([x, y, deg, kind], i) => (
        <g key={i} transform={`rotate(${deg} ${x} ${y})`} fill="#111">
          {kind.map((solid, k) =>
            solid ? (
              <rect
                key={k}
                x={x - 2.4}
                y={y - 2 + k * 1.5}
                width="4.8"
                height="1"
              />
            ) : (
              <g key={k}>
                <rect x={x - 2.4} y={y - 2 + k * 1.5} width="2.1" height="1" />
                <rect x={x + 0.3} y={y - 2 + k * 1.5} width="2.1" height="1" />
              </g>
            ),
          )}
        </g>
      ))}
    </svg>
  );
}
