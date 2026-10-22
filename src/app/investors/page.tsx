import type { Metadata } from "next";
import Link from "next/link";
import { ArkTrades, RecentMoves } from "@/components/Investors";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { DATA } from "@/lib/investors";

export const metadata: Metadata = {
  title: "유명 투자자 최근 매매 - 워런 버핏·캐시 우드 지분 공시와 매일 매매",
  description:
    "워런 버핏, 캐시 우드, 칼 아이칸, 댄 로브 같은 유명 투자자가 최근 30일 동안 SEC에 낸 지분 공시(13D·13G)와 내부자 매매 공시(Form 4), ARK 펀드의 매일 매매를 정리했습니다.",
  keywords: ["버핏 매수", "캐시 우드 매매", "ARK 매매", "13D", "13G", "Form 4", "유명 투자자 매매", "헤지펀드 지분 공시"],
  alternates: { canonical: "/investors" },
};

export default function InvestorsPage() {
  return (
    <div className="shell">
      <SiteHeader active="us" />
      <main className="stack">
        <h1 className="page-title">유명 투자자 최근 매매</h1>
        <p className="lead">
          유명 투자자 {DATA.investors.length}명이 최근 {DATA.window}일 동안 미국 증권거래위원회(SEC)에 낸 지분·매매 공시와, 캐시 우드의 ARK 펀드가 매일 공개하는
          보유 내역에서 찾은 매매입니다. 줄을 누르면 SEC 원문이 열립니다.
        </p>
        <RecentMoves />
        <div id="ark">
          <ArkTrades />
        </div>
        <section className="card seo-text">
          <h2 className="card-title">어떤 공시를 보나요</h2>
          <ul>
            <li>
              <b>13D·13G(지분 5% 넘는 보유 신고).</b> 한 회사 주식을 5% 넘게 가지면 내는 보고서입니다. 경영에 관여할 수 있는 투자자는 13D를 사건 뒤 10일 안에
              내고, 지분이 1%p 넘게 바뀌면 2영업일 안에 정정합니다. 소극적인 투자자는 13G로 더 느슨하게 신고합니다. 이 화면은 지분율이 앞 보고서보다 늘었는지
              줄었는지를 함께 보여줍니다.
            </li>
            <li>
              <b>Form 4(대주주·임원 매매 신고).</b> 한 회사 지분을 10% 넘게 가진 투자자는 사고판 뒤 2영업일 안에 거래 날짜, 주식 수, 가격을 신고합니다. 장내에서
              사고판 것(매수·매도)이 있으면 그것만, 없으면 그 밖의 취득·처분을 적습니다.
            </li>
            <li>
              <b>ARK 매일 보유 내역.</b> ARK 인베스트는 ETF마다 그날 들고 있는 종목과 주식 수를 공개합니다. KosNas가 이를 매일 받아 전날과 비교합니다. ETF는
              투자자가 돈을 넣고 빼면 모든 종목 수량이 같은 비율로 바뀌므로, 그 몫을 빼고도 수량이 1% 넘게 바뀐 종목만 매매로 봅니다. 금액은 그날 평가액으로
              계산한 추정치입니다.
            </li>
          </ul>
          <h2 className="card-title">왜 분기 보고서(13F)는 쓰지 않나요</h2>
          <p>
            기관 투자자의 분기 보유 보고서(13F)는 분기가 끝나고 45일 뒤에 나와서, 볼 때는 이미 두세 달에서 넉 달 지난 보유 현황입니다. KosNas는 최근 한 달 안에
            나온 공시만 보여줍니다. 그래서 큰 지분을 갖지 않은 종목의 매매나, 지분 공시 의무가 없는 작은 매매는 여기에 나오지 않습니다.
          </p>
          <p>
            유명 투자자가 샀다고 해서 그 종목이 오른다는 뜻은 아니며, KosNas는 특정 종목의 매수·매도를 권하지 않습니다. 원천은 SEC EDGAR와 ARK 인베스트의 공개
            자료이고, 매일 아침과 저녁에 다시 받습니다. 미국 증시 흐름은 <Link href="/us">미장</Link>에서 볼 수 있습니다.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
