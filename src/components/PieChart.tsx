import type { Slice } from "@/lib/investors13f";

// 이웃 조각이 잘 갈리도록 밝은 색을 번갈아 둔다. '기타'는 늘 회색
const COLORS = [
  "#3ec5e0",
  "#4fc08d",
  "#ffae42",
  "#d8b8ea",
  "#ff7a7a",
  "#6aa8ff",
  "#f5d33d",
  "#2fb3a3",
  "#ff9ec4",
  "#9b8cff",
  "#a3d65c",
  "#ff8f5a",
  "#7fd6f5",
  "#c79a6b",
  "#e06fd0",
  "#5c7cfa",
];
const ETC = "#b0b8c1";

const pt = (a: number, r: number) => [100 + r * Math.sin(a), 100 - r * Math.cos(a)].map((v) => v.toFixed(2)).join(" ");

function arcs(slices: Slice[]) {
  const total = slices.reduce((s, x) => s + x.weight, 0) || 1;
  let a = 0;
  let c = 0;
  return slices.map((s) => {
    const color = s.key === "etc" ? ETC : COLORS[c++ % COLORS.length];
    const span = (s.weight / total) * Math.PI * 2;
    const d =
      span >= Math.PI * 2 - 1e-6
        ? "M100 0 A100 100 0 1 1 99.99 0 Z"
        : `M100 100 L${pt(a, 100)} A100 100 0 ${span > Math.PI ? 1 : 0} 1 ${pt(a + span, 100)} Z`;
    a += span;
    return { ...s, color, d };
  });
}

/** 포트폴리오 파이차트(12시 방향부터 시계 방향, 비중 큰 순) + 오른쪽 범례 '이름: n%' */
export function PieChart({ slices, label }: { slices: Slice[]; label: string }) {
  const parts = arcs(slices);
  return (
    <figure className="pie">
      <svg viewBox="0 0 200 200" className="pie-svg" role="img" aria-label={label}>
        {parts.map((p) => (
          <path key={p.key} d={p.d} fill={p.color} stroke="var(--card)" strokeWidth={parts.length > 1 ? 0.8 : 0}>
            <title>{`${p.name}${p.tag ? ` ${p.tag}` : ""}: ${p.weight.toFixed(1)}%`}</title>
          </path>
        ))}
      </svg>
      <ul className="pie-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <i style={{ background: p.color }} aria-hidden />
            <span className="pie-name">
              {p.name}
              {p.tag && <small className="muted"> {p.tag}</small>}
            </span>
            <b className="num">{p.weight.toFixed(1)}%</b>
          </li>
        ))}
      </ul>
    </figure>
  );
}
