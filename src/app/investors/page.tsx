import type { Metadata } from "next";
import Link from "next/link";
import { Crowd, InvestorList, SectorFlows } from "@/components/Investors";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { mainPeriod, quarter } from "@/lib/investors";

export const metadata: Metadata = {
  title: "유명 투자자 포트폴리오 - 워런 버핏·마이클 버리 13F 보유 종목",
  description:
    "워런 버핏, 빌 애크먼, 스탠리 드러켄밀러, 마이클 버리, 캐시 우드 같은 유명 투자자가 SEC 13F 보고서로 신고한 미국 주식 보유 종목과 지난 분기 대비 새로 산 종목·판 종목.",
  keywords: ["13F", "버핏 포트폴리오", "워런 버핏 보유 종목", "마이클 버리 포트폴리오", "유명 투자자 포트폴리오", "헤지펀드 보유 종목", "캐시 우드"],
  alternates: { canonical: "/investors" },
};

export default function InvestorsPage() {
  return (
    <div className="shell">
      <SiteHeader active="us" />
      <main className="stack">
        <h1 className="page-title">유명 투자자 포트폴리오</h1>
        <p className="lead">
          미국 기관 투자자가 분기마다 SEC에 신고하는 13F 보고서로 유명 투자자들이 {quarter(mainPeriod())} 말에 무엇을 들고 있었는지, 지난 분기보다 무엇을 새로
          사고 팔았는지 정리했습니다. 이름을 누르면 전체 보유 종목이 나옵니다.
        </p>
        <InvestorList title="투자자" />
        <SectorFlows />
        <Crowd kind="buy" />
        <Crowd kind="sell" />
        <section className="card seo-text">
          <h2 className="card-title">13F 보고서란</h2>
          <p>
            미국에서 운용하는 주식 자산이 1억 달러가 넘는 기관 투자자는 분기가 끝나고 45일 안에 미국 증권거래위원회(SEC)에 13F-HR 보고서를 내야 합니다. 이
            보고서에는 분기 마지막 날 기준으로 들고 있던 미국 상장 주식, ETF, 상장 옵션의 종목과 주식 수, 평가액이 들어 있습니다. 누구나 SEC의 EDGAR 시스템에서
            볼 수 있는 공개 자료라서, 이름난 투자자가 어떤 종목에 돈을 걸었는지 확인하는 가장 정확한 방법으로 널리 쓰입니다.
          </p>
          <h2 className="card-title">읽을 때 알아 둘 점</h2>
          <ul>
            <li>
              <b>늦은 자료입니다.</b> 분기 말 기준이고 신고는 최대 45일 뒤에 나오므로, 보고서가 공개될 때는 이미 한두 달이 지난 보유 현황입니다. 그 사이 팔았을
              수도 있습니다.
            </li>
            <li>
              <b>미국 상장 주식만 들어 있습니다.</b> 현금, 채권, 해외 주식, 공매도 포지션은 보고서에 없습니다. 그래서 비중은 회사 전체 자산이 아니라 신고한 미국
              주식 안에서의 비중입니다.
            </li>
            <li>
              <b>옵션은 기초 주식 가치로 적힙니다.</b> 풋옵션은 주가 하락에 거는 포지션이라, 비중이 크게 보여도 그 종목을 좋게 본다는 뜻이 아닙니다.
            </li>
            <li>
              <b>평가액은 분기 말 주가 기준입니다.</b> 주식 수가 같아도 주가가 오르면 평가액과 비중이 늘어나므로, 사고판 여부는 주식 수 변화로 봅니다.
            </li>
          </ul>
          <h2 className="card-title">이 화면은 어떻게 만드나요</h2>
          <p>
            KosNas가 매일 아침 SEC EDGAR에서 투자자마다 가장 최근 13F-HR 원본 보고서와 그 앞 분기 보고서를 받아, 같은 종목끼리 주식 수를 더하고 두 분기를
            비교합니다. 주식 수가 늘었으면 추가, 줄었으면 축소, 지난 분기에 없던 종목은 신규, 이번 분기에 사라진 종목은 매도로 표시합니다. 정정
            보고서(13F-HR/A)는 반영하지 않습니다. 13F에는 종목 기호가 없어 증권 식별 번호(CUSIP)를 OpenFIGI로 기호에 맞췄고, 찾지 못한 종목은 회사 이름으로
            적었습니다.
          </p>
          <p>
            유명 투자자가 샀다고 해서 그 종목이 오른다는 뜻은 아니며, KosNas는 특정 종목의 매수·매도를 권하지 않습니다. 미국 증시 흐름은{" "}
            <Link href="/us">미장</Link>에서 볼 수 있습니다.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
