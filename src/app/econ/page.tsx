import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/app/layout";
import { EconBoard } from "@/components/EconBoard";
import { Fold } from "@/components/Fold";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "경제지표 예상치와 결과 - CPI·FOMC·고용·PCE 예상 부합·상회·하회",
  description:
    "미국 소비자물가(CPI)·근원물가, FOMC 기준금리와 점도표, 고용보고서·실업수당 청구, PCE·PPI, 소매판매, 소비자심리, ISM, GDP와 한국은행·ECB·일본은행 금리 결정의 시장 예상치와 직전 값을 발표 전에 보여 주고, 발표 뒤에는 실제 값이 예상에 부합했는지 상회·하회했는지 한눈에 보여 줍니다. 큰 기업 실적의 예상 EPS와 결과도 함께 정리합니다.",
  keywords: [
    "CPI 예상치",
    "근원 CPI 예상",
    "FOMC 점도표",
    "미국 고용보고서 예상",
    "비농업 고용 예상",
    "PCE 예상치",
    "경제지표 발표 일정",
    "경제지표 예상 결과",
    "실업수당 청구건수",
    "미국 소매판매 예상",
    "실적 발표 예상 EPS",
  ],
  path: "/econ",
});

export default function EconPage() {
  return (
    <div className="shell">
      <SiteHeader />
      <main className="stack">
        <JsonLd data={breadcrumbLd(SITE_URL, [["경제지표 예상과 결과", "/econ"]])} />
        <h1 className="page-title">📊 경제지표 예상과 결과</h1>
        <p className="lead">
          발표 전에는 시장 예상치를, 발표 뒤에는 실제 값이 예상에 부합했는지 보여 줍니다. 시각은 모두 한국 시각입니다.
        </p>
        <EconBoard />
        <section className="card seo-text">
          <Fold title="보는 법">
            <p>
              <b>예상</b>은 발표 전 시장 참가자들의 예상치(컨센서스)이고, <b>직전</b>은 지난번 발표 값입니다. 발표가 나면{" "}
              <b>실제</b> 값을 예상과 비교해 같으면 <b>예상 부합</b>, 크면 <b>예상 상회</b>, 작으면 <b>예상 하회</b>로 적습니다.
              숫자 아래 줄에서 동그라미(회색)는 직전, 세로 막대는 예상, 큰 점은 실제 값의 자리입니다.
            </p>
            <p>
              상회가 늘 좋은 소식은 아닙니다. 물가가 예상을 웃돌면 금리 인하 기대가 줄어 주가에 부담이 될 수 있고, 고용이 예상을
              웃돌면 경기에는 좋지만 같은 이유로 금리 쪽에는 부담이 될 수 있습니다. 그래서 이 화면은 좋다·나쁘다를 붙이지 않고
              예상과의 차이만 보여 줍니다.
            </p>
            <p>
              <b>점도표</b>는 FOMC 위원들이 각자 생각하는 연말 기준금리를 점 하나씩 찍은 그림입니다. 3·6·9·12월 회의 때만 새로
              나오며, 빨간 선(중간값)이 시장이 가장 많이 보는 숫자입니다.
            </p>
            <p>
              예상치·실제 값은 나스닥 경제지표 달력, 점도표는 미국 연방준비제도 경제전망 표에서 가져옵니다. 발표 직후 몇 분은 값이
              늦게 들어올 수 있습니다. 날짜별 다른 일정(배당 막차·공모주·휴장)은 <Link href="/schedule">주요일정</Link>에 있습니다.
              특정 종목의 매수·매도를 권하지 않습니다.
            </p>
          </Fold>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
