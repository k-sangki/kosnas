"""미국 종목 범위를 갱신한다: S&P 500 ∪ 나스닥 100 ∪ 필라델피아 반도체 ∪ 다우존스 30 ∪ 러셀 1000.

    python collector/us_universe.py --out src/data/us-universe.json

구성 종목은 지수마다 공개된 목록에서 받는다(가격은 받지 않는다).
- S&P 500·다우존스 30: 지수를 그대로 따르는 SPDR ETF(SPY·DIA)의 매일 보유 종목 엑셀. S&P 500은 안 되면 위키백과 표.
- 나스닥 100: 나스닥 공식 목록(api.nasdaq.com).
- 필라델피아 반도체(SOX): 나스닥 지수 사이트의 구성 종목 표(indexes.nasdaqomx.com).
- 러셀 1000: Vanguard Russell 1000 ETF(VONE) 보유 종목(월말 기준). iShares IWB는 자동 요청을 막는다.
지수마다 종목 수가 정상 범위를 벗어나면(원천 표 모양이 바뀌었거나 받기 실패) 그 지수는 지난 목록을 그대로 쓴다.
한 달에 한 번 돈다(.github/workflows/collect-us-universe.yml).
"""

import argparse
import datetime as dt
import html.parser
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
WIKI = "https://en.wikipedia.org/w/api.php"
SSGA = "https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-{}.xlsx"
NASDAQ100 = "https://api.nasdaq.com/api/quote/list-type/nasdaq100"
NASDAQ_INDEX = "https://indexes.nasdaqomx.com/Index/WeightingData"
VANGUARD = "https://investor.vanguard.com/vmf/api/{}/portfolio-holding/stock?start=1&count=2000"
XLSX = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
SYM = r"[A-Z][A-Z0-9.]{0,6}"

# 지수: (이름, 정상 종목 수 범위)
INDEXES = {
    "SP500": ("S&P 500", (495, 510)),
    "NDX": ("나스닥 100", (98, 105)),
    "SOX": ("필라델피아 반도체", (25, 35)),
    "DJI": ("다우존스 30", (30, 30)),
    "R1000": ("러셀 1000", (950, 1060)),
}

SYMBOL_HEADS = ("symbol", "ticker", "ticker symbol")
NAME_HEADS = ("security", "company", "name", "company name")
SECTOR_HEADS = ("gics sector", "sector", "industry", "icb industry")


def get(url: str, data: bytes | None = None, tries: int = 4) -> bytes:
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Accept": "application/json, */*"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1:
                raise
            print(f"  다시 시도 ({e})")
            time.sleep(3 * (i + 1))
    raise RuntimeError("unreachable")


def key(sym: str) -> str:
    """같은 종목을 하나로 묶는 열쇠. BRK.B·BRK-B·BRKB를 같게 본다."""
    return re.sub(r"[^A-Z0-9]", "", sym.upper())


def clean_symbol(s: str) -> str:
    s = re.sub(r"\[.*?\]", "", s).strip().upper()
    s = s.split(":")[-1].strip()  # "NYSE: MMM" 같은 꼴
    return re.sub(r"[-/ ]+", ".", s)


class Tables(html.parser.HTMLParser):
    """wikitable 표를 [머리 행, 행…] 문자열 목록으로 모은다."""

    def __init__(self):
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self._depth = 0
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self._depth += 1
            if self._depth == 1 and "wikitable" in (a.get("class") or ""):
                self.tables.append([])
            elif self._depth == 1:
                self.tables.append(None)  # type: ignore[arg-type]
        elif self._depth == 1 and self.tables and self.tables[-1] is not None:
            if tag == "tr":
                self._row = []
            elif tag in ("td", "th") and self._row is not None:
                self._cell = []
            elif tag in ("sup", "style"):
                self._skip += 1

    def handle_endtag(self, tag):
        if tag == "table":
            self._depth -= 1
            if self._depth == 0 and self.tables and self.tables[-1] is None:
                self.tables.pop()
        elif self._depth == 1 and self.tables and self.tables[-1] is not None:
            if tag in ("sup", "style") and self._skip:
                self._skip -= 1
            elif tag in ("td", "th") and self._cell is not None and self._row is not None:
                self._row.append(re.sub(r"\s+", " ", "".join(self._cell)).strip())
                self._cell = None
            elif tag == "tr" and self._row is not None:
                if self._row:
                    self.tables[-1].append(self._row)
                self._row = None

    def handle_data(self, data):
        if self._cell is not None and not self._skip:
            self._cell.append(data)


def wiki_tables(page: str):
    q = urllib.parse.urlencode({"action": "parse", "page": page, "prop": "text", "format": "json", "formatversion": 2, "redirects": 1})
    html = json.loads(get(f"{WIKI}?{q}"))["parse"]["text"]
    p = Tables()
    p.feed(html)
    return p.tables


def col(head: list[str], names) -> int | None:
    low = [h.lower() for h in head]
    for n in names:
        if n in low:
            return low.index(n)
    return None


def from_wiki(page: str, lo: int, hi: int) -> list[dict]:
    """문서의 표 중 종목 기호 열이 있고 행 수가 정상 범위에 가장 가까운 표"""
    best: list[dict] = []
    for t in wiki_tables(page):
        if len(t) < 2:
            continue
        head = t[0]
        si = col(head, SYMBOL_HEADS)
        if si is None:
            continue
        ni = col(head, NAME_HEADS)
        ci = col(head, SECTOR_HEADS)
        rows = []
        for r in t[1:]:
            if len(r) <= si:
                continue
            sym = clean_symbol(r[si])
            if not re.fullmatch(r"[A-Z][A-Z0-9.]{0,6}", sym):
                continue
            rows.append(
                {
                    "symbol": sym,
                    "name": r[ni] if ni is not None and ni < len(r) else "",
                    "sector": r[ci] if ci is not None and ci < len(r) else "",
                }
            )
        if lo <= len(rows) <= hi:
            return rows
        if abs(len(rows) - (lo + hi) / 2) < abs(len(best) - (lo + hi) / 2):
            best = rows
    return best


def row(sym: str, name: str = "", sector: str = "") -> dict | None:
    sym = clean_symbol(sym or "")
    if not re.fullmatch(SYM, sym):
        return None
    return {"symbol": sym, "name": (name or "").strip(), "sector": "" if sector in (None, "-") else sector.strip()}


def xlsx_rows(b: bytes) -> list[list[str]]:
    """엑셀 첫 시트를 문자열 행으로(표준 라이브러리만)"""
    z = zipfile.ZipFile(io.BytesIO(b))
    ss = [
        "".join(t.text or "" for t in si.iter(f"{XLSX}t"))
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(f"{XLSX}si")
    ]
    out = []
    for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(f"{XLSX}row"):
        vals = []
        for c in r.findall(f"{XLSX}c"):
            v = c.find(f"{XLSX}v")
            vals.append(ss[int(v.text)] if c.get("t") == "s" and v is not None and v.text else ((v.text or "") if v is not None else ""))
        out.append(vals)
    return out


def from_spdr(fund: str) -> list[dict]:
    rows = xlsx_rows(get(SSGA.format(fund.lower())))
    hi = next(i for i, r in enumerate(rows) if r[:2] == ["Name", "Ticker"])
    head = rows[hi]
    si = head.index("Sector") if "Sector" in head else None
    out = []
    for r in rows[hi + 1 :]:
        if len(r) < 2:  # 표 끝의 빈 줄
            continue
        x = row(r[1], r[0], r[si] if si is not None and si < len(r) else "")
        if x:
            out.append(x)
    return out


def from_nasdaq100() -> list[dict]:
    rows = json.loads(get(NASDAQ100))["data"]["data"]["rows"]
    out = [row(r["symbol"], re.sub(r"\s+(Common|Class|Ordinary|American).*$", "", r.get("companyName") or "")) for r in rows]
    return [x for x in out if x]


def from_sox() -> list[dict]:
    day = dt.date.today()
    for back in range(7):
        d = (day - dt.timedelta(days=back)).isoformat()
        body = urllib.parse.urlencode({"id": "SOX", "tradeDate": f"{d}T00:00:00.000", "timeOfDay": "SOD"}).encode()
        data = json.loads(get(NASDAQ_INDEX, body)).get("aaData") or []
        if data:
            return [x for x in (row(r["Symbol"], r.get("Name", "")) for r in data) if x]
    return []


def from_vanguard(fund: str) -> list[dict]:
    ents = json.loads(get(VANGUARD.format(fund)))["fund"]["entity"]
    return [x for x in (row(e.get("ticker") or "", e.get("longName") or e.get("shortName") or "") for e in ents) if x]


def load_prev(path: str) -> dict:
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="src/data/us-universe.json")
    args = ap.parse_args()

    prev = load_prev(args.out)
    prev_members: dict[str, list[dict]] = {}
    for s in prev.get("stocks", []):
        for ix in s["indexes"]:
            prev_members.setdefault(ix, []).append({"symbol": s["symbol"], "name": s["name"], "sector": s.get("sector", "")})

    tries_of = {
        "SP500": [("SPDR SPY 보유 종목", lambda: from_spdr("SPY")), ("위키백과 S&P 500 목록", lambda: from_wiki("List_of_S&P_500_companies", 495, 510))],
        "NDX": [("나스닥 공식 목록", from_nasdaq100)],
        "SOX": [("나스닥 지수 구성 종목", from_sox)],
        "DJI": [("SPDR DIA 보유 종목", lambda: from_spdr("DIA"))],
        "R1000": [("Vanguard VONE 보유 종목", lambda: from_vanguard("VONE"))],
    }
    members: dict[str, list[dict]] = {}
    sources: dict[str, dict] = {}
    failed = []
    for ix, (label, (lo, hi)) in INDEXES.items():
        rows: list[dict] = []
        src = ""
        for name, fn in tries_of[ix]:
            try:
                rows = fn()
            except Exception as e:
                print(f"{label}: {name} 실패 ({e!r})")
                rows = []
            # 같은 종목이 두 번(예: 보유 종목의 다른 줄) 나와도 한 번만
            seen = set()
            rows = [r for r in rows if not (key(r["symbol"]) in seen or seen.add(key(r["symbol"])))]
            if lo <= len(rows) <= hi:
                src = name
                break
            print(f"{label}: {name} {len(rows)}종목 — 정상 범위 {lo}~{hi} 밖")
        if not src:
            failed.append(ix)
            rows = prev_members.get(ix, [])
            src = prev.get("sources", {}).get(ix, {}).get("source", "") + " (지난 목록 유지)"
            if not rows:
                print(f"{label}: 지난 목록도 없다")
        members[ix] = rows
        sources[ix] = {"name": label, "count": len(rows), "source": src}
        print(f"{label}: {len(rows)}종목 · {src}")

    # 합집합. 이름은 러셀 1000(Vanguard 정식 이름)을, 업종은 S&P 500(GICS)을 먼저 쓴다
    union: dict[str, dict] = {}
    for ix in ["R1000", "SP500", "NDX", "DJI", "SOX"]:
        for r in members[ix]:
            k = key(r["symbol"])
            s = union.setdefault(k, {"symbol": r["symbol"], "name": r["name"], "sector": r["sector"], "indexes": []})
            if ix not in s["indexes"]:
                s["indexes"].append(ix)
                s["indexes"].sort(key=list(INDEXES).index)
            # 점 있는 기호(BRK.B)를 점 없는 기호(BRKB)보다 먼저
            if "." in r["symbol"] and "." not in s["symbol"]:
                s["symbol"] = r["symbol"]
            s["name"] = s["name"] or r["name"]
            s["sector"] = s["sector"] or r["sector"]
    stocks = sorted(union.values(), key=lambda s: s["symbol"])
    for s in stocks:  # 업종은 위키백과 표에서 받았을 때만 있다
        if not s["sector"]:
            del s["sector"]

    if not stocks:
        sys.exit("종목을 하나도 받지 못했다")
    old = {s["symbol"] for s in prev.get("stocks", [])}
    new = {s["symbol"] for s in stocks}
    out = {
        "updated": dt.date.today().isoformat(),
        "count": len(stocks),
        "sources": sources,
        "added": sorted(new - old) if old else [],
        "removed": sorted(old - new) if old else [],
        "stocks": stocks,
    }
    if prev.get("stocks") == stocks and prev.get("sources") == sources:
        print("바뀐 것 없음")
        return
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"합집합 {len(stocks)}종목 (추가 {len(out['added'])}, 제외 {len(out['removed'])})")
    if failed:
        print(f"::warning::지난 목록을 그대로 쓴 지수: {', '.join(failed)}")


if __name__ == "__main__":
    main()
