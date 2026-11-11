"""경제지표 예상치·결과(/econ): 나스닥 경제지표 달력·실적 달력과 연준 점도표를 모은다.

- 지표: api.nasdaq.com/api/calendar/economicevents?date=D 에서 src/data/econ-names.json 에 적은 지표만 남긴다.
  이 달력은 date=D 로 물으면 D 하루 전(미국 동부) 발표가 나오고, 시각은 UTC-5 고정이다(2026-11-11 확인:
  date=2026-11-11 에 11/10 08:30 CPI, date=2026-11-27 에 추수감사절). 날짜 계산은 화면(src/lib/econ.ts)이 한다.
- 실적: api.nasdaq.com/api/calendar/earnings?date=D (이 달력은 date가 발표일 그대로). 시총 2,000억 달러 이상이거나
  한국 투자자가 많이 보는 종목(schedule.KO_NAMES)만. 지난 날짜에는 실제 EPS·서프라이즈가 붙는다.
- 점도표: 연준 FOMC 일정 페이지에서 가장 최근 경제전망(SEP) 표 주소를 찾아 Figure 2(위원별 연말 금리 전망) 표를 읽는다.

결과는 src/data/econ.json. 하나가 막혀도 나머지는 낸다(막힌 부분은 직전 파일 값을 그대로 둔다).
"""

import argparse
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from schedule import BIG_CAP, KO_NAMES, NASDAQ_HEADERS, num, short_name  # noqa: E402

KST = dt.timezone(dt.timedelta(hours=9))
ET = dt.timezone(dt.timedelta(hours=-5))
NAMES = json.loads((Path(__file__).parent.parent / "src/data/econ-names.json").read_text(encoding="utf-8"))
FED = "https://www.federalreserve.gov"


def get(url: str, headers: dict | None = None) -> bytes:
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "Mozilla/5.0 (kosnas.com collector)"})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception as e:
            if i == 2:
                raise
            print(f"  다시 시도 ({e})")
            time.sleep(5 * (i + 1))
    return b""


def wanted(country: str, name: str) -> bool:
    n = name.strip().lower()
    for m in NAMES["metrics"]:
        if m["country"] != country:
            continue
        if "name" in m and m["name"].lower() == n:
            return True
        if "re" in m and re.search(m["re"], name.strip(), re.I):
            return True
    return False


def clean(v) -> str:
    s = html.unescape(str(v or "")).replace("\xa0", " ").strip()
    return s


def econ_rows(start: dt.date, days: int) -> list[dict]:
    out = []
    for k in range(days):
        d = start + dt.timedelta(days=k)
        body = json.loads(get(f"https://api.nasdaq.com/api/calendar/economicevents?date={d.isoformat()}", NASDAQ_HEADERS))
        for r in (body.get("data") or {}).get("rows") or []:
            c, n = clean(r.get("country")), clean(r.get("eventName"))
            t = clean(r.get("gmt"))
            if not re.fullmatch(r"\d\d:\d\d", t) or not wanted(c, n):
                continue
            out.append({"d": d.isoformat(), "t": t, "c": c, "n": n, "a": clean(r.get("actual")), "f": clean(r.get("consensus")), "p": clean(r.get("previous"))})
        time.sleep(0.4)
    print(f"경제지표 {len(out)}줄")
    return out


def money(v) -> float | None:
    s = clean(v).replace("$", "").replace(",", "")
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except ValueError:
        return None


def earnings(start: dt.date, days: int) -> list[dict]:
    out = []
    for k in range(days):
        d = start + dt.timedelta(days=k)
        if d.weekday() >= 5:
            continue
        body = json.loads(get(f"https://api.nasdaq.com/api/calendar/earnings?date={d.isoformat()}", NASDAQ_HEADERS))
        for r in (body.get("data") or {}).get("rows") or []:
            sym = (r.get("symbol") or "").strip()
            cap = num(str(r.get("marketCap") or "").replace("$", "")) or 0
            if sym not in KO_NAMES and cap < BIG_CAP:
                continue
            t = r.get("time") or ""
            out.append(
                {
                    "symbol": sym,
                    "name": KO_NAMES.get(sym) or short_name(r.get("name") or sym),
                    "date": d.isoformat(),
                    "when": "pre" if "pre-market" in t else "after" if "after-hours" in t else "",
                    "capB": round(cap / 1e9) if cap else None,
                    "quarter": clean(r.get("fiscalQuarterEnding")),
                    "f": money(r.get("epsForecast")),
                    "n": int(r["noOfEsts"]) if str(r.get("noOfEsts") or "").isdigit() else None,
                    "a": money(r.get("eps")),
                    "s": money(r.get("surprise")),
                    "ly": money(r.get("lastYearEPS")),
                }
            )
        time.sleep(0.4)
    print(f"실적 {len(out)}건")
    return out


def cells(row: str) -> list[str]:
    return [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, re.S)]


def dots() -> dict | None:
    cal = get(f"{FED}/monetarypolicy/fomccalendars.htm").decode("utf-8", "replace")
    pages = sorted(set(re.findall(r"fomcprojtabl(\d{8})\.htm", cal)))
    if not pages:
        return None
    day = pages[-1]
    url = f"{FED}/monetarypolicy/fomcprojtabl{day}.htm"
    page = get(url).decode("utf-8", "replace")
    i = page.find("Figure 2.")
    j = page.find("</table>", i)
    if i < 0 or j < 0:
        return None
    rows = [cells(r) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", page[i:j], re.S)]
    years: list[str] = []
    out = []
    for c in rows:
        if not c:
            continue
        ys = [x for x in c if re.fullmatch(r"20\d\d|Longer run", x, re.I)]
        if len(ys) >= 2 and not years:
            years = ys
            continue
        try:
            rate = float(c[0])
        except ValueError:
            continue
        counts = [int(x) if x.isdigit() else 0 for x in c[1:]]
        if years and len(counts) >= len(years):
            out.append({"rate": rate, "n": counts[: len(years)]})
    if not years or not out:
        print(f"::warning::점도표 표를 읽지 못함 {url}")
        return None
    print(f"점도표 {day}: {years} {len(out)}줄")
    return {"date": f"{day[:4]}-{day[4:6]}-{day[6:]}", "url": url, "years": ["장기" if y.lower() == "longer run" else y for y in years], "rows": out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="src/data/econ.json")
    args = ap.parse_args()
    path = Path(args.out)
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    today = dt.datetime.now(ET).date()
    data = {"updated": dt.datetime.now(KST).isoformat(timespec="minutes")}
    for key, fn in (
        ("rows", lambda: econ_rows(today - dt.timedelta(days=13), 13 + 29)),
        ("earnings", lambda: earnings(today - dt.timedelta(days=10), 10 + 15)),
        ("dots", dots),
    ):
        try:
            v = fn()
            data[key] = v if v is not None else old.get(key)
        except Exception as e:
            print(f"::warning::{key} 실패: {e}")
            data[key] = old.get(key)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"→ {path}")


if __name__ == "__main__":
    main()
