"""유명 투자자 포트폴리오: SEC 13F 보고서를 받아 최근 분기 보유 종목과 전 분기 대비 변화를 만든다.

    python collector/investors_13f.py --out src/data/investors.json --tickers src/data/cusip-tickers.json

- 운용자산 1억 달러가 넘는 미국 기관은 분기가 끝나고 45일 안에 SEC에 13F-HR로 미국 상장 주식 보유를 신고한다.
  SEC EDGAR 자료는 미국 정부 공개 자료다(접속 규칙: 연락처가 든 User-Agent, 초당 10회 이하).
- 투자자마다 가장 최근 13F-HR(원본, 정정 보고서 13F-HR/A는 쓰지 않는다)과 그 앞 분기 13F-HR을 비교한다.
- 13F에는 종목 기호가 없고 CUSIP(증권 식별 번호)만 있다. 기호는 OpenFIGI(키 없이 분당 25회)로 찾아
  --tickers 파일에 쌓아 두고 다시 묻지 않는다.
- 이미 받은 보고서 번호가 같으면 그 투자자는 다시 받지 않는다. 매일 돈다(.github/workflows/collect-investors.yml).
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

UA = "KosNas contact@kosnas.com"
SUBMISSIONS = "https://data.sec.gov/submissions/CIK{:010d}.json"
ARCHIVE = "https://www.sec.gov/Archives/edgar/data/{}/{}/"
OPENFIGI = "https://api.openfigi.com/v3/mapping"

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

KEEP = 100  # 화면에 싣는 보유 종목 수(평가액 순)
KEEP_SOLD = 40


def get(url, data=None, headers=None, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 — 잠깐 막히면 쉬었다 다시
            if k == tries - 1:
                raise
            wait = 65 if "429" in str(e) else 3 * (k + 1)
            print(f"  다시 시도({e}) {wait}초 뒤", file=sys.stderr)
            time.sleep(wait)


def sec_json(url):
    time.sleep(0.15)
    return json.loads(get(url))


def filings(cik):
    """13F-HR 원본 보고서 목록(최근 순): (보고서 번호, 기준일, 신고일)"""
    d = sec_json(SUBMISSIONS.format(cik))
    r = d["filings"]["recent"]
    out = [(r["accessionNumber"][i], r["reportDate"][i], r["filingDate"][i]) for i, f in enumerate(r["form"]) if f == "13F-HR"]
    return d.get("name", ""), out


def local(tag):
    return tag.rsplit("}", 1)[-1]


def parse_table(xml_bytes, filed):
    """정보 표(XML) → [{name, cls, cusip, value, shares, put_call}] (값은 달러)"""
    root = ET.fromstring(xml_bytes)
    # 2023년 1월 3일 전 보고서는 평가액이 천 달러 단위
    mult = 1000 if filed < "2023-01-03" else 1
    rows = []
    for it in root.iter():
        if local(it.tag) != "infoTable":
            continue
        f = {}
        for c in it.iter():
            t = local(c.tag)
            if c.text and c.text.strip() and t not in f:
                f[t] = c.text.strip()
        try:
            rows.append(
                {
                    "name": f.get("nameOfIssuer", ""),
                    "cls": f.get("titleOfClass", ""),
                    "cusip": f.get("cusip", "").upper(),
                    "value": float(f.get("value", 0)) * mult,
                    "shares": float(f.get("sshPrnamt", 0)),
                    "put_call": (f.get("putCall") or "").capitalize() or None,
                    "prn": f.get("sshPrnamtType", "SH").upper() == "PRN",
                }
            )
        except ValueError:
            continue
    # 2023년 뒤에도 천 달러 단위로 적어 내는 곳이 있다: 주당 평가액 중앙값이 1달러도 안 되면 천 달러로 본다
    per = sorted(r["value"] / r["shares"] for r in rows if r["shares"] > 0 and not r["put_call"])
    if mult == 1 and per and per[len(per) // 2] < 1:
        for r in rows:
            r["value"] *= 1000
    return rows


def aggregate(rows):
    """같은 CUSIP·옵션 구분끼리 더한다(운용역별로 나눠 적은 줄을 합친다)"""
    out = {}
    for r in rows:
        k = (r["cusip"], r["put_call"])
        if k not in out:
            out[k] = dict(r)
        else:
            out[k]["value"] += r["value"]
            out[k]["shares"] += r["shares"]
    return out


def compare(cur, prev):
    """지금 분기 보유(cur)와 전 분기(prev) → (보유 목록, 전량 매도 목록, 총액)"""
    total = sum(r["value"] for r in cur.values()) or 1
    holdings = []
    for k, r in cur.items():
        p = prev.get(k) if prev is not None else None
        if prev is None:
            change = None
        elif p is None:
            change = "new"
        elif r["shares"] > p["shares"] * 1.005:
            change = "add"
        elif r["shares"] < p["shares"] * 0.995:
            change = "reduce"
        else:
            change = "same"
        holdings.append(
            {
                **r,
                "weight": r["value"] / total * 100,
                "prev_shares": p["shares"] if p else None,
                "change": change,
            }
        )
    holdings.sort(key=lambda h: -h["value"])
    sold = []
    if prev is not None:
        sold = [{**p, "prev_value": p["value"]} for k, p in prev.items() if k not in cur]
        sold.sort(key=lambda s: -s["prev_value"])
    return holdings, sold, total


def info_table(cik, acc, filed):
    base = ARCHIVE.format(cik, acc.replace("-", ""))
    idx = sec_json(base + "index.json")
    names = [i["name"] for i in idx["directory"]["item"] if i["name"].lower().endswith(".xml") and i["name"] != "primary_doc.xml"]
    if not names:
        raise RuntimeError(f"정보 표가 없다: {base}")
    time.sleep(0.15)
    return parse_table(get(base + names[0]), filed)


def pick_ticker(data):
    """OpenFIGI 결과에서 미국 거래소 주식 기호 하나. 채권 기호(띄어쓰기 들어감)는 버린다"""
    eq = [d for d in data if d.get("marketSector") == "Equity" and d.get("ticker")]
    us = [d for d in eq if d.get("exchCode") == "US"] or eq
    for d in us:
        t = d["ticker"].replace("/", ".").rstrip("*")
        if re.fullmatch(r"[A-Z][A-Z0-9.]{0,7}", t):
            return t
    return None


def map_tickers(cusips, cache):
    """CUSIP → 종목 기호(OpenFIGI). 못 찾은 것(None)은 다음에 다시 묻는다"""
    todo = sorted(c for c in set(cusips) if c and cache.get(c) is None)
    key = os.environ.get("OPENFIGI_API_KEY")
    batch = 100 if key else 10
    wait = 0.3 if key else 2.6  # 키 없이 분당 25회
    print(f"OpenFIGI: 찾을 CUSIP {len(todo)}개", file=sys.stderr)
    # 미국 밖에서 설립한 회사(번호가 영문자로 시작)는 CINS로 물어야 찾힌다
    for id_type in ("ID_CUSIP", "ID_CINS"):
        todo = [c for c in todo if cache.get(c) is None]
        for i in range(0, len(todo), batch):
            part = todo[i : i + batch]
            body = json.dumps([{"idType": id_type, "idValue": c} for c in part]).encode()
            headers = {"Content-Type": "application/json", **({"X-OPENFIGI-APIKEY": key} if key else {})}
            try:
                res = json.loads(get(OPENFIGI, data=body, headers=headers))
            except Exception as e:  # noqa: BLE001 — 기호 없이도 화면은 그린다
                print(f"  OpenFIGI 실패: {e}", file=sys.stderr)
                return cache
            for c, r in zip(part, res):
                cache[c] = pick_ticker(r.get("data") or [])
            time.sleep(wait)
    return cache


def round_row(r, ticker):
    out = {
        "name": r["name"],
        "ticker": ticker,
        "cls": r["cls"],
        "cusip": r["cusip"],
        "value": round(r.get("value", r.get("prev_value", 0))),
        "shares": round(r["shares"]),
    }
    if r.get("put_call"):
        out["put_call"] = r["put_call"]
    if r.get("prn"):
        out["prn"] = True
    for k in ("weight",):
        if k in r:
            out[k] = round(r[k], 2)
    if "change" in r:
        out["change"] = r["change"]
        out["prev_shares"] = None if r["prev_shares"] is None else round(r["prev_shares"])
    return out


def build_one(spec, old):
    iid, cik, person, firm_ko = spec
    sec_name, fl = filings(cik)
    if not fl:
        raise RuntimeError("13F-HR이 없다")
    cur_acc, period, filed = fl[0]
    prev = fl[1] if len(fl) > 1 else None
    if old and old.get("accession") == cur_acc and old.get("prev_accession") == (prev[0] if prev else None):
        print(f"{person}: 그대로({period})", file=sys.stderr)
        return old, []
    print(f"{person}: {period} 보고서 받기", file=sys.stderr)
    cur = aggregate(info_table(cik, cur_acc, filed))
    pv = aggregate(info_table(cik, prev[0], prev[2])) if prev else None
    holdings, sold, total = compare(cur, pv)
    return {
        "id": iid,
        "cik": cik,
        "person": person,
        "firm": firm_ko,
        "sec_name": sec_name,
        "period": period,
        "filed": filed,
        "accession": cur_acc,
        "prev_period": prev[1] if prev else None,
        "prev_accession": prev[0] if prev else None,
        "total": round(total),
        "count": len(holdings),
        "new_count": sum(h["change"] == "new" for h in holdings),
        "add_count": sum(h["change"] == "add" for h in holdings),
        "reduce_count": sum(h["change"] == "reduce" for h in holdings),
        "sold_count": len(sold),
        "_holdings": holdings[:KEEP],
        "_sold": sold[:KEEP_SOLD],
    }, [h["cusip"] for h in holdings[:KEEP]] + [s["cusip"] for s in sold[:KEEP_SOLD]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--tickers", required=True)
    ap.add_argument("--only", help="이 id만(시험용)")
    ap.add_argument("--force", action="store_true", help="보고서가 같아도 다시 받는다")
    a = ap.parse_args()

    old = {}
    if os.path.exists(a.out):
        old = {x["id"]: x for x in json.load(open(a.out, encoding="utf-8"))["investors"]}
    cache = json.load(open(a.tickers, encoding="utf-8")) if os.path.exists(a.tickers) else {}

    out, cusips, failed = [], [], []
    for spec in INVESTORS:
        if a.only and spec[0] != a.only:
            continue
        try:
            inv, cs = build_one(spec, None if a.force else old.get(spec[0]))
        except Exception as e:  # noqa: BLE001 — 한 사람이 실패해도 나머지는 낸다
            print(f"{spec[2]}: 실패 {e}", file=sys.stderr)
            failed.append(spec[0])
            if spec[0] in old:
                out.append(old[spec[0]])
            continue
        out.append(inv)
        cusips += cs

    map_tickers(cusips, cache)
    for inv in out:
        if "_holdings" in inv:
            inv["holdings"] = [round_row(h, cache.get(h["cusip"])) for h in inv.pop("_holdings")]
            inv["sold"] = [round_row(s, cache.get(s["cusip"])) for s in inv.pop("_sold")]
        else:  # 그대로 쓴 것: 새로 찾은 기호만 채운다
            for h in inv["holdings"] + inv["sold"]:
                if not h.get("ticker"):
                    h["ticker"] = cache.get(h["cusip"])

    if not out:
        sys.exit("받은 투자자가 없다")
    json.dump(dict(sorted(cache.items())), open(a.tickers, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    body = {"updated": dt.date.today().isoformat(), "failed": failed, "investors": out}
    json.dump(body, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out)}명, 실패 {failed}", file=sys.stderr)


if __name__ == "__main__":
    main()
