import Link from "next/link";
import { ARK, ARK_KIND, DATA, MOVES, action, md, quiet, shares, usd, who, type ArkTrade } from "@/lib/investors";

/** 유명 투자자 최근 30일 지분·매매 공시(미장 맨 위와 /investors가 같이 쓴다) */
export function RecentMoves({ limit, more = false }: { limit?: number; more?: boolean }) {
  const rows = MOVES.slice(0, limit);
  const rest = quiet();
  return (
    <section className="card">
      <h2 className="card-title">
        유명 투자자 최근 {DATA.window}일 매매 <span className="muted">SEC 공시 · {md(DATA.updated)} 확인</span>
      </h2>
      {!rows.length && <p className="muted">최근 {DATA.window}일 동안 들어온 공시가 없습니다.</p>}
      <ul className="inv-moves">
        {rows.map((m) => {
          const a = action(m);
          const inv = who(m.investor);
          const amount = m.value ? usd(m.value) : m.shares ? `${shares(m.shares)}${m.kind === "stake" ? " 보유" : ""}` : "";
          const issuer = m.issuer?.replace(/\s*\/[A-Z]{2,}\/$/, "") ?? "";
          const when =
            m.kind === "stake" ? (m.event_date ? `기준 ${md(m.event_date)}` : "") : m.from === m.to ? `거래 ${md(m.from)}` : `거래 ${md(m.from)}~${md(m.to)}`;
          return (
            <li key={m.acc}>
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="inv-move">
                <span className="inv-stock">
                  <b>{m.ticker || issuer}</b>
                  <small className="muted">{m.ticker ? issuer : ""}</small>
                </span>
                <span className={`inv-act ${a.tone}`}>
                  {a.text}
                  {amount && <small className="muted">{amount}</small>}
                </span>
                <span className="inv-by">
                  <b>{inv?.name}</b>
                  <small className="muted">
                    {md(m.filed)} 공시{when ? ` · ${when}` : ""}
                  </small>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {rest.length > 0 && (
        <p className="small-note muted">
          최근 {DATA.window}일 공시 없음: {rest.map((i) => i.name).join(", ")}
        </p>
      )}
      {more && (
        <p className="small-note">
          <Link href="/investors">{MOVES.length > (limit ?? Infinity) ? `${MOVES.length}건 모두 보기 · ` : ""}공시 읽는 법 →</Link>
        </p>
      )}
    </section>
  );
}

/** 캐시 우드(ARK) 펀드의 매일 보유 변화 */
export function ArkTrades({ limit }: { limit?: number }) {
  const all = ARK.trades;
  const rows = all.slice(0, limit);
  return (
    <section className="card">
      <h2 className="card-title">
        캐시 우드(ARK) 매일 매매 <span className="muted">{ARK.asof ? `${md(ARK.asof)} 보유 기준` : "ARK 공개 보유 내역"}</span>
      </h2>
      {!rows.length && (
        <p className="muted">
          ARK가 매일 공개하는 펀드 보유 내역을 {ARK.started ? `${md(ARK.started)}부터 ` : ""}모으고 있습니다. 다음 공개분부터 전날과 비교한 매매가 여기에
          쌓입니다.
        </p>
      )}
      <ul className="inv-moves">
        {rows.map((t: ArkTrade) => {
          const k = ARK_KIND[t.kind];
          return (
            <li key={`${t.date}-${t.fund}-${t.ticker || t.name}`} className="inv-move">
              <span className="inv-stock">
                <b>{t.ticker || t.name}</b>
                <small className="muted">{t.ticker ? t.name : ""}</small>
              </span>
              <span className={`inv-act ${k.tone}`}>
                {k.text}
                <small className="muted">{t.value ? usd(t.value) : shares(t.shares)}</small>
              </span>
              <span className="inv-by">
                <b>{t.fund}</b>
                <small className="muted">{md(t.date)}</small>
              </span>
            </li>
          );
        })}
      </ul>
      {limit != null && all.length > limit && (
        <p className="small-note">
          <Link href="/investors#ark">{all.length}건 모두 보기 →</Link>
        </p>
      )}
    </section>
  );
}
