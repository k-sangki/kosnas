"""유명 투자자 최근 30일 매매: SEC 지분 공시(13D·13G)와 내부자 매매 공시(Form 4), ARK 매일 보유 내역.

    python collector/investors_recent.py --out src/data/investors.json --ark src/data/ark-holdings.json

- 13F(분기 보유 보고서)는 분기 말에서 45일 뒤에 나와 늘 1.5~4.5개월 묵은 자료라 쓰지 않는다(2026-10-22 SK 결정:
  "최근 한달 이내 자료만 쓰자").
- 13D·13G: 한 회사 지분을 5% 넘게 가지면 내는 보고서. 13D는 사건(취득 등) 뒤 10일 안, 지분이 1%p 넘게 바뀌면 2영업일 안에
  정정 보고. 13G는 소극 투자자용으로 보고가 더 느슨하다. 2024-12부터 XML로 낸다.
- Form 4: 10% 넘는 대주주·임원이 매매한 뒤 2영업일 안에 낸다(거래 날짜·수량·가격이 있다).
- SEC EDGAR 자료는 미국 정부 공개 자료다(접속 규칙: 연락처가 든 User-Agent, 초당 10회 이하).
- ARK(캐시 우드)는 펀드마다 그날 보유 내역 CSV를 공개한다. 전날 받아 둔 것과 비교해 매매를 추정한다.
  ETF는 설정·환매로 모든 종목 수량이 같은 비율로 바뀌므로, 그 펀드 종목들의 수량 변화율 중앙값만큼은 매매로 보지 않는다.
- 이미 읽은 공시(공시 번호가 같은 것)는 지난 결과를 다시 쓰고 원문을 다시 받지 않는다. 매일 돈다(.github/workflows/collect-investors.yml).
"""

import argparse
import csv
import datetime as dt
import io
import json
import os
import statistics
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

UA = "KosNas contact@kosnas.com"
SUBMISSIONS = "https://data.sec.gov/submissions/CIK{:010d}.json"
ARCHIVE = "https://www.sec.gov/Archives/edgar/data/{}/{}/{}"
COMPANY_TICKERS = "https://www.sec.gov/files/company_tickers.json"
ARK_CSV = "https://assets.ark-funds.com/fund-documents/funds-etf-csv/"
WINDOW = 30  # 일

# (id, CIK, 사람, 회사 한글 설명) — 이 순서대로 보여 준다(국내 개인 투자자가 많이 찾는 사람 먼저)
INVESTORS = [
    ("buffett", 1067983, "워런 버핏", "버크셔 해서웨이"),
    ("wood", 1697748, "캐시 우드", "ARK 인베스트"),
    ("burry", 1649339, "마이클 버리", "사이언 자산운용"),
    ("druckenmiller", 1536411, "스탠리 드러켄밀러", "듀케인 패밀리 오피스"),
    ("ackman", 1336528, "빌 애크먼", "퍼싱 스퀘어"),
    ("dalio", 1350694, "레이 달리오", "브리지워터"),
    ("tepper", 1656456, "데이비드 테퍼", "아팔루사"),
    ("soros", 1029160, "조지 소로스", "소로스 펀드"),
    ("gates", 1166559, "빌 게이츠", "게이츠 재단 신탁"),
    ("lilu", 1709323, "리루", "히말라야 캐피털"),
    ("marks", 949509, "하워드 막스", "오크트리 캐피털"),
    ("klarman", 1061768, "세스 클라만", "바우포스트"),
    ("coleman", 1167483, "체이스 콜먼", "타이거 글로벌"),
    ("loeb", 1040273, "댄 로브", "서드 포인트"),
    ("icahn", 921669, "칼 아이칸", "아이칸 캐피털"),
]

# ARK 펀드 CSV(파일 이름이 바뀌면 그 펀드는 날짜가 오래돼 빠진다 — ARKW는 2026-10 기준 10/06에 멈춰 있다)
ARK_FUNDS = {
    "ARKK": "ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv",
    "ARKW": "ARK_NEXT_GENERATION_INTERNET_ETF_ARKW_HOLDINGS.csv",
    "ARKQ": "ARK_AUTONOMOUS_TECH._&_ROBOTICS_ETF_ARKQ_HOLDINGS.csv",
    "ARKG": "ARK_GENOMIC_REVOLUTION_ETF_ARKG_HOLDINGS.csv",
    "ARKF": "ARK_BLOCKCHAIN_&_FINTECH_INNOVATION_ETF_ARKF_HOLDINGS.csv",
    "ARKX": "ARK_SPACE_&_DEFENSE_INNOVATION_ETF_ARKX_HOLDINGS.csv",
}
ARK_MIN_MOVE = 0.01  # 설정·환매를 뺀 뒤 보유 수량이 1% 넘게 바뀐 것만 매매로 본다

FORMS_13D = {"SCHEDULE 13D", "SCHEDULE 13D/A", "SCHEDULE 13G", "SCHEDULE 13G/A"}
FORMS_4 = {"4", "4/A"}


def get(url, headers=None, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 — 잠깐 막히면 쉬었다 다시
            if k == tries - 1:
                raise
            wait = 65 if "429" in str(e) else 3 * (k + 1)
            print(f"  다시 시도({e}) {wait}초 뒤", file=sys.stderr)
            time.sleep(wait)


def sec(url):
    time.sleep(0.15)
    return get(url)


def local(tag):
    return tag.rsplit("}", 1)[-1]


def num(s):
    try:
        return float(str(s).replace(",", "").replace("$", "").replace("%", "").strip())
    except ValueError:
        return None


# ---------- Form 4 ----------


def val(el, path):
    """Form 4는 이름공간이 없다. path 끝에 <value>가 있으면 그 글자"""
    x = el.find(path)
    if x is None:
        return None
    v = x.find("value")
    return (v.text if v is not None else x.text or "").strip() or None


def parse_form4(xml_bytes):
    root = ET.fromstring(xml_bytes)
    issuer = root.find("issuer")
    tick = (val(issuer, "issuerTradingSymbol") or "").upper()
    owners = [int(x.text) for x in root.iter("rptOwnerCik") if (x.text or "").strip().isdigit()]
    out = {"issuer": val(issuer, "issuerName"), "ticker": "" if tick in ("", "NONE", "N/A") else tick, "owners": owners, "trades": []}
    for t in root.iter("nonDerivativeTransaction"):
        shares = num(val(t, "transactionAmounts/transactionShares") or "")
        if not shares:
            continue
        out["trades"].append(
            {
                "date": val(t, "transactionDate"),
                "code": val(t, "transactionCoding/transactionCode") or "",
                "ad": val(t, "transactionAmounts/transactionAcquiredDisposedCode") or "",
                "shares": shares,
                "price": num(val(t, "transactionAmounts/transactionPricePerShare") or ""),
                "after": num(val(t, "postTransactionAmounts/sharesOwnedFollowingTransaction") or ""),
            }
        )
    return out


def form4_event(p):
    """한 공시를 한 줄로: 장내 매수(P)·매도(S)가 있으면 그것만, 없으면 그 밖의 취득·처분"""
    trades = p["trades"]
    market = [t for t in trades if t["code"] in ("P", "S")]
    use = market or trades
    if not use:
        return None
    buy = sum(t["shares"] for t in use if t["ad"] == "A")
    sell = sum(t["shares"] for t in use if t["ad"] == "D")
    net = buy - sell
    if not net:
        return None
    priced = [t for t in use if t["price"]]
    value = sum(t["shares"] * t["price"] for t in priced if t["ad"] == ("A" if net > 0 else "D"))
    moved = sum(t["shares"] for t in priced if t["ad"] == ("A" if net > 0 else "D"))
    afters = [t["after"] for t in use if t["after"] is not None]
    dates = sorted(t["date"] for t in use if t["date"])
    return {
        "kind": ("buy" if net > 0 else "sell") if market else ("acquire" if net > 0 else "dispose"),
        "shares": abs(net),
        "value": round(value) if value else None,
        "price": round(value / moved, 2) if moved else None,
        "after": max(afters) if afters else None,
        "from": dates[0] if dates else None,
        "to": dates[-1] if dates else None,
    }


# ---------- 13D·13G ----------


def first(root, *names):
    for el in root.iter():
        if local(el.tag) in names and (el.text or "").strip():
            return el.text.strip()
    return None


def parse_13dg(xml_bytes):
    root = ET.fromstring(xml_bytes)
    pct = [num(el.text) for el in root.iter() if local(el.tag) in ("percentOfClass", "classPercent")]
    sh = [
        num(el.text)
        for el in root.iter()
        if local(el.tag) in ("aggregateAmountOwned", "reportingPersonBeneficiallyOwnedAggregateNumberOfShares")
    ]
    pct = [x for x in pct if x is not None]
    sh = [x for x in sh if x is not None]
    cik = first(root, "issuerCIK", "issuerCik")
    return {
        "issuer": first(root, "issuerName"),
        "issuer_cik": int(cik) if cik and cik.isdigit() else None,
        "cusip": first(root, "issuerCusipNumber"),
        "event_date": first(root, "dateOfEvent", "eventDateRequiresFilingThisStatement"),
        "pct": max(pct) if pct else None,
        "shares": max(sh) if sh else None,
    }


def mdy(s):
    """13D·13G 날짜(MM/DD/YYYY) → YYYY-MM-DD"""
    try:
        return dt.datetime.strptime(s, "%m/%d/%Y").date().isoformat()
    except (TypeError, ValueError):
        return s


def raw_doc(primary):
    """'xslF345X06/ownership.xml'처럼 보기용 변환 경로가 붙어 있으면 원본 XML 이름만"""
    return primary.split("/", 1)[1] if primary.startswith("xsl") and "/" in primary else primary


def prev_stake(cik, rows, idx, issuer_cik, cusip, budget=8):
    """같은 회사에 대한 바로 앞 13D·13G의 지분율(%). XML 보고서(2024-12 뒤)만 읽는다"""
    for j in range(idx + 1, len(rows)):
        form, _, acc, doc = rows[j]
        if form not in FORMS_13D:
            continue
        if budget <= 0:
            return None
        budget -= 1
        try:
            p = parse_13dg(sec(ARCHIVE.format(cik, acc.replace("-", ""), raw_doc(doc))))
        except Exception as e:  # noqa: BLE001
            print(f"  앞 보고서 못 읽음 {acc}: {e}", file=sys.stderr)
            continue
        if (issuer_cik and p["issuer_cik"] == issuer_cik) or (cusip and p["cusip"] == cusip):
            return p["pct"]
    return None


# ---------- 투자자별 ----------


def recent_filings(cik, since):
    d = json.loads(sec(SUBMISSIONS.format(cik)))
    r = d["filings"]["recent"]
    rows = [(r["form"][i], r["filingDate"][i], r["accessionNumber"][i], r["primaryDocument"][i]) for i in range(len(r["form"]))]
    return rows, [i for i, x in enumerate(rows) if x[1] >= since and x[0] in FORMS_13D | FORMS_4]


def build_events(inv, since, known, tickers):
    id_, cik, who, firm = inv
    rows, idx = recent_filings(cik, since)
    out = []
    for i in idx:
        form, filed, acc, doc = rows[i]
        if acc in known:
            out.append(known[acc])
            continue
        link = ARCHIVE.format(cik, acc.replace("-", ""), doc)
        try:
            body = sec(ARCHIVE.format(cik, acc.replace("-", ""), raw_doc(doc)))
            if form in FORMS_4:
                p = parse_form4(body)
                # 투자자 회사가 '발행 회사'인 공시(버크셔 임원의 버크셔 주식 매매 등)는 그 투자자의 매매가 아니다
                if cik not in p["owners"]:
                    continue
                e = form4_event(p)
                if not e:
                    continue
                e.update(issuer=p["issuer"], ticker=p["ticker"])
            else:
                p = parse_13dg(body)
                if p["issuer_cik"] == cik:
                    continue
                e = {
                    "kind": "stake",
                    "issuer": p["issuer"],
                    "ticker": tickers.get(p["issuer_cik"], "") if p["issuer_cik"] else "",
                    "pct": p["pct"],
                    "shares": p["shares"],
                    "event_date": mdy(p["event_date"]),
                    "amend": form.endswith("/A"),
                    "active": "13D" in form,
                }
                if e["amend"]:
                    e["prev_pct"] = prev_stake(cik, rows, i, p["issuer_cik"], p["cusip"])
        except Exception as ex:  # noqa: BLE001 — 한 공시가 깨져도 나머지는 싣는다
            print(f"  {who} {form} {acc} 못 읽음: {ex}", file=sys.stderr)
            continue
        e.update(investor=id_, form=form, filed=filed, acc=acc, url=link)
        out.append(e)
    return out


def load_tickers():
    d = json.loads(get(COMPANY_TICKERS))
    m = {}
    for v in d.values():
        m.setdefault(int(v["cik_str"]), v["ticker"])  # 첫 줄이 대표 종목
    return m


# ---------- ARK ----------


def parse_ark(text):
    """ARK CSV → (날짜, {종목 키: [이름, 기호, 수량, 평가액]}). 맨 아래 설명 줄은 버린다"""
    day = None
    out = {}
    for r in csv.DictReader(io.StringIO(text)):
        d, name = (r.get("date") or "").strip(), (r.get("company") or "").strip()
        shares = num(r.get("shares") or "")
        if not d or not name or shares is None:
            continue
        day = mdy(d)
        tick = (r.get("ticker") or "").strip().split(" ")[0]
        key = tick or (r.get("cusip") or name).strip()
        value = num(r.get("market value ($)") or "") or 0
        if key in out:
            out[key][2] += shares
            out[key][3] += value
        else:
            out[key] = [name, tick, shares, value]
    return day, out


def ark_trades(fund, day, prev, cur, min_move=ARK_MIN_MOVE):
    """전날 → 오늘 보유 비교. 설정·환매 몫(수량 변화율 중앙값)을 빼고 남은 변화만"""
    common = [k for k in cur if k in prev and prev[k][2] > 0]
    ratios = [cur[k][2] / prev[k][2] for k in common]
    flow = statistics.median(ratios) if ratios else 1.0
    out = []
    for k in set(prev) | set(cur):
        p = prev.get(k)
        c = cur.get(k)
        ps = p[2] if p else 0.0
        cs = c[2] if c else 0.0
        delta = cs - ps * flow
        base = max(ps * flow, cs, 1)
        if abs(delta) / base < min_move:
            continue
        ref = c or p
        unit = (ref[3] / ref[2]) if ref[2] else 0
        out.append(
            {
                "date": day,
                "fund": fund,
                "ticker": ref[1],
                "name": ref[0],
                "kind": "new" if not p else "exit" if not c else "buy" if delta > 0 else "sell",
                "shares": round(abs(delta)),
                "value": round(abs(delta) * unit),
            }
        )
    return out


def update_ark(path, since):
    """펀드마다 오늘 CSV를 받아 보관본과 비교하고, 30일 안의 매매만 남긴다"""
    old = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    funds = old.get("funds", {})
    trades = [t for t in old.get("trades", []) if t["date"] >= since]
    fresh = []
    for fund, name in ARK_FUNDS.items():
        try:
            text = get(ARK_CSV + urllib.parse.quote(name), headers={"User-Agent": "Mozilla/5.0"}).decode("utf-8-sig", "replace")
        except Exception as e:  # noqa: BLE001
            print(f"  {fund} 못 받음: {e}", file=sys.stderr)
            continue
        day, cur = parse_ark(text)
        if not day or not cur:
            continue
        if day < (dt.date.fromisoformat(since) + dt.timedelta(days=WINDOW - 7)).isoformat():
            print(f"  {fund} 자료가 {day}로 오래돼 뺌", file=sys.stderr)
            continue
        prev = funds.get(fund)
        if prev and day > prev["date"]:
            new = ark_trades(fund, day, prev["holdings"], cur)
            trades = [t for t in trades if not (t["fund"] == fund and t["date"] == day)] + new
            fresh += new
        if not prev or day > prev["date"]:
            funds[fund] = {"date": day, "holdings": cur}
    started = old.get("started") or min((f["date"] for f in funds.values()), default=None)
    trades.sort(key=lambda t: (t["date"], t["value"]), reverse=True)
    snap = {"started": started, "funds": funds, "trades": trades}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, separators=(",", ":"))
    print(f"ARK: 펀드 {len(funds)}개, 오늘 새 매매 {len(fresh)}건, 30일 {len(trades)}건")
    return snap


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--ark", required=True)
    ap.add_argument("--only", help="이 투자자 id만(점검용)")
    a = ap.parse_args()
    today = dt.date.today()
    since = (today - dt.timedelta(days=WINDOW)).isoformat()
    old = json.load(open(a.out, encoding="utf-8")) if os.path.exists(a.out) else {}
    known = {e["acc"]: e for e in old.get("events", []) if "acc" in e}
    tickers = load_tickers()
    events, failed = [], []
    for inv in INVESTORS:
        if a.only and inv[0] != a.only:
            continue
        try:
            got = build_events(inv, since, known, tickers)
            print(f"{inv[2]}: 최근 {WINDOW}일 공시 {len(got)}건")
            events += got
        except Exception as e:  # noqa: BLE001
            print(f"{inv[2]} 실패: {e}", file=sys.stderr)
            failed.append(inv[0])
            events += [x for x in old.get("events", []) if x.get("investor") == inv[0] and x["filed"] >= since]
    events.sort(key=lambda e: (e["filed"], e.get("value") or 0), reverse=True)
    ark = update_ark(a.ark, since)
    out = {
        "updated": today.isoformat(),
        "since": since,
        "window": WINDOW,
        "failed": failed,
        "investors": [{"id": i, "name": n, "firm": f} for i, _, n, f in INVESTORS],
        "events": events,
        "ark": {"started": ark["started"], "asof": max((f["date"] for f in ark["funds"].values()), default=None), "trades": ark["trades"]},
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"저장: 공시 {len(events)}건, ARK 매매 {len(ark['trades'])}건 → {a.out}")


if __name__ == "__main__":
    main()
