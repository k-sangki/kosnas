import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_EMAIL, TextPage } from "@/components/TextPage";

export const metadata: Metadata = {
  title: "문의",
  description: "KosNas 오류 제보, 자료 수정 요청, 제안을 보내는 곳.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <TextPage title="문의">
      <p>
        KosNas에 대한 문의는 메일로 받습니다: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <h2>이런 내용을 보내 주세요</h2>
      <ul>
        <li>숫자가 이상하거나 화면이 깨지는 오류(어느 화면인지, 기기와 브라우저, 본 시각을 함께 적어 주시면 빨리 찾을 수 있습니다)</li>
        <li>종목이 맞지 않는 섹터·산업에 들어가 있는 경우</li>
        <li>추가했으면 하는 화면이나 시세 카드</li>
        <li>개인정보, 광고, 저작권 관련 문의</li>
      </ul>
      <h2>답하지 않는 내용</h2>
      <p>종목 추천, 매수·매도 시점, 개별 투자 상담에는 답하지 않습니다. KosNas는 모든 이용자에게 같은 정보를 보여주는 서비스이며 투자 자문을 하지 않습니다.</p>
      <h2>답변</h2>
      <p>
        보통 영업일 기준 3일 안에 답장합니다. 자료 수정은 확인되는 대로 다음 갱신에 반영합니다. 서비스 소개는 <Link href="/about">소개</Link>, 개인정보 처리는{" "}
        <Link href="/privacy">개인정보처리방침</Link>에 있습니다.
      </p>
    </TextPage>
  );
}
