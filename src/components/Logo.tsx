export function Logo() {
  return (
    <span className="logo">
      {/* kos(코스피·코스닥) + nas(나스닥) 사이에 민트 점 */}
      kos
      <i className="logo-dot" aria-hidden />
      <span className="logo-nas">nas</span>
    </span>
  );
}
