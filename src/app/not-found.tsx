import Link from "next/link";
import { TextPage } from "@/components/TextPage";

export default function NotFound() {
  return (
    <TextPage title="페이지를 찾을 수 없습니다">
      <p>주소가 바뀌었거나 없는 페이지입니다.</p>
      <p>
        <Link href="/">대시보드</Link>, <Link href="/kr">국장</Link>, <Link href="/us">미장</Link>, <Link href="/guide">가이드</Link>에서 다시 찾아 주세요.
      </p>
    </TextPage>
  );
}
