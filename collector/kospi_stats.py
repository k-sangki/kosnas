"""코스피200 일봉으로 '극단값의 맥락' 과거 통계를 만든다.

원본 시세는 저장하지 않고, 화면에 쓰는 통계(큰 등락일 목록, 갭 출발한 날의 그날 흐름 요약)만 남긴다.
원천: 네이버 증권 차트 일봉(fchart siseJson, KPI200).

    python collector/kospi_stats.py --out src/data/kospi-stats.json
"""

from __future__ import annotations

import argparse
import ast
import json
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

URL = "https://fchart.stock.naver.com/siseJson.nhn?symbol={sym}&requestType=1&startTime={a}&endTime={b}&timeframe=day"
KST = timezone(timedelta(hours=9))
START = "20010101"
# 큰 등락일로 남길 문턱(%). 이보다 작은 날은 순위 대신 '흔한 하루'로 본다
BIG = 1.5
GAPS = [1, 2, 3, 5]


def fetch(sym: str, a: str, b: str) -> list[dict]:
    req = urllib.request.Request(URL.format(sym=sym, a=a, b=b), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode("utf-8", "replace")
    rows = ast.literal_eval(text.strip().replace("\n", ""))
    out = []
    for row in rows[1:]:
        try:
            d, o, h, l, c = str(row[0]).strip(), float(row[1]), float(row[2]), float(row[3]), float(row[4])
        except (ValueError, IndexError, TypeError):
            continue
        if c > 0:
            out.append({"d": f"{d[:4]}-{d[4:6]}-{d[6:8]}", "o": o, "h": h, "l": l, "c": c})
    return out


def r2(x: float) -> float:
    return round(x, 2)


def build(rows: list[dict]) -> dict:
    rows = sorted(rows, key=lambda r: r["d"])
    days = []
    for p, r in zip(rows, rows[1:]):
        # 시가가 없거나 종가와 같은(예전 지수 자료) 날은 갭 통계에서 뺀다
        has_open = r["o"] > 0 and not (r["o"] == r["h"] == r["l"] == r["c"])
        days.append(
            {
                "d": r["d"],
                "chg": (r["c"] / p["c"] - 1) * 100,
                "gap": (r["o"] / p["c"] - 1) * 100 if has_open else None,
                "oc": (r["c"] / r["o"] - 1) * 100 if has_open else None,
            }
        )
    ups = sorted(([x["d"], r2(x["chg"])] for x in days if x["chg"] >= BIG), key=lambda v: -v[1])
    downs = sorted(([x["d"], r2(x["chg"])] for x in days if x["chg"] <= -BIG), key=lambda v: v[1])

    def gap_stat(k: float):
        sel = [x for x in days if x["gap"] is not None and (x["gap"] >= k if k > 0 else x["gap"] <= k)]
        if not sel:
            return {"k": k, "n": 0}
        n = len(sel)
        return {
            "k": k,
            "n": n,
            # 그날 종가가 시가보다 높았던 비율(%)·시가 대비 종가 평균·전날 종가 대비 종가 평균
            "upFromOpen": r2(sum(1 for x in sel if x["oc"] > 0) / n * 100),
            "ocAvg": r2(sum(x["oc"] for x in sel) / n),
            "chgAvg": r2(sum(x["chg"] for x in sel) / n),
            "closeAbovePrev": r2(sum(1 for x in sel if x["chg"] > 0) / n * 100),
            "last": sel[-1]["d"],
        }

    with_open = [x for x in days if x["gap"] is not None]
    return {
        "updated": datetime.now(KST).strftime("%Y-%m-%d"),
        "index": "코스피200",
        "since": days[0]["d"] if days else None,
        "last": days[-1]["d"] if days else None,
        "days": len(days),
        "gapSince": with_open[0]["d"] if with_open else None,
        "big": BIG,
        "ups": ups,
        "downs": downs,
        "gaps": [gap_stat(k) for k in GAPS] + [gap_stat(-k) for k in GAPS],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--sym", default="KPI200")
    a = ap.parse_args()
    today = datetime.now(KST).strftime("%Y%m%d")
    rows = fetch(a.sym, START, today)
    # 장이 끝나기 전에 돌면 오늘 행은 아직 확정이 아니다
    now = datetime.now(KST)
    if now.hour * 60 + now.minute < 15 * 60 + 40:
        rows = [r for r in rows if r["d"] != now.strftime("%Y-%m-%d")]
    if len(rows) < 3000:
        sys.exit(f"일봉이 너무 적다: {len(rows)}")
    s = build(rows)
    print(json.dumps({k: v for k, v in s.items() if k not in ("ups", "downs")}, ensure_ascii=False, indent=1))
    print("ups", len(s["ups"]), s["ups"][:5], "downs", len(s["downs"]), s["downs"][:5])
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")


if __name__ == "__main__":
    main()
