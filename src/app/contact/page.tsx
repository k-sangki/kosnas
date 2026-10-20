import type { Metadata } from "next";
import { CONTACT_EMAIL, TextPage } from "@/components/TextPage";

export const metadata: Metadata = { title: "문의", alternates: { canonical: "/contact" } };

export default function Contact() {
  return (
    <TextPage title="문의">
      <p>
        오류 제보나 제안은 <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>로 보내 주세요. 종목 추천이나 개별 투자 상담에는 답하지 않습니다.
      </p>
    </TextPage>
  );
}
