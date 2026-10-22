import Link from "next/link";
import { INVESTORS, crowd, label, mainPeriod, optionTag, quarter, sharePct, usd, type Holding, type Investor } from "@/lib/investors";

/** 투자자 목록(미장 맨 위와 /investors가 같이 쓴다) */
export function InvestorList({ title = "유명 투자자 포트폴리오", limit }: { title?: string; limit?: number }) {
  if (!INVESTORS.length) return null;
  const p = mainPeriod();
  return (
    <section className="card">
      <h2 className="card-title">
        {title} <span className="muted">{quarter(p)} 말 · SEC 13F</span>
      </h2>
      <ul className="inv-list">
        {INVESTORS.slice(0, limit).map((inv) => (
          <li key={inv.id}>
            <Link href={`/investors/${inv.id}`} className="inv-row">
              <span className="inv-who">
                <b>{inv.person}</b>
                <small className="muted">
                  {inv.firm}
                  {inv.period !== p && ` · ${quarter(inv.period)}`}
                </small>
              </span>
              <span className="inv-top">
                {inv.holdings
                  .filter((h) => !h.put_call)
                  .slice(0, 3)
                  .map((h) => (
                    <span key={h.cusip}>
                      {label(h)} <small className="muted">{h.weight?.toFixed(0)}%</small>
                    </span>
                  ))}
              </span>
              <span className="inv-moves">
                {inv.new_count > 0 && <span className="up">신규 {inv.new_count}</span>}
                {inv.sold_count > 0 && <span className="down">매도 {inv.sold_count}</span>}
              </span>
              <i className="tri tri-right" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {limit != null && (
        <p className="small-note">
          <Link href="/investors">{INVESTORS.length > limit ? `${INVESTORS.length}명 모두 보기 · ` : ""}여러 투자자가 함께 산 종목과 13F 읽는 법 →</Link>
        </p>
      )}
    </section>
  );
}

/** 여러 투자자가 함께 사거나 판 종목 */
export function Crowd({ kind }: { kind: "buy" | "sell" }) {
  const rows = crowd(kind);
  if (!rows.length) return null;
  return (
    <section className="card">
      <h2 className="card-title">{kind === "buy" ? "여러 투자자가 함께 산 종목" : "여러 투자자가 함께 판 종목"}</h2>
      <ul className="inv-holdings">
        {rows.map(({ h, who }) => (
          <li key={h.cusip}>
            <span className="inv-h-name">
              <b>{label(h)}</b>
              <small className="muted">{who.join(", ")}</small>
            </span>
            <span className={`num ${kind === "buy" ? "up" : "down"}`}>{who.length}명</span>
          </li>
        ))}
      </ul>
      <p className="small-note muted">{kind === "buy" ? "새로 사거나 주식 수를 늘린 투자자 수입니다." : "주식 수를 줄이거나 모두 판 투자자 수입니다."}</p>
    </section>
  );
}

function ChangeTag({ h }: { h: Holding }) {
  if (h.change === "new") return <span className="qtag t-lead">신규</span>;
  const pct = sharePct(h);
  if (h.change === "add" && pct != null) return <span className="qtag t-lead">+{pct >= 100 ? Math.round(pct) : pct.toFixed(1)}%</span>;
  if (h.change === "reduce" && pct != null) return <span className="qtag t-lag">{pct.toFixed(1)}%</span>;
  if (h.change === "same") return <span className="qtag muted">유지</span>;
  return null;
}

/** 한 투자자의 보유 종목 */
export function Holdings({ inv }: { inv: Investor }) {
  return (
    <section className="card">
      <h2 className="card-title">
        보유 종목 <span className="muted">평가액 순{inv.count > inv.holdings.length ? ` · 상위 ${inv.holdings.length}개` : ""}</span>
      </h2>
      <ul className="inv-holdings">
        {inv.holdings.map((h, k) => (
          <li key={h.cusip + (h.put_call ?? "")}>
            <span className="rank-no">{k + 1}</span>
            <span className="inv-h-name">
              <b>
                {label(h)}
                {h.put_call && <span className="qtag t-weaken">{optionTag(h)}</span>}
              </b>
              <small className="muted">
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
        모두 판 종목 <span className="muted">{quarter(inv.prev_period)} 말 평가액 순</span>
      </h2>
      <ul className="inv-holdings">
        {inv.sold.map((h) => (
          <li key={h.cusip + (h.put_call ?? "")}>
            <span className="inv-h-name">
              <b>
                {label(h)}
                {h.put_call && <span className="qtag t-weaken">{optionTag(h)}</span>}
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
