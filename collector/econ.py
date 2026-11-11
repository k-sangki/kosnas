"""경제지표 예상치·결과(/econ): 나스닥 경제지표 달력·실적 달력과 연준 점도표를 모은다.

- 지표: api.nasdaq.com/api/calendar/economicevents?date=D 에서 src/data/econ-names.json 에 적은 지표만 남긴다.
  이 달력은 date=D 로 물으면 D 하루 전(미국 동부) 발표가 나오고, 시각은 UTC-5 고정이다(2026-11-11 확인:
  date=2026-11-11 에 11/10 08:30 CPI, date=2026-11-27 에 추수감사절). 날짜 계산은 화면(src/lib/econ.ts)이 한다.
- 실적: api.nasdaq.com/api/calendar/earnings?date=D (이 달력은 date가 발표일 그대로). 시총 2,000억 달러 이상이거나
  한국 투자자가 많이 보는 종목(schedule.KO_NAMES)·주목 기업(econ-names.json earnFocus)만. 지난 날짜에는 실제 EPS·서프라이즈가 붙는다.
- 점도표: 연준 FOMC 일정 페이지에서 가장 최근 경제전망(SEP) 표 주소를 찾아 Figure 2(위원별 연말 금리 전망) 표를 읽는다.

결과는 src/data/econ.json. 하나가 막혀도 나머지는 낸다(막힌 부분은 직전 파일 값을 그대로 둔다).
"""

import argparse
import datetime as dt
import html
import json
import re
import subprocess
import tempfile
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
FOCUS = set(NAMES.get("earnFocus", []))


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


def nasdaq(url: str) -> dict:
    """나스닥은 파이썬 urllib 요청을 403으로 막는다(2026-11-11, 같은 머리글의 curl은 됨). curl로 받는다"""
    args = ["curl", "-sS", "--compressed", "-m", "30", "--retry", "2", "-f"]
    for k, v in NASDAQ_HEADERS.items():
        args += ["-H", f"{k}: {v}"]
    out = subprocess.run([*args, url], capture_output=True, check=True).stdout
    return json.loads(out)


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
        body = nasdaq(f"https://api.nasdaq.com/api/calendar/economicevents?date={d.isoformat()}")
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
        body = nasdaq(f"https://api.nasdaq.com/api/calendar/earnings?date={d.isoformat()}")
        for r in (body.get("data") or {}).get("rows") or []:
            sym = (r.get("symbol") or "").strip()
            cap = num(str(r.get("marketCap") or "").replace("$", "")) or 0
            if sym not in KO_NAMES and sym not in FOCUS and cap < BIG_CAP:
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
    try:
        yahoo_fill(out)
    except Exception as e:
        print(f"::warning::야후 실적 실패: {e}")
    return out


def yahoo_fill(out: list[dict]) -> None:
    """주목 기업의 실제 EPS·예상은 야후(발표 몇 분 뒤 반영, 회사 발표 GAAP EPS)를 먼저 쓴다.
    나스닥은 실제 EPS를 반나절 늦게 올리고, 코어위브 2026-11-10 은 1년 전 값(-0.31)을 실제로 올렸다
    (회사 발표 -1.27). 그래서 나스닥 값이 있어도 지난 2주 안 발표는 야후로 덮는다."""
    now = dt.datetime.now(ET).date()
    today, since = now.isoformat(), (now - dt.timedelta(days=14)).isoformat()
    want = [e for e in out if e["symbol"] in FOCUS and since <= e["date"] <= today]
    if not want:
        return
    jar = tempfile.NamedTemporaryFile(delete=False).name
    ua = NASDAQ_HEADERS["User-Agent"]
    base = ["curl", "-sS", "-m", "20", "-A", ua, "-b", jar, "-c", jar]
    subprocess.run(base + ["-o", "/dev/null", "https://fc.yahoo.com/"], check=False)
    crumb = subprocess.run(base + ["https://query2.finance.yahoo.com/v1/test/getcrumb"], capture_output=True, text=True).stdout.strip()
    if not crumb or len(crumb) > 40:
        print("::warning::야후 crumb 실패")
        return
    for e in want:
        r = subprocess.run(base + [f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{e['symbol']}?modules=earnings&crumb={crumb}"], capture_output=True, text=True)
        try:
            q = json.loads(r.stdout)["quoteSummary"]["result"][0]["earnings"]["earningsChart"]["quarterly"]
        except Exception:
            continue
        for x in q:
            d = (x.get("reportedDate") or {}).get("fmt")
            act = (x.get("actual") or {}).get("raw")
            if not d or act is None or abs((dt.date.fromisoformat(d) - dt.date.fromisoformat(e["date"])).days) > 1:
                continue
            est = (x.get("estimate") or {}).get("raw")
            if e["a"] is not None and abs(e["a"] - act) > 0.005:
                print(f"::warning::나스닥 실적 {e['symbol']} {e['a']} → 야후 {round(act, 2)}")
            e["a"] = round(act, 2)
            if e.get("ly") is not None and abs(e["ly"] - act) <= 0.005:
                e["ly"] = None
            if est is not None:
                e["f"] = round(est, 2)
            try:
                e["s"] = float(x.get("surprisePct"))
            except (TypeError, ValueError):
                pass
            e["src"] = "yahoo"
            fin = fin_quarter(json.loads(r.stdout), x.get("date"))
            e.update(fin)
            print(f"야후 실적 {e['symbol']} {e['date']} 실제 {e['a']} 예상 {e['f']} {fin}")
            break
        time.sleep(0.3)


def fin_quarter(body: dict, q: str | None) -> dict:
    """quoteSummary earnings.financialsChart 에서 그 분기('3Q2026') 실제 매출(ra)·순이익(na)"""
    try:
        rows = body["quoteSummary"]["result"][0]["earnings"]["financialsChart"]["quarterly"]
    except Exception:
        return {}
    for x in rows:
        if q and x.get("date") == q:
            out = {}
            rev = (x.get("revenue") or {}).get("raw")
            ni = (x.get("earnings") or {}).get("raw")
            if rev is not None:
                out["ra"] = rev
            if ni is not None:
                out["na"] = ni
            return out
    return {}


def yahoo_hist(base: list, crumb: str, sym: str) -> dict:
    """분기 매출·순이익(분기 끝 날짜 → 값). 1년 전 같은 분기와 비교하는 데만 쓴다(지난 결과 화면은 만들지 않는다)."""
    now = int(time.time())
    url = (
        f"https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{sym}"
        f"?type=quarterlyTotalRevenue,quarterlyNetIncome,quarterlyDilutedEPS&period1={now - 900 * 86400}&period2={now}&crumb={crumb}"
    )
    r = subprocess.run(base + [url], capture_output=True, text=True)
    out = {"rev": {}, "ni": {}, "eps": {}}
    try:
        res = json.loads(r.stdout)["timeseries"]["result"]
    except Exception:
        return out
    for k, key in (("quarterlyTotalRevenue", "rev"), ("quarterlyNetIncome", "ni"), ("quarterlyDilutedEPS", "eps")):
        for blk in res:
            for x in blk.get(k) or []:
                v = ((x or {}).get("reportedValue") or {}).get("raw")
                if v is not None and x.get("asOfDate"):
                    out[key][x["asOfDate"]] = v
    return out


def yahoo_profiles() -> dict:
    """주목 기업마다 다음 실적 발표일·예상 EPS와 가장 최근 분기 실제·예상 EPS(야후). 기업별 페이지(/econ/earnings/심볼)가 쓴다."""
    jar = tempfile.NamedTemporaryFile(delete=False).name
    ua = NASDAQ_HEADERS["User-Agent"]
    base = ["curl", "-sS", "-m", "20", "-A", ua, "-b", jar, "-c", jar]
    subprocess.run(base + ["-o", "/dev/null", "https://fc.yahoo.com/"], check=False)
    crumb = subprocess.run(base + ["https://query2.finance.yahoo.com/v1/test/getcrumb"], capture_output=True, text=True).stdout.strip()
    if not crumb or len(crumb) > 40:
        raise RuntimeError("야후 crumb 실패")
    out = {}
    for sym in sorted(FOCUS):
        url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{sym}?modules=earnings,calendarEvents&crumb={crumb}"
        r = subprocess.run(base + [url], capture_output=True, text=True)
        try:
            res = json.loads(r.stdout)["quoteSummary"]["result"][0]
        except Exception:
            print(f"  야후 {sym} 없음")
            continue
        chart = ((res.get("earnings") or {}).get("earningsChart") or {})
        quarters = []
        for x in chart.get("quarterly") or []:
            act = (x.get("actual") or {}).get("raw")
            est = (x.get("estimate") or {}).get("raw")
            try:
                sp = float(x.get("surprisePct"))
            except (TypeError, ValueError):
                sp = None
            quarters.append(
                {
                    "q": x.get("date") or "",
                    "date": (x.get("reportedDate") or {}).get("fmt") or "",
                    "a": round(act, 2) if act is not None else None,
                    "f": round(est, 2) if est is not None else None,
                    "s": sp,
                }
            )
        cal = ((res.get("calendarEvents") or {}).get("earnings") or {})
        dates = [d.get("fmt") for d in cal.get("earningsDate") or [] if d.get("fmt")]
        avg = (cal.get("earningsAverage") or {}).get("raw")
        nxt = None
        if dates:
            nxt = {
                "date": dates[0],
                "f": round(avg, 2) if avg is not None else None,
                "estimate": bool(cal.get("isEarningsDateEstimate")),
                "q": f"{chart.get('currentQuarterEstimateDate') or ''}{chart.get('currentQuarterEstimateYear') or ''}",
                "rf": (cal.get("revenueAverage") or {}).get("raw"),
            }
        done = [q for q in quarters if q["a"] is not None and q["date"]]
        last = max(done, key=lambda q: q["date"]) if done else None
        if last:
            last.update(fin_quarter({"quoteSummary": {"result": [res]}}, last["q"]))
        out[sym] = {"name": KO_NAMES.get(sym) or sym, "next": nxt, "last": last, "hist": yahoo_hist(base, crumb, sym)}
        time.sleep(0.3)
    print(f"야후 기업 {len(out)}곳")
    return out


def companies(path: Path, updated: str) -> dict:
    """주목 기업 다음 실적 발표일·예상 EPS와 가장 최근 분기 실적(야후). 기업별 페이지가 쓴다(지난 결과는 쌓지 않는다, 2026-11-11 SK)."""
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    try:
        prof = yahoo_profiles()
    except Exception as e:
        print(f"::warning::야후 기업 실패: {e}")
        prof = {}
    # 한 기업이 막히면 지난번 값을 그대로 둔다
    out = {"updated": updated, "profiles": {**(old.get("profiles") or {}), **prof}}
    # 예상 매출(야후 calendarEvents)은 발표 전에만 나온다 → 발표일별로 남겨 두고 발표 뒤에도 쓴다(45일 지나면 지움)
    today = dt.datetime.now(ET).date()
    est = {k: v for k, v in (old.get("est") or {}).items() if v.get("date", "") >= (today - dt.timedelta(days=45)).isoformat()}
    for sym, p in prof.items():
        n = p.get("next") or {}
        if n.get("date") and n["date"] >= today.isoformat() and n.get("rf") is not None:
            est[f"{sym}-{n['date']}"] = {"date": n["date"], "rf": n["rf"], "q": n.get("q")}
    out["est"] = est
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"→ {path} (기업 {len(out['profiles'])}곳, 예상 매출 {len(est)}건)")
    return out


MONTHS = {m: i for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(), 1)}


def attach_fin(earn: list[dict], comp: dict) -> None:
    """주목 기업 실적에 매출 예상(rf)·1년 전 매출(rly)·1년 전 순이익(nly)을 붙인다. 실제(ra·na)는 yahoo_fill 이 붙인다."""
    est = comp.get("est") or {}
    profs = comp.get("profiles") or {}
    for e in earn:
        if e["symbol"] not in FOCUS:
            continue
        d = dt.date.fromisoformat(e["date"])
        for k in (0, -1, 1):
            hit = est.get(f"{e['symbol']}-{(d + dt.timedelta(days=k)).isoformat()}")
            if hit:
                e["rf"] = hit["rf"]
                break
        m = re.match(r"([A-Za-z]{3})/(\d{4})", e.get("quarter") or "")
        hist = (profs.get(e["symbol"]) or {}).get("hist") or {}
        if not m or m.group(1) not in MONTHS:
            continue
        ym = f"{int(m.group(2)) - 1:04d}-{MONTHS[m.group(1)]:02d}"
        # 1년 전 EPS 도 회사 발표(희석 GAAP) 값으로 맞춘다 — 나스닥 lastYearEPS 는 코어위브에서 -0.31(회사 -0.22)이었다
        for key, out in (("rev", "rly"), ("ni", "nly"), ("eps", "ly")):
            v = next((v for k2, v in (hist.get(key) or {}).items() if k2.startswith(ym)), None)
            if v is not None:
                e[out] = round(v, 2) if key == "eps" else v


def group_of(country: str, name: str) -> str | None:
    n = name.strip().lower()
    for m in NAMES["metrics"]:
        if m["country"] == country and (("name" in m and m["name"].lower() == n) or ("re" in m and re.search(m["re"], name.strip(), re.I))):
            return m["group"]
    return None


def open_pages(data: dict, path: Path) -> None:
    """지표·기업별 페이지는 발표가 일주일 안으로 다가온 것부터 차례로 연다(2026-11-11 SK). 한 번 연 것은 지우지 않는다."""
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    econ, earn = dict(old.get("econ") or {}), dict(old.get("earn") or {})
    today = dt.datetime.now(ET).date()
    end = today + dt.timedelta(days=7)
    now = dt.datetime.now(KST).date().isoformat()
    pages = {k for k, g in NAMES["groups"].items() if g.get("band")}
    for r in data.get("rows") or []:
        # 이 달력은 날짜 하루 전(미국)에 발표된다
        us = dt.date.fromisoformat(r["d"]) - dt.timedelta(days=1)
        g = group_of(r["c"], r["n"])
        if g in pages and today <= us <= end and g not in econ:
            econ[g] = now
            print(f"페이지 열기 /econ/{g}")
    for e in data.get("earnings") or []:
        s = e["symbol"].lower()
        if e["symbol"] in FOCUS and today <= dt.date.fromisoformat(e["date"]) <= end and s not in earn:
            earn[s] = now
            print(f"페이지 열기 /econ/earnings/{s}")
    path.write_text(json.dumps({"econ": econ, "earn": earn}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


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
    ap.add_argument("--companies", default="src/data/econ-companies.json")
    ap.add_argument("--open", default="src/data/econ-open.json")
    args = ap.parse_args()
    path = Path(args.out)
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    today = dt.datetime.now(ET).date()
    data = {"updated": dt.datetime.now(KST).isoformat(timespec="minutes")}
    for key, fn in (
        ("rows", lambda: econ_rows(today - dt.timedelta(days=13), 13 + 46)),  # 지표 페이지에 다음 발표가 늘 보이게 6주 앞까지
        ("earnings", lambda: earnings(today - dt.timedelta(days=10), 10 + 15)),
        ("dots", dots),
    ):
        try:
            v = fn()
            data[key] = v if v is not None else old.get(key)
            if key == "earnings" and v:
                # 지난 날짜는 달력이 발표 시점(장 전·장 뒤)을 지운다 → 전에 받아 둔 값을 이어 쓴다
                was = {(e["symbol"], e["date"]): e.get("when") for e in old.get("earnings") or []}
                for e in v:
                    if not e["when"]:
                        e["when"] = was.get((e["symbol"], e["date"])) or ""
        except Exception as e:
            print(f"::warning::{key} 실패: {e}")
            data[key] = old.get(key)
    comp = companies(Path(args.companies), data["updated"])
    if data.get("earnings"):
        attach_fin(data["earnings"], comp)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"→ {path}")
    open_pages(data, Path(args.open))


if __name__ == "__main__":
    main()
