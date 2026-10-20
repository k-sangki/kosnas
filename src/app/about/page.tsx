import type { Metadata } from "next";
import { TextPage } from "@/components/TextPage";

export const metadata: Metadata = {
  title: "소개",
  description: "KosNas는 코스피·코스닥·나스닥의 섹터 흐름을 정리해 보여주는 정보 서비스입니다.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <TextPage title="KosNas 소개">
      <p>
        KosNas는 코스피·코스닥과 미국 증시에서 어느 섹터가 강해지고 어느 섹터가 약해지는지를 한 화면에 정리해 보여주는 무료 정보 서비스입니다.
      </p>
      <h2>무엇을 볼 수 있나요</h2>
      <ul>
        <li>섹터 흐름: 섹터마다 5·20·60일 강도(섹터 평균 대비 수익률)와 그 변화를 네 칸(주도·약화·소외·관찰)으로</li>
        <li>강도 순위: 기간별로 가장 강한 섹터부터</li>
        <li>섹터 종목: 섹터 안 종목을 상대강도 순으로, 누르면 트레이딩뷰 차트</li>
      </ul>
      <h2>자료</h2>
      <p>
        섹터 강도와 순위는 공개된 시세로 KosNas가 직접 계산한 값입니다. 종목 가격과 차트는 트레이딩뷰(TradingView)가 제공합니다. 지금은 화면을 만드는
        단계라 일부 숫자는 표본 값입니다.
      </p>
      <h2>투자 유의</h2>
      <p>
        KosNas는 특정 종목의 매수·매도를 권하지 않으며, 모든 이용자에게 같은 정보를 같은 방식으로 보여줍니다. 계산 결과는 과거 시세에 바탕을 둔 것으로
        앞으로의 수익을 보장하지 않습니다. 투자 판단과 그 결과의 책임은 이용자 본인에게 있습니다.
      </p>
    </TextPage>
  );
}
