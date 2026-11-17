import Link from "next/link";
import {
  INVESTORS,
  SECTOR_FLOWS,
  STALE_NOTE,
  crowd,
  label,
  mainPeriod,
  optionTag,
  pieSlices,
  quarter,
  quarterChanges,
  sharePct,
  usd,
  type Change,
  type Holding,
  type Investor,
} from "@/lib/investors13f";
import { koName } from "@/lib/ko-names";
import { OneOpen } from "./OneOpen";
import { PieChart } from "./PieChart";
import { Fold } from "./Fold";

/** 투자자 목록(미장 유명 투자자 탭 맨 위와 /investors가 같이 쓴다). 줄을 누르면 그 자리에서 파이차트가 펼쳐진다 */
export function InvestorList({
  title = "유명 투자자 포트폴리오",
  limit,
}: {
  title?: string;
  limit?: number;
}) {
  if (!INVESTORS.length) return null;
  const p = mainPeriod();
  return (
    <section className="card">
      <h2 className="card-title">
        {title} <span className="muted">{quarter(p)} 말 · SEC 13F</span>
      </h2>
      <OneOpen name="inv-pie" />
      <ul className="inv-list">
        {INVESTORS.slice(0, limit).map((inv) => (
          <li key={inv.id}>
            <details className="inv-item" name="inv-pie">
              <summary className="inv-row">
                <span className="inv-who">
                  <b>{inv.person}</b>
                  <small className="muted">
                    {inv.firm}
                    {inv.period !== p && ` · ${quarter(inv.period)}`}
                  </small>
                </span>
                <span className="inv-top">
                  {inv.holdings
                    .filter((h) => !h.put_call && !h.prn)
                    .slice(0, 3)
                    .map((h) => (
                      <span key={h.cusip}>
                        {koName(h.ticker, h.name)}{" "}
                        <small className="muted">{h.weight?.toFixed(0)}%</small>
                      </span>
                    ))}
                </span>
                <span className="inv-cnt">
                  {inv.new_count > 0 && (
                    <span className="up">신규 {inv.new_count}</span>
                  )}
                  {inv.sold_count > 0 && (
                    <span className="down">매도 {inv.sold_count}</span>
                  )}
                </span>
                <i className="tri" aria-hidden />
              </summary>
              <div className="inv-pie">
                {inv.period !== p && STALE_NOTE[inv.id] && (
                  <p className="small-note inv-stale">{STALE_NOTE[inv.id]}</p>
                )}
                <PieChart
                  slices={pieSlices(inv)}
                  label={`${inv.person} 포트폴리오 비중`}
                />
                <p className="small-note muted">
                  {quarter(inv.period)} 말 13F 신고 총액 {usd(inv.total)} 대비
                  비중 · 1% 미만 종목은 기타로 묶음
                </p>
                <QuarterChanges inv={inv} n={5} compact />
                <Link href={`/investors/${inv.id}`} className="inv-more">
                  {inv.person} 보유 종목 전체·매매 변화 보기{" "}
                  <i className="tri tri-right" aria-hidden />
                </Link>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 여러 투자자가 함께 사거나 판 종목 */
export function Crowd({ kind }: { kind: "buy" | "sell" }) {
  const rows = crowd(kind);
  if (!rows.length) return null;
  return (
    <section className="card">
      <h2 className="card-title">
        {kind === "buy"
          ? "여러 투자자가 함께 산 종목"
          : "여러 투자자가 함께 판 종목"}
      </h2>
      <ul className="inv-holdings">
        {rows.map(({ h, who }) => (
          <li key={h.cusip}>
            <span className="inv-h-name">
              <b>{label(h)}</b>
              <small className="muted">{who.join(", ")}</small>
            </span>
            <span className={`num ${kind === "buy" ? "up" : "down"}`}>
              {who.length}명
            </span>
          </li>
        ))}
      </ul>
      <p className="small-note muted">
        {kind === "buy"
          ? "새로 사거나 주식 수를 늘린 투자자 수입니다."
          : "주식 수를 줄이거나 모두 판 투자자 수입니다."}
      </p>
    </section>
  );
}

const pctText = (v: number) =>
  `${v > 0 ? "+" : ""}${Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1)}%`;
const wText = (v: number | null | undefined) =>
  v == null ? "" : v < 0.05 && v > 0 ? "0.1% 미만" : `${v.toFixed(1)}%`;

function ChangeRow({
  c,
  kind,
}: {
  c: Change;
  kind: "added" | "up" | "down" | "sold";
}) {
  const { h } = c;
  const ko = koName(h.ticker, h.name);
  const sub =
    kind === "added"
      ? `비중 ${wText(h.weight)}`
      : kind === "sold"
        ? c.prevWeight != null
          ? `전 분기 비중 ${wText(c.prevWeight)} → 0%`
          : "전 분기 말 평가액 기준"
        : [
            c.pct != null && `주식 수 ${pctText(c.pct)}`,
            c.prevWeight != null &&
              h.weight != null &&
              `비중 ${wText(c.prevWeight)} → ${wText(h.weight)}`,
          ]
            .filter(Boolean)
            .join(" · ");
  return (
    <li>
      <span className="inv-h-name">
        <b>{ko}</b>
        <small className="muted">
          {h.ticker && ko !== h.ticker ? `${h.ticker} · ` : ""}
          {sub}
        </small>
      </span>
      <span className={`num ${c.amount >= 0 ? "up" : "down"}`}>
        {kind === "sold" ? "" : c.amount > 0 ? "+" : ""}
        {usd(c.amount)}
      </span>
    </li>
  );
}

const GROUPS = [
  ["added", "새로 편입", "up"],
  ["up", "비중 확대", "up"],
  ["down", "비중 축소", "down"],
  ["sold", "전량 매도", "down"],
] as const;

/** 지난 분기 대비 변화: 새로 편입·비중 확대·비중 축소·전량 매도를 금액 큰 순으로 */
export function QuarterChanges({
  inv,
  n = 15,
  compact,
}: {
  inv: Investor;
  n?: number;
  compact?: boolean;
}) {
  if (!inv.prev_period) return null;
  const ch = quarterChanges(inv);
  const counts = {
    added: inv.new_count,
    up: inv.add_count,
    down: inv.reduce_count,
    sold: inv.sold_count,
  };
  const head = (
    <>
      지난 분기 대비 변화{" "}
      <span className="muted">
        {quarter(inv.prev_period)} 말 → {quarter(inv.period)} 말
      </span>
    </>
  );
  return (
    <section className={compact ? "qc qc-compact" : "card qc"}>
      {compact ? (
        <h3 className="qc-title">{head}</h3>
      ) : (
        <h2 className="card-title">{head}</h2>
      )}
      <div className="qc-grid">
        {GROUPS.map(([k, name, tone]) => {
          const rows = ch[k];
          return (
            <div key={k} className="qc-group">
              <h4 className={`qc-h ${tone}`}>
                {name} <small className="muted">{counts[k]}건</small>
              </h4>
              {rows.length ? (
                <ul className="inv-holdings">
                  {rows.slice(0, n).map((c) => (
                    <ChangeRow key={c.h.cusip} c={c} kind={k} />
                  ))}
                </ul>
              ) : (
                <p className="small-note muted">없음</p>
              )}
            </div>
          );
        })}
      </div>
      <Fold small title="금액·비중 계산 방법">
        <p>
          13F 보고서 두 개({quarter(inv.prev_period)} 말·{quarter(inv.period)}{" "}
          말)의 주식 수를 비교했습니다. 금액은 늘리거나 줄인 주식 수 ×{" "}
          {quarter(inv.period)} 말 주가로 환산한 추정치이고, 새로 편입한 종목은
          분기 말 평가액, 전량 매도한 종목은 전 분기 말 평가액입니다. 실제 매매
          가격·시점은 보고서에 없습니다. 주식 수가 0.5% 넘게 바뀐 것만
          확대·축소로 보고, 옵션·채권은 뺐습니다. 건수는 옵션을 포함한 전체이고,
          목록은 금액 큰 순입니다.
        </p>
      </Fold>
    </section>
  );
}

function ChangeTag({ h }: { h: Holding }) {
  if (h.change === "new") return <span className="qtag t-lead">신규</span>;
  const pct = sharePct(h);
  if (h.change === "add" && pct != null)
    return (
      <span className="qtag t-lead">
        +{pct >= 100 ? Math.round(pct) : pct.toFixed(1)}%
      </span>
    );
  if (h.change === "reduce" && pct != null)
    return <span className="qtag t-lag">{pct.toFixed(1)}%</span>;
  if (h.change === "same") return <span className="qtag muted">유지</span>;
  return null;
}

/** 한 투자자의 보유 종목 */
export function Holdings({ inv }: { inv: Investor }) {
  return (
    <section className="card">
      <h2 className="card-title">
        보유 종목{" "}
        <span className="muted">
          평가액 순
          {inv.count > inv.holdings.length
            ? ` · 상위 ${inv.holdings.length}개`
            : ""}
        </span>
      </h2>
      <ul className="inv-holdings">
        {inv.holdings.map((h, k) => (
          <li key={h.cusip + (h.put_call ?? "")}>
            <span className="rank-no">{k + 1}</span>
            <span className="inv-h-name">
              <b>
                {koName(h.ticker, h.name)}
                {optionTag(h) && (
                  <span className="qtag t-weaken">{optionTag(h)}</span>
                )}
              </b>
              <small className="muted">
                {h.ticker && koName(h.ticker, h.name) !== h.ticker
                  ? `${h.ticker} · `
                  : ""}
                {h.ticker ? `${h.name} · ` : ""}
                {usd(h.value)}
              </small>
            </span>
            <span className="inv-chg">
              <ChangeTag h={h} />
            </span>
            <span className="num">{h.weight?.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Sold({ inv }: { inv: Investor }) {
  if (!inv.sold.length) return null;
  return (
    <section className="card">
      <h2 className="card-title">
        모두 판 종목{" "}
        <span className="muted">{quarter(inv.prev_period)} 말 평가액 순</span>
      </h2>
      <ul className="inv-holdings">
        {inv.sold.map((h) => (
          <li key={h.cusip + (h.put_call ?? "")}>
            <span className="inv-h-name">
              <b>
                {label(h)}
                {optionTag(h) && (
                  <span className="qtag t-weaken">{optionTag(h)}</span>
                )}
              </b>
              <small className="muted">{h.ticker ? h.name : ""}</small>
            </span>
            <span className="num down">{usd(h.value)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 헤지펀드 섹터별 매매 동향: 이번 분기 섹터마다 사고판 금액의 합(순매수) */
export function SectorFlows() {
  if (!SECTOR_FLOWS?.sectors.length) return null;
  const rows = SECTOR_FLOWS.sectors.filter((r) => r.sector !== "기타");
  const max = Math.max(...rows.map((r) => Math.abs(r.net)), 1);
  return (
    <section className="card">
      <h2 className="card-title">
        헤지펀드 섹터별 매매 동향{" "}
        <span className="muted">
          {quarter(SECTOR_FLOWS.period)} · {SECTOR_FLOWS.investors}명
        </span>
      </h2>
      <ul className="sf-list">
        {rows.map((r) => (
          <li key={r.sector}>
            <div className="sf-head">
              <b>{r.sector}</b>
              <span
                className={`num ${r.net > 0 ? "up" : r.net < 0 ? "down" : ""}`}
              >
                {r.net > 0 ? "+" : ""}
                {usd(r.net)}
              </span>
            </div>
            <div className="sf-bar" aria-hidden>
              <i
                className={r.net >= 0 ? "pos" : "neg"}
                style={{ width: `${(Math.abs(r.net) / max) * 50}%` }}
              />
            </div>
            <small className="muted">
              산 사람 {r.buyers.length} · 판 사람 {r.sellers.length}
              {r.top_buy.length > 0 && ` · 많이 산 ${r.top_buy.join(", ")}`}
              {r.top_sell.length > 0 && ` · 많이 판 ${r.top_sell.join(", ")}`}
            </small>
          </li>
        ))}
      </ul>
      <Fold small title="계산 방법">
        <p>
          위 투자자들의 13F 보고서에서 이번 분기에 늘린 주식 수 × 분기 말 주가,
          새로 산 종목의 평가액, 모두 판 종목의 전 분기 평가액을 섹터별로 더한
          순매수입니다. 옵션과 채권은 뺐고, 섹터는 SEC 업종 코드로 나눴습니다.
          운용 규모가 큰 곳(브리지워터 등)의 영향이 큽니다.
        </p>
      </Fold>
    </section>
  );
}
