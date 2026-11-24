"""국장·미장 공포·탐욕 지수 추정(전체·반도체)을 일봉으로 계산한다.

CNN 공포·탐욕 지수의 생각(모멘텀·52주 위치·변동성·안전자산 대비)을 빌려 KosNas가 직접 계산한 추정치다.
CNN 값을 가져오지 않는다. 다섯 항목을 0~100으로 바꿔 평균한다(높을수록 탐욕).

  1. 모멘텀: 종가의 125일 이동평균 대비 괴리 — 지난 1년(252거래일) 안 백분위
  2. 52주 위치: (종가 − 52주 저가) ÷ (52주 고가 − 52주 저가)
  3. RSI 14일(와일더)
  4. 변동성: 미장 전체는 VIX, 나머지는 20일 실현 변동성 — 지난 1년 안 백분위를 뒤집음(낮을수록 탐욕)
  5. 안전자산 대비: 20일 수익률 − 국채 ETF 20일 수익률 — 지난 1년 안 백분위

원천: 국장은 네이버 증권 차트 일봉(코스피200 KPI200, TIGER 반도체TOP10 396500, KOSEF 국고채10년 148070),
미장은 야후 파이낸스 차트(S&P 500 ^GSPC, VIX ^VIX, iShares 반도체 SOXX, 미국 국채 7~10년 IEF).
원본 시세는 저장하지 않고 점수만 남긴다.

    python collector/fear_greed.py --out src/data/fear-greed.json
"""

from __future__ import annotations

import argparse
import ast
import json
import math
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
NAVER = "https://fchart.stock.naver.com/siseJson.nhn?symbol={sym}&requestType=1&startTime={a}&endTime={b}&timeframe=day"
YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=3y&interval=1d"
UA = {"User-Agent": "Mozilla/5.0"}
YEAR = 252


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def naver(sym: str) -> dict[str, float]:
    """날짜 → 종가"""
    b = datetime.now(KST)
    a = b - timedelta(days=365 * 3)
    rows = ast.literal_eval(_get(NAVER.format(sym=sym, a=a.strftime("%Y%m%d"), b=b.strftime("%Y%m%d"))).strip().replace("\n", ""))
    out = {}
    for row in rows[1:]:
        try:
            d, c = str(row[0]).strip(), float(row[4])
        except (ValueError, IndexError, TypeError):
            continue
        if c > 0:
            out[f"{d[:4]}-{d[4:6]}-{d[6:8]}"] = c
    return out


def yahoo(sym: str) -> dict[str, float]:
    j = json.loads(_get(YAHOO.format(sym=urllib.request.quote(sym))))
    r = j["chart"]["result"][0]
    tz = timezone(timedelta(seconds=r["meta"].get("gmtoffset", 0)))
    out = {}
    for t, c in zip(r["timestamp"], r["indicators"]["quote"][0]["close"]):
        if c:
            out[datetime.fromtimestamp(t, tz).strftime("%Y-%m-%d")] = float(c)
    return out


def pct_rank(window: list[float], v: float) -> float:
    """window 안에서 v의 백분위(0~100)"""
    if len(window) < 2:
        return 50.0
    below = sum(1 for x in window if x < v)
    same = sum(1 for x in window if x == v)
    return (below + (same - 1) / 2) / (len(window) - 1) * 100


def rsi(c: list[float], n: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(c)
    if len(c) <= n:
        return out
    g = [max(c[i] - c[i - 1], 0) for i in range(1, len(c))]
    l = [max(c[i - 1] - c[i], 0) for i in range(1, len(c))]
    ag, al = sum(g[:n]) / n, sum(l[:n]) / n
    for i in range(n, len(c)):
        if i > n:
            ag = (ag * (n - 1) + g[i - 1]) / n
            al = (al * (n - 1) + l[i - 1]) / n
        out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out


def series(price: dict[str, float], bond: dict[str, float], vol: dict[str, float] | None) -> list[dict]:
    """날짜별 점수와 항목. 채권·VIX는 그 날짜까지의 마지막 값을 쓴다"""
    days = sorted(price)
    c = [price[d] for d in days]
    bd = sorted(bond)

    def asof(src: dict[str, float], keys: list[str], d: str) -> float | None:
        lo, hi = 0, len(keys)
        while lo < hi:
            m = (lo + hi) // 2
            if keys[m] <= d:
                lo = m + 1
            else:
                hi = m
        return src[keys[lo - 1]] if lo else None

    b = [asof(bond, bd, d) for d in days]
    vk = sorted(vol) if vol else []
    mom = [None] * len(c)
    rv = [None] * len(c)
    safe = [None] * len(c)
    for i in range(len(c)):
        if i >= 124:
            mom[i] = c[i] / (sum(c[i - 124 : i + 1]) / 125) - 1
        if vol:
            rv[i] = asof(vol, vk, days[i])
        elif i >= 20:
            r = [math.log(c[k] / c[k - 1]) for k in range(i - 19, i + 1)]
            m = sum(r) / 20
            rv[i] = math.sqrt(sum((x - m) ** 2 for x in r) / 19) * math.sqrt(YEAR)
        if i >= 20 and b[i] and b[i - 20]:
            safe[i] = (c[i] / c[i - 20] - 1) - (b[i] / b[i - 20] - 1)
    rs = rsi(c)
    out = []
    for i in range(len(c)):
        if i < YEAR + 125:
            continue

        def rank(arr: list, invert: bool = False) -> float | None:
            win = [x for x in arr[i - YEAR + 1 : i + 1] if x is not None]
            if arr[i] is None or len(win) < YEAR // 2:
                return None
            p = pct_rank(win, arr[i])
            return 100 - p if invert else p

        hi, lo = max(c[i - YEAR + 1 : i + 1]), min(c[i - YEAR + 1 : i + 1])
        parts = {
            "momentum": rank(mom),
            "high52": (c[i] - lo) / (hi - lo) * 100 if hi > lo else 50.0,
            "rsi": rs[i],
            "volatility": rank(rv, invert=True),
            "safe": rank(safe),
        }
        vals = [v for v in parts.values() if v is not None]
        if len(vals) < 4:
            continue
        out.append({"d": days[i], "score": round(sum(vals) / len(vals)), "parts": {k: (round(v) if v is not None else None) for k, v in parts.items()}})
    return out


def summary(s: list[dict]) -> dict:
    last = s[-1]
    return {
        "date": last["d"],
        "score": last["score"],
        "prev": s[-2]["score"],
        "week": s[-6]["score"],
        "month": s[-22]["score"],
        "parts": last["parts"],
        # 최근 60거래일 점수(작은 추이용)
        "hist": [x["score"] for x in s[-60:]],
    }


def build() -> dict:
    kr_bond = naver("148070")
    us_bond = yahoo("IEF")
    return {
        "updated": datetime.now(KST).isoformat(timespec="minutes"),
        "kr": {
            "all": summary(series(naver("KPI200"), kr_bond, None)),
            "semi": summary(series(naver("396500"), kr_bond, None)),
        },
        "us": {
            "all": summary(series(yahoo("^GSPC"), us_bond, yahoo("^VIX"))),
            "semi": summary(series(yahoo("SOXX"), us_bond, None)),
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    data = build()
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    for m in ("kr", "us"):
        for k in ("all", "semi"):
            x = data[m][k]
            print(m, k, x["date"], x["score"], "전일", x["prev"], "1주 전", x["week"], x["parts"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
