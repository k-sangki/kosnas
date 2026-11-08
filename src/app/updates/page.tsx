import type { Metadata } from "next";
import Link from "next/link";
import { pageMeta } from "@/lib/seo";
import { TextPage } from "@/components/TextPage";
import { CHANGELOG } from "@/lib/changelog";
import { sectorData } from "@/lib/sectors";
import { DATA as RECENT } from "@/lib/investors";
import F13 from "@/data/investors-13f.json";

export const metadata: Metadata = pageMeta({
  title: "업데이트 기록",
  description: "코스나스(KosNas)의 자료 갱신 주기와 지금 화면에 실린 자료의 기준일, 사이트에 새로 생기거나 바뀐 기능을 날짜순으로 정리한 기록입니다.",
  path: "/updates",
});

export default function Updates() {
  return (
    <TextPage title="업데이트 기록">
      <p>
        코스나스는 매일 자료를 새로 받고, 이용자 의견과 오류 제보를 반영해 화면을 고쳐 나갑니다. 지금 실린 자료의 기준일과 갱신 주기, 그리고 지금까지 바뀐 것을
        날짜순으로 적었습니다.
      </p>

      <h2>지금 실린 자료</h2>
      <ul>
        <li>
          <b>국장 섹터·산업·테마·종목</b>: {sectorData("kr").asof} 종가 기준. 금융위원회 주식시세정보가 다음 영업일 오후에 올라오면 거래일 오후 2시 무렵 다시
          계산합니다.
        </li>
        <li>
          <b>유명 투자자 최근 매매</b>: {RECENT.updated} 갱신. SEC 공시와 ARK 보유 내역을 매일 아침과 저녁에 다시 받습니다.
        </li>
        <li>
          <b>유명 투자자 13F 포트폴리오</b>: {F13.updated} 확인. 매일 새 분기 보고서가 나왔는지 확인합니다.
        </li>
        <li>
          <b>코스피 야간 추정·대시보드 시세</b>: 실시간. 해외 무기한선물 시세를 몇 초에서 30초마다 받습니다.
        </li>
      </ul>

      <h2>바뀐 것</h2>
      {CHANGELOG.map((c) => (
        <section key={c.date}>
          <h3>{c.date}</h3>
          <ul>
            {c.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}

      <p>
        오류를 발견하셨거나 바랐으면 하는 기능이 있으면 <Link href="/contact">문의</Link>로 알려 주세요. 사이트 소개와 운영 원칙은 <Link href="/about">소개</Link>에
        있습니다.
      </p>
    </TextPage>
  );
}
