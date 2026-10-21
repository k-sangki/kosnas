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
