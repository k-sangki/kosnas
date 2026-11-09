import Link from "next/link";

/** 첫 화면 '오늘의 한 표' 아래 한 줄 띠: 투자 성향 테스트로 가는 길. 모두에게 보이고 캡처에는 들어가지 않는다 */
export function TestBand() {
  return (
    <Link href="/test" className="card test-band no-capture">
      <span className="test-band-emoji" aria-hidden>
        🐢🚀
      </span>
      <span className="test-band-text">
        <b>나는 어떤 투자 대가와 닮았을까?</b>
        <span className="muted">12문항 · 1분 투자 성향 테스트</span>
      </span>
      <span className="test-band-go" aria-hidden>
        ›
      </span>
    </Link>
  );
}
