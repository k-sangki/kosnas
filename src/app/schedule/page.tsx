import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/app/layout";
import { Fold } from "@/components/Fold";
import { JsonLd } from "@/components/JsonLd";
import { ScheduleBoard } from "@/components/ScheduleBoard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "주식 주요일정 - 이번 주 배당 막차·공모주 청약·권리락·FOMC·CPI",
  description:
    "국장과 미장의 이번 주·다음 주 주요일정. 배당을 받으려면 언제까지 사야 하는지(배당 막차), 무상증자 권리락, 공모주 청약 일정과 주관 증권사, 옵션 만기일, 휴장일, 미국 FOMC·소비자물가(CPI)·실적 발표를 한국 시각으로 정리합니다. 매일 DART 공시로 갱신합니다.",
  keywords: [
    "주식 일정",
    "증시 일정",
    "배당 막차",
    "배당락일",
    "배당 기준일",
    "공모주 청약 일정",
    "공모주 일정",
    "무상증자 권리락",
    "옵션 만기일",
    "FOMC 일정",
    "CPI 발표일",
    "미국 증시 일정",
    "증시 캘린더",
  ],
  path: "/schedule",
});

export default function SchedulePage() {
  return (
    <div className="shell">
      <SiteHeader />
      <main className="stack">
        <JsonLd data={breadcrumbLd(SITE_URL, [["주요일정", "/schedule"]])} />
        <h1 className="page-title">📅 주요일정</h1>
        <p className="lead">
          이번 주와 다음 주에 챙길 날짜만 모았습니다. 일정을 누르면 근거 공시가
          열립니다. CPI·FOMC·고용 같은 경제지표의 예상치와 결과는{" "}
          <Link href="/econ">경제지표 예상과 결과</Link>에 있습니다.
        </p>
        <ScheduleBoard />
        <section className="card seo-text">
          <Fold title="일정 보는 법">
            <p>
              <b>배당 막차</b>는 배당을 받으려면 늦어도 그날까지 사야 하는
              마지막 거래일입니다. 국내 주식은 산 날로부터 2거래일 뒤에
              결제되므로 배당 기준일의 2거래일 전까지 사야 기준일 주주명부에
              오릅니다. 그다음 거래일이 배당락일로, 배당만큼 주가가 낮게
              시작하는 경우가 많습니다.
            </p>
            <p>
              <b>무상증자 막차</b>도 같은 계산입니다. 신주배정기준일 2거래일
              전까지 사야 새 주식을 받고, 다음 거래일 권리락에서 주가가 늘어난
              주식 수만큼 낮아진 값으로 조정됩니다.
            </p>
            <p>
              <b>공모주 청약</b>은 증권신고서에 적힌 청약 기간과 공모가(확정
              전에는 희망 가격 하단일 수 있음), 대표 주관 증권사를 보여 줍니다.
              청약은 주관 증권사 계좌에서 합니다. 스팩(기업인수목적회사) 청약은
              따로 표시합니다.
            </p>
            <p>
              <b>옵션 만기일</b>은 국내는 매달 둘째 목요일, 미국은 셋째
              금요일입니다. 3·6·9·12월에는 선물과 옵션이 함께 만기돼 장 막판
              거래가 크게 늘 수 있습니다. 미국 일정(FOMC·소비자물가·고용·실적
              발표)은 한국 시각으로 적었고, 밤늦게 나오는 발표는 한국 날짜
              기준으로 다음 날 새벽에 둡니다.
            </p>
            <p>
              회사 일정은 금융감독원 DART 공시(현금·현물배당결정, 무상증자결정,
              증권신고서)에서 매일 두 번 뽑고, 정정 공시가 나오면 마지막
              내용으로 바꿉니다. 정확한 날짜는 꼭 원문 공시와 증권사에서 다시
              확인하세요. 특정 종목의 매수·매도를 권하지 않습니다.
            </p>
          </Fold>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
