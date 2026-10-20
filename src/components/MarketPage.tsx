import Link from "next/link";
import { AD_SLOTS, AdSlot } from "./AdSlot";
import { SectorBoard } from "./SectorBoard";
import { SiteFooter, SiteHeader } from "./SiteHeader";
import { sectorData, type Breadth, type Market } from "@/lib/sectors";

export function SampleNotice({ asof }: { asof: string }) {
  return (
    <p className="notice">
      지금 숫자는 화면 확인용 표본입니다({asof} 기준 가짜 값). 종목 이름과 트레이딩뷰 차트만 실제예요.
    </p>
  );
}

function BreadthCard({ breadth }: { breadth: Record<string, Breadth> }) {
  return (
    <section className="card">
      <h2 className="card-title">시장 폭</h2>
      <div className="breadth">
        {Object.entries(breadth).map(([m, b]) => (
          <div key={m}>
            <h3>{m === "KOSPI" ? "코스피" : "코스닥"}</h3>
            <p>
              <span className="up">상승 {b.up.toLocaleString()}</span> · <span className="down">하락 {b.down.toLocaleString()}</span>
            </p>
            <p>50일선 위 {b.above50}%</p>
            <p>52주 신고가 {b.newHighs.toLocaleString()}종목</p>
          </div>
        ))}
      </div>
      <p className="muted small-note">
        보통주 기준입니다.{" "}
        <Link href="/guide/breadth" className="inline-link">
          시장 폭이란
        </Link>
      </p>
    </section>
  );
}

export function MarketPage({ market }: { market: Market }) {
  const data = sectorData(market);
  return (
    <div className="shell">
      <SiteHeader active={market} />
      <main className="stack">
        <h1 className="page-title">{market === "kr" ? "코스피·코스닥" : "미국 증시"} 섹터 흐름</h1>
        <p className="lead">
          어느 업종에 돈이 몰리고 어느 업종에서 빠지는지, 섹터별 강도와 그 변화를 매일 장 마감 자료로 계산해 보여줍니다.{" "}
          <span className="muted">{data.asof} 종가 기준</span>
        </p>
        {data.sample && <SampleNotice asof={data.asof} />}
        <SectorBoard data={data} />
        {data.breadth && <BreadthCard breadth={data.breadth} />}
        <AdSlot slot={AD_SLOTS.board} />
        <section className="card">
          <h2 className="card-title">처음이라면</h2>
          <ul className="guide-links">
            <li>
              <Link href="/guide/sector-rotation">섹터 순환이란 무엇이고 왜 보나요</Link>
            </li>
            <li>
              <Link href="/guide/quadrant">주도·약화·소외·관찰 네 칸 읽는 법</Link>
            </li>
            <li>
              <Link href="/guide/relative-strength">상대강도(RS) 점수는 어떻게 매기나요</Link>
            </li>
            <li>
              <Link href="/guide/breadth">시장 폭으로 지수 뒤의 흐름 보기</Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
