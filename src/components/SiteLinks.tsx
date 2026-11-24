import Link from "next/link";
import { INVESTORS } from "@/lib/investors13f";
import { LIVE_QUOTES } from "@/lib/live-quotes";
import { sectorData } from "@/lib/sectors";

/**
 * 검색 수요가 큰데 들어오는 링크가 적은 화면(투자자 포트폴리오·국장 섹터·24시간 시세·경제지표)으로 가는 작은 링크 줄.
 * 2026-11-25 외부 검색 진단: /investors/* 는 들어오는 링크가 2~3개, 일부 섹터는 1개, 첫 화면 서버 HTML에는 하나도 없었다.
 * 메뉴를 바꾸지 않고 본문 아래 작은 글씨로만 둔다.
 */
type Kind = "live" | "econ" | "sectors" | "investors";

const Row = ({ head, items }: { head: string; items: [string, string][] }) => (
  <p className="muted small-note">
    {head}:{" "}
    {items.map(([name, href], i) => (
      <span key={href}>
        {i > 0 && " · "}
        <Link href={href}>{name}</Link>
      </span>
    ))}
  </p>
);

export function SiteLinks({ show = ["live", "econ", "sectors", "investors"] }: { show?: Kind[] }) {
  const rows: Record<Kind, () => React.ReactNode> = {
    live: () => <Row key="live" head="24시간 실시간 시세" items={LIVE_QUOTES.map((q) => [q.name, `/live/${q.slug}`])} />,
    econ: () => (
      <Row
        key="econ"
        head="미국 증시·경제지표"
        items={[
          ["미국 증시 실시간 현황", "/us"],
          ["경제지표 예상치와 결과", "/econ"],
          ["주요 일정", "/schedule"],
        ]}
      />
    ),
    sectors: () => (
      <Row key="sectors" head="국장 섹터 대장주·등락률" items={sectorData("kr").sectors.map((s) => [s.name, `/kr/sector/${s.id}`])} />
    ),
    investors: () => (
      <Row key="investors" head="유명 투자자 포트폴리오" items={INVESTORS.map((v) => [v.person, `/investors/${v.id}`])} />
    ),
  };
  return <>{show.map((k) => rows[k]())}</>;
}
