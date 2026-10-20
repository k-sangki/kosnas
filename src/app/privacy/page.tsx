import type { Metadata } from "next";
import { CONTACT_EMAIL, TextPage } from "@/components/TextPage";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "KosNas 개인정보처리방침",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return (
    <TextPage title="개인정보처리방침">
      <p>시행일: 2026년 10월 20일</p>
      <p>
        KosNas(이하 &quot;서비스&quot;)는 회원가입 없이 이용할 수 있으며, 이름·전화번호·이메일 같은 개인정보를 수집하지 않습니다. 서비스 이용 과정에서 처리되는
        정보와 처리 방법은 다음과 같습니다.
      </p>

      <h2>1. 외부 서비스</h2>
      <ul>
        <li>차트와 종목 가격: 트레이딩뷰(TradingView) 위젯이 이용자의 브라우저에서 직접 불러옵니다. 위젯을 여는 동안 트레이딩뷰가 접속 정보를 처리할 수 있습니다.</li>
        <li>호스팅: Cloudflare가 서비스 보안과 운영을 위해 접속 기록(IP 주소, 브라우저 정보 등)을 처리할 수 있습니다.</li>
      </ul>

      <h2>2. 광고와 쿠키</h2>
      <p>
        서비스는 Google 애드센스 광고를 게재할 수 있습니다. Google을 비롯한 제3자 광고 사업자는 쿠키를 사용해 이용자의 이전 방문 기록을 바탕으로 광고를 게재할 수
        있습니다. 맞춤 광고는{" "}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
          Google 광고 설정
        </a>
        에서 끌 수 있고, 제3자 광고 쿠키는{" "}
        <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">
          aboutads.info
        </a>
        에서 거부할 수 있습니다. 자세한 내용은{" "}
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
          Google의 파트너 사이트 데이터 사용 방식
        </a>
        을 참고하세요.
      </p>

      <h2>3. 문의</h2>
      <p>
        개인정보 관련 문의는 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>로 보내주세요.
      </p>

      <h2>4. 변경</h2>
      <p>이 방침이 바뀌면 이 페이지에 시행일과 함께 알립니다.</p>
    </TextPage>
  );
}
