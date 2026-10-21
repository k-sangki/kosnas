"""날짜별 시세로 섹터 강도·상대강도·시장 폭을 계산한다.

가격은 등락률(fltRt)을 이어 곱한 지수로 쓴다 — 액면분할·무상증자가 있어도 수익률이 끊기지 않는다.
"""

import re

from taxonomy import SECTORS, sector_of

PERIODS = [5, 10, 20, 30, 60]
MIN_SECTOR = 4  # 종목이 이보다 적은 섹터는 보드에 올리지 않는다
SHOW_STOCKS = 30  # 섹터 페이지에 싣는 종목 수 (상대강도 순)
# 상대강도: 최근 3개월 40%, 6·9·12개월 각 20% (오닐식 가중)
RS_WEIGHTS = [(63, 0.4), (126, 0.2), (189, 0.2), (252, 0.2)]
# 섹터 종목 목록에 올리는 최소 크기 (작은 종목은 계산에는 넣고 목록에서는 뺀다)
MIN_CAP = 1000e8
MIN_PRICE = 1000
SPARK = 120  # 종목 차트에 싣는 최근 거래일 수


def is_common(code: str, name: str) -> bool:
    """보통주만: 우선주(끝자리 0 아님)·스팩·리츠·인프라펀드 등은 뺀다."""
    if not re.fullmatch(r"\d{5}0", code):
        return False
    return not re.search(r"스팩|리츠|REIT|인프라|제\d+호|우$", name or "")


def build_series(days: dict[str, list[dict]]):
    """날짜 목록과 종목별 (지수, 종가, 시가총액) 열을 만든다. 빠진 날은 None."""
    dates = sorted(days)
    idx: dict[str, list] = {}
    cap: dict[str, list] = {}
    close: dict[str, list] = {}
    meta: dict[str, dict] = {}
    last: dict[str, float] = {}
    for i, d in enumerate(dates):
        for r in days[d]:
            c = r["code"]
            if not is_common(c, r["name"]):
                continue
            if c not in idx:
                idx[c] = [None] * len(dates)
                cap[c] = [None] * len(dates)
                close[c] = [None] * len(dates)
            prev = last.get(c)
            chg = r["chg"] or 0.0
            idx[c][i] = last[c] = 100.0 if prev is None else prev * (1 + chg / 100)
            cap[c][i] = r["cap"]
            close[c][i] = r["close"]
            meta[c] = {"name": r["name"], "market": r["market"]}
    return dates, idx, cap, close, meta


def _at(series: list, i: int):
    return series[i] if 0 <= i < len(series) else None


def ret(series: list, end: int, n: int):
    a, b = _at(series, end - n), _at(series, end)
    if a is None or b is None or a <= 0:
        return None
    return b / a - 1


def rs_scores(idx: dict[str, list], end: int) -> dict[str, int]:
    raw = {}
    for c, s in idx.items():
        if s[end] is None:
            continue
        if ret(s, end, RS_WEIGHTS[0][0]) is None:
            continue  # 3개월 자료가 없는 새 상장 종목은 순위에서 뺀다
        parts = [(w, ret(s, end, n)) for n, w in RS_WEIGHTS]
        parts = [(w, r) for w, r in parts if r is not None]
        wsum = sum(w for w, _ in parts)
        raw[c] = sum(w * r for w, r in parts) / wsum
    order = sorted(raw, key=raw.get)
    n = len(order)
    return {c: max(1, min(99, round(1 + 98 * i / max(1, n - 1)))) for i, c in enumerate(order)}


def sector_return(codes: list[str], idx, cap, end: int, n: int):
    """시가총액(시작일) 가중 수익률."""
    num = den = 0.0
    for c in codes:
        r = ret(idx[c], end, n)
        w = _at(cap[c], end - n)
        if r is None or not w:
            continue
        num += w * r
        den += w
    return num / den if den else None


def quadrant(x: float, y: float) -> str:
    if x >= 0:
        return "lead" if y >= 0 else "weaken"
    return "watch" if y >= 0 else "lag"


def compute(days: dict[str, list[dict]], industry: dict[str, str | None]) -> dict:
    dates, idx, cap, close, meta = build_series(days)
    end = len(dates) - 1
    live = [c for c in idx if idx[c][end] is not None]

    groups: dict[str, list[str]] = {}
    for c in live:
        groups.setdefault(sector_of(c, industry.get(c), meta[c]["name"]), []).append(c)

    rs = rs_scores(idx, end)

    def above50(c):
        s = [v for v in idx[c][max(0, end - 49) : end + 1] if v is not None]
        return len(s) >= 40 and idx[c][end] > sum(s) / len(s)

    def new_high(c):
        s = [v for v in idx[c][max(0, end - 251) : end + 1] if v is not None]
        return len(s) >= 120 and idx[c][end] >= max(s)

    def stock_row(c):
        """종목 줄: 마지막 종가·전일 대비와, 오늘 종가에 맞춘 수정 종가 열(분할이 있어도 이어진다)."""
        last_close, last_idx = close[c][end], idx[c][end]
        spark = [None if v is None else round(last_close * v / last_idx) for v in idx[c][max(0, end - SPARK + 1) : end + 1]]
        chg = ret(idx[c], end, 1)
        return {
            "code": c,
            "name": meta[c]["name"],
            "market": meta[c]["market"],
            "tv": f"KRX:{c}",
            "rs": rs[c],
            "close": round(last_close),
            "chg": None if chg is None else round(chg * 100, 2),
            "spark": spark,
        }

    # 섹터 수익률: 이번 기간과 바로 앞 같은 길이 기간
    rows = {}
    for sid, name, intro in SECTORS:
        codes = groups.get(sid, [])
        if sid == "etc" or len(codes) < MIN_SECTOR:
            continue
        rows[sid] = {
            "id": sid,
            "name": name,
            "intro": intro,
            "count": len(codes),
            "cur": {p: sector_return(codes, idx, cap, end, p) for p in PERIODS},
            "prev": {p: sector_return(codes, idx, cap, end - p, p) for p in PERIODS},
            "codes": codes,
        }

    # 강도 x = 섹터 수익률 − 섹터 평균(%p). (기준일, 기간)마다 한 번만 센다
    xs_cache: dict[tuple[int, int], dict[str, float | None]] = {}

    def xs(e: int, p: int):
        if (e, p) not in xs_cache:
            raw = {sid: sector_return(r["codes"], idx, cap, e, p) for sid, r in rows.items()}
            vals = [v for v in raw.values() if v is not None]
            mean = sum(vals) / len(vals) if vals else 0.0
            xs_cache[(e, p)] = {sid: None if v is None else (v - mean) * 100 for sid, v in raw.items()}
        return xs_cache[(e, p)]

    for r in rows.values():
        r["x_cur"] = {p: xs(end, p)[r["id"]] for p in PERIODS}
        r["x_prev"] = {p: xs(end - p, p)[r["id"]] for p in PERIODS}

    def path(sid: str, p: int):
        """기간 p 동안 매일의 (강도, 변화) — 점을 누르면 그리는 이동선. 자료가 모자란 날은 뺀다."""
        pts = []
        for e in range(end - p + 1, end + 1):
            xc, xp = xs(e, p)[sid], xs(e - p, p)[sid]
            if xc is not None and xp is not None:
                pts.append([round(xc, 2), round(xc - xp, 2)])
        return pts

    out_sectors = []
    pct = lambda v: None if v is None else round(v * 100, 2)  # noqa: E731
    for r in rows.values():
        codes = r["codes"]
        listed = [c for c in codes if (_at(cap[c], end) or 0) >= MIN_CAP and (_at(close[c], end) or 0) >= MIN_PRICE and c in rs]
        listed.sort(key=lambda c: -rs[c])
        x = {str(p): round(r["x_cur"][p], 2) if r["x_cur"][p] is not None else None for p in PERIODS}
        y = {}
        q = {}
        for p in PERIODS:
            xc, xp = r["x_cur"][p], r["x_prev"][p]
            y[str(p)] = None if xc is None or xp is None else round(xc - xp, 2)
            q[str(p)] = None if y[str(p)] is None else quadrant(xc, y[str(p)])
        out_sectors.append(
            {
                "id": r["id"],
                "name": r["name"],
                "intro": r["intro"],
                "count": r["count"],
                "ret": {str(p): pct(r["cur"][p]) for p in PERIODS},
                "x": x,
                "y": y,
                "q": q,
                "path": {str(p): path(r["id"], p) for p in PERIODS},
                "above50": round(100 * sum(above50(c) for c in codes) / len(codes)),
                "newHighs": sum(new_high(c) for c in codes),
                "stocks": [stock_row(c) for c in listed[:SHOW_STOCKS]],
            }
        )

    # 시장 폭: 시장별 상승·하락 종목 수, 50일선 위 비율, 신고가 수
    breadth = {}
    for m in ("KOSPI", "KOSDAQ"):
        cs = [c for c in live if meta[c]["market"] == m]
        last = [ret(idx[c], end, 1) for c in cs]
        breadth[m] = {
            "count": len(cs),
            "up": sum(1 for v in last if v is not None and v > 0),
            "down": sum(1 for v in last if v is not None and v < 0),
            "above50": round(100 * sum(above50(c) for c in cs) / max(1, len(cs))),
            "newHighs": sum(new_high(c) for c in cs),
        }

    asof = dates[end]
    return {
        "market": "kr",
        "sample": False,
        "asof": f"{asof[:4]}-{asof[4:6]}-{asof[6:]}",
        "periods": PERIODS,
        "source": "금융위원회 주식시세정보(공공데이터포털) · DART 기업개황 업종",
        "sparkFrom": f"{dates[max(0, end - SPARK + 1)][:4]}-{dates[max(0, end - SPARK + 1)][4:6]}-{dates[max(0, end - SPARK + 1)][6:]}",
        "breadth": breadth,
        "sectors": out_sectors,
    }
