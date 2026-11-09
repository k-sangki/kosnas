"""주요일정(국장): OpenDART 공시에서 '날짜가 박힌 일정'을 뽑는다.

- 배당: 현금ㆍ현물배당결정(거래소 공시, 지주회사가 대신 낸 자회사 공시는 뺀다) 원문 → 배당기준일·1주당 배당금(보통주)·시가배당률
- 무상증자: 주요사항보고서 무상증자결정(API fricDecsn) → 신주배정기준일·1주당 배정 주식 수
- 공모주 청약: 증권신고서(지분증권, 비상장 회사) (API estkRs) → 청약기일·공모가·주관사

결과는 src/data/schedule-kr.json. 마지막 매수일(기준일 2거래일 전)·권리락은 화면에서 휴장일 표로 계산한다.
필요한 값: DART_API_KEY
"""

import argparse
import datetime as dt
import io
import json
import os
import re
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fetch import _get  # noqa: E402

API = "https://opendart.fss.or.kr/api"
KST = dt.timezone(dt.timedelta(hours=9))
DATE = re.compile(r"(20\d\d)\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})")


def jget(path: str, key: str, **params) -> dict:
    raw = _get(f"{API}/{path}", {"crtfc_key": key, **params})
    time.sleep(0.12)  # 분당 1,000회 한도 아래로
    return json.loads(raw)


def dates(text: str) -> list[str]:
    out = []
    for y, m, d in DATE.findall(text or ""):
        try:
            out.append(dt.date(int(y), int(m), int(d)).isoformat())
        except ValueError:
            pass
    return out


def num(text: str | None) -> float | None:
    if not text:
        return None
    t = re.sub(r"[,\s원%]", "", str(text))
    try:
        return float(t)
    except ValueError:
        return None


def filings(key: str, kind: str, begin: dt.date, end: dt.date, want) -> list[dict]:
    """공시 목록(kind = 공시유형)에서 보고서 이름이 want를 만족하는 것만. 회사 없이 묻는 기간은 3개월까지"""
    out, page = [], 1
    while True:
        body = jget("list.json", key, bgn_de=begin.strftime("%Y%m%d"), end_de=end.strftime("%Y%m%d"), pblntf_ty=kind, page_no=page, page_count=100)
        if body.get("status") == "013":  # 자료 없음
            break
        if body.get("status") != "000":
            raise RuntimeError(f"DART 목록 오류 {body.get('status')}: {body.get('message')}")
        out += [r for r in body["list"] if want(r["report_nm"])]
        if page >= int(body.get("total_page", 1)):
            break
        page += 1
    return out


def latest_per_corp(rows: list[dict]) -> list[dict]:
    """정정 공시가 있으면 회사마다 마지막 것만"""
    best: dict[str, dict] = {}
    for r in rows:
        if r["corp_code"] not in best or r["rcept_no"] > best[r["corp_code"]]["rcept_no"]:
            best[r["corp_code"]] = r
    return list(best.values())


def document_text(key: str, rcept_no: str) -> str:
    raw = _get(f"{API}/document.xml", {"crtfc_key": key, "rcept_no": rcept_no})
    time.sleep(0.12)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        parts = [z.read(n).decode("utf-8", "replace") for n in z.namelist()]
    return "\n".join(parts)


def rows_of(xml: str) -> list[list[str]]:
    """표의 줄마다 칸 글자"""
    out = []
    for tr in re.findall(r"<TR[^>]*>(.*?)</TR>", xml, flags=re.S | re.I):
        cells = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c)).strip() for c in re.findall(r"<T[DHE][^>]*>(.*?)</T[DHE]>", tr, flags=re.S | re.I)]
        if cells:
            out.append(cells)
    return out


def parse_dividend(xml: str) -> dict | None:
    rows = rows_of(xml)
    record = per_share = yield_pct = None
    kind = ""
    for i, cells in enumerate(rows):
        line = " ".join(cells)
        if "배당기준일" in line and not record:
            ds = dates(line)
            record = ds[0] if ds else None
        elif "배당구분" in line and not kind:
            kind = cells[-1]
        elif "1주당" in line and "배당금" in line and per_share is None:
            # 같은 줄에 보통주식이 있거나 바로 다음 줄에 있다
            for c in (cells, rows[i + 1] if i + 1 < len(rows) else []):
                if any("보통" in x for x in c):
                    per_share = num(c[-1])
                    break
        elif "시가배당" in line and yield_pct is None:
            for c in (cells, rows[i + 1] if i + 1 < len(rows) else []):
                if any("보통" in x for x in c):
                    yield_pct = num(c[-1])
                    break
    if not record or not per_share:
        return None
    return {"record": record, "perShare": per_share, "yield": yield_pct, "kind": kind}


def collect_dividends(key: str, today: dt.date) -> list[dict]:
    rows = filings(key, "I", today - dt.timedelta(days=50), today, lambda n: "배당결정" in n and "주식배당" not in n and "자회사" not in n)
    rows = [r for r in rows if r.get("stock_code")]
    print(f"배당 결정 공시 {len(rows)}건")
    out = []
    for r in latest_per_corp(rows):
        try:
            d = parse_dividend(document_text(key, r["rcept_no"]))
        except Exception as e:  # 원문 한 건이 깨져도 나머지는 낸다
            print(f"  {r['corp_name']} 원문 실패: {e}")
            continue
        if not d or d["record"] < today.isoformat():
            continue
        out.append({"type": "dividend", "code": r["stock_code"], "name": r["corp_name"], "rcept": r["rcept_no"], **d})
    return out


def collect_bonus(key: str, today: dt.date) -> list[dict]:
    rows = filings(key, "B", today - dt.timedelta(days=50), today, lambda n: "무상증자결정" in n)
    rows = [r for r in rows if r.get("stock_code")]
    print(f"무상증자 결정 {len(rows)}건")
    out = []
    for r in latest_per_corp(rows):
        body = jget("fricDecsn.json", key, corp_code=r["corp_code"], bgn_de=(today - dt.timedelta(days=60)).strftime("%Y%m%d"), end_de=today.strftime("%Y%m%d"))
        items = sorted(body.get("list", []), key=lambda x: x.get("rcept_no", ""))
        if not items:
            continue
        x = items[-1]
        ds = dates(x.get("nstk_asstd", ""))
        if not ds or ds[0] < today.isoformat():
            continue
        lst = dates(x.get("nstk_lstprd", ""))
        out.append(
            {
                "type": "bonus",
                "code": r["stock_code"],
                "name": r["corp_name"],
                "rcept": x.get("rcept_no", r["rcept_no"]),
                "record": ds[0],
                "ratio": num(x.get("nstk_ascnt_ps_ostk")),
                "listing": lst[0] if lst else None,
            }
        )
    return out


def collect_ipo(key: str, today: dt.date) -> list[dict]:
    rows = filings(key, "C", today - dt.timedelta(days=80), today, lambda n: "증권신고서(지분증권)" in n)
    rows = [r for r in rows if r.get("corp_cls") == "E"]  # 아직 상장 안 된 회사 = 공모주
    print(f"공모주 증권신고서 {len(rows)}건")
    out = []
    for r in latest_per_corp(rows):
        body = jget("estkRs.json", key, corp_code=r["corp_code"], bgn_de=(today - dt.timedelta(days=90)).strftime("%Y%m%d"), end_de=today.strftime("%Y%m%d"))
        groups = {g.get("title", ""): g.get("list", []) for g in body.get("group", [])}
        gen = sorted(groups.get("일반사항", []), key=lambda x: x.get("rcept_no", ""))
        if not gen:
            continue
        g = gen[-1]
        rc = g.get("rcept_no")
        sbd = dates(g.get("sbd", ""))
        if not sbd or sbd[-1] < today.isoformat():
            continue
        kinds = [x for x in groups.get("증권의종류", []) if x.get("rcept_no") == rc] or groups.get("증권의종류", [])
        price = num(kinds[-1].get("slprc")) if kinds else None
        leads = sorted({x.get("actnmn", "").strip() for x in groups.get("인수인정보", []) if x.get("rcept_no") == rc and x.get("actsen", "").find("대표") >= 0} - {""})
        if not leads:
            leads = sorted({x.get("actnmn", "").strip() for x in groups.get("인수인정보", []) if x.get("rcept_no") == rc} - {""})
        out.append(
            {
                "type": "ipo",
                "name": r["corp_name"],
                "rcept": rc or r["rcept_no"],
                "start": sbd[0],
                "end": sbd[-1],
                "price": price,
                "brokers": leads[:3],
                "spac": "기업인수목적" in r["corp_name"] or "스팩" in r["corp_name"],
            }
        )
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="src/data/schedule-kr.json")
    args = ap.parse_args()
    key = os.environ.get("DART_API_KEY", "").strip()
    if not key:
        sys.exit("DART_API_KEY가 없습니다")
    today = dt.datetime.now(KST).date()
    events = []
    for name, fn in (("배당", collect_dividends), ("무상증자", collect_bonus), ("공모주", collect_ipo)):
        try:
            events += fn(key, today)
        except Exception as e:  # 하나가 막혀도 나머지 일정은 낸다
            print(f"::warning::{name} 일정 실패: {e}")
    events.sort(key=lambda e: (e.get("record") or e.get("start"), e["name"]))
    Path(args.out).write_text(json.dumps({"updated": dt.datetime.now(KST).isoformat(timespec="minutes"), "events": events}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"일정 {len(events)}건 → {args.out}")


if __name__ == "__main__":
    main()
