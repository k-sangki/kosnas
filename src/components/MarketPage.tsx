import Link from "next/link";
import { AD_SLOTS, AdSlot } from "./AdSlot";
import { SectorBoard } from "./SectorBoard";
import { SiteFooter, SiteHeader } from "./SiteHeader";
import { GUIDES } from "@/lib/guides";
import { moveScores, ready, signed, sectorData, type Breadth, type Market, type SectorData } from "@/lib/sectors";

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

const names = (xs: string[]) => xs.join(", ");

/** 그날 자료로 쓰는 섹터 요약. 숫자가 아니라 문장으로 읽고 싶은 사람을 위한 카드(첫 화면 한 곳에만) */
function DailySummary({ data }: { data: SectorData }) {
  const P = 20;
  const live = data.sectors.filter((s) => ready(s, P));
  if (live.length < 6) return null;
  const byX = [...live].sort((a, b) => b.x[P]! - a.x[P]!);
  const lead = live.filter((s) => s.q[P] === "lead").sort((a, b) => b.x[P]! - a.x[P]!);
  const lag = live.filter((s) => s.q[P] === "lag").sort((a, b) => a.x[P]! - b.x[P]!);
  const moves = moveScores(live, P);
  const best = (dir: "up" | "down") =>
    live.filter((s) => moves.get(s.id)?.dir === dir).sort((a, b) => moves.get(b.id)!.score - moves.get(a.id)!.score)[0];
  const up = best("up");
  const down = best("down");
  const top = byX[0];
  const bottom = byX[byX.length - 1];
  const b = data.breadth;
  const [y, m, d] = data.asof.split("-").map(Number);
  return (
    <section className="card seo-text">
      <h2 className="card-title">
        {m}월 {d}일 섹터 흐름 요약
      </h2>
      <p>
        {y}년 {m}월 {d}일 종가 기준 최근 20거래일 동안 섹터 평균보다 가장 강했던 곳은 {top.name}(수익률 {signed(top.ret[P])}%, 평균 대비 {signed(top.x[P])}
        %p)이고, 가장 약했던 곳은 {bottom.name}({signed(bottom.ret[P])}%, {signed(bottom.x[P])}%p)입니다.{" "}
        {lead.length > 0 && (
          <>
            평균보다 강하면서 더 강해지는 주도 칸에는 {names(lead.slice(0, 4).map((s) => s.name))} 등 {lead.length}개 섹터가 있습니다.{" "}
          </>
        )}
        {lag.length > 0 && (
          <>
            반대로 평균보다 약하고 더 약해지는 소외 칸에는 {names(lag.slice(0, 4).map((s) => s.name))} 등 {lag.length}개 섹터가 있습니다.
          </>
        )}
      </p>
      {(up || down) && (
        <p>
          {up && (
            <>
              지난 20일 동안 주도 쪽으로 가장 곧고 빠르게 움직인 섹터는 {up.name}(이동 강도 {moves.get(up.id)!.score})이고,{" "}
            </>
          )}
          {down && (
            <>
              소외 쪽으로 가장 빠르게 움직인 섹터는 {down.name}(이동 강도 {moves.get(down.id)!.score})입니다.
            </>
          )}
        </p>
      )}
      {b?.KOSPI && b?.KOSDAQ && (
        <p>
          시장 전체로는 이날 코스피 보통주 {b.KOSPI.up.toLocaleString()}종목이 오르고 {b.KOSPI.down.toLocaleString()}종목이 내렸으며, 50일 이동평균선 위에 있는
          종목은 {b.KOSPI.above50}%입니다. 코스닥은 {b.KOSDAQ.up.toLocaleString()}종목 상승, {b.KOSDAQ.down.toLocaleString()}종목 하락에 50일선 위 종목{" "}
          {b.KOSDAQ.above50}%입니다. 52주 신고가는 코스피 {b.KOSPI.newHighs}종목, 코스닥 {b.KOSDAQ.newHighs}종목에서 나왔습니다.
        </p>
      )}
      <p className="muted small-note">이 요약은 위 숫자로 매일 자동으로 만들며, 지나간 시세를 정리한 것일 뿐 앞으로의 움직임을 예측하지 않습니다.</p>
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
        <SectorBoard data={{ ...data, sectors: data.sectors.map((s) => ({ ...s, stocks: [] })) }} />
        {!data.sample && <DailySummary data={data} />}
        {data.breadth && <BreadthCard breadth={data.breadth} />}
        <AdSlot slot={AD_SLOTS.board} />
        <section className="card">
          <h2 className="card-title">처음이라면</h2>
          <ul className="guide-links">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={`/guide/${g.slug}`}>{g.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
