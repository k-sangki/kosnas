"""날짜별 시세로 섹터 강도·상대강도·시장 폭을 계산한다.

가격은 등락률(fltRt)을 이어 곱한 지수로 쓴다 — 액면분할·무상증자가 있어도 수익률이 끊기지 않는다.
"""

import re
import zlib

from taxonomy import INDUSTRIES, SECTORS, industry_of, sector_of

PERIODS = [5, 10, 20, 30, 60]
MIN_SECTOR = 4  # 종목이 이보다 적은 섹터는 보드에 올리지 않는다
MIN_INDUSTRY = 2  # 산업은 2종목부터
# 상대강도: 최근 3개월 40%, 6·9·12개월 각 20% (오닐식 가중)
RS_WEIGHTS = [(63, 0.4), (126, 0.2), (189, 0.2), (252, 0.2)]
# 기본 필터 — 화면에 보이는 종목만 거른다(계산에는 모든 보통주). neoScreen 기본 필터에서 실적 조건을 뺀 것
BASE_PRICE = 3000  # 종가 3,000원 이상
BASE_CAP = 1500e8  # 시가총액 1,500억원 이상
BASE_VALUE = 10e8  # 최근 20거래일 최소 거래대금 10억원 초과
RS_LEADER = 80
SPARK = 120  # 종목 차트에 싣는 최근 거래일 수


def is_common(code: str, name: str) -> bool:
    """보통주만: 우선주(끝자리 0 아님)·스팩·리츠·인프라펀드 등은 뺀다."""
    if not re.fullmatch(r"\d{5}0", code):
        return False
    return not re.search(r"스팩|리츠|REIT|인프라|제\d+호|우$", name or "")


def build_series(days: dict[str, list[dict]]):
    """날짜 목록과 종목별 (지수, 시가총액, 종가, 거래대금) 열을 만든다. 빠진 날은 None."""
    dates = sorted(days)
    idx: dict[str, list] = {}
    cap: dict[str, list] = {}
    close: dict[str, list] = {}
    val: dict[str, list] = {}
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
                val[c] = [None] * len(dates)
            prev = last.get(c)
            chg = r["chg"] or 0.0
            idx[c][i] = last[c] = 100.0 if prev is None else prev * (1 + chg / 100)
            cap[c][i] = r["cap"]
            close[c][i] = r["close"]
            val[c][i] = r.get("value")
            meta[c] = {"name": r["name"], "market": r["market"]}
    return dates, idx, cap, close, val, meta


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


def compute(days: dict[str, list[dict]], industry: dict[str, str | None]) -> tuple[dict, dict]:
    """(섹터 자료, 종목 검색 자료)를 돌려준다."""
    dates, idx, cap, close, val, meta = build_series(days)
    end = len(dates) - 1
    live = [c for c in idx if idx[c][end] is not None]
    rs = rs_scores(idx, end)
    names = {sid: name for sid, name, _ in SECTORS}

    sec_of = {c: sector_of(c, industry.get(c), meta[c]["name"]) for c in live}
    ind_of = {c: industry_of(c, industry.get(c), sec_of[c]) for c in live}

    def above50(c):
        s = [v for v in idx[c][max(0, end - 49) : end + 1] if v is not None]
        return len(s) >= 40 and idx[c][end] > sum(s) / len(s)

    def from_high(c):
        s = [v for v in idx[c][max(0, end - 251) : end + 1] if v is not None]
        return None if len(s) < 120 else round((idx[c][end] / max(s) - 1) * 100, 1)

    def new_high(c):
        return from_high(c) == 0

    def base_ok(c):
        vs = [v for v in val[c][max(0, end - 19) : end + 1] if v is not None]
        return (
            (close[c][end] or 0) >= BASE_PRICE
            and (cap[c][end] or 0) >= BASE_CAP
            and len(vs) >= 15
            and min(vs) > BASE_VALUE
        )

    pct = lambda v: None if v is None else round(v * 100, 2)  # noqa: E731
    ok = {c: base_ok(c) for c in live}
    a50 = {c: above50(c) for c in live}
    fh = {c: from_high(c) for c in live}

    # ---- 섹터와 산업: 같은 계산을 두 단계로 ----
    sec_groups: dict[str, list[str]] = {}
    for c in live:
        sec_groups.setdefault(sec_of[c], []).append(c)
    sec_groups = {sid: sec_groups[sid] for sid, _, _ in SECTORS if sid != "etc" and len(sec_groups.get(sid, [])) >= MIN_SECTOR}

    ind_groups: dict[str, list[str]] = {}
    ind_meta: dict[str, dict] = {}
    for sid, codes in sec_groups.items():
        sub: dict[str, list[str]] = {}
        for c in codes:
            sub.setdefault(ind_of[c], []).append(c)
        sub = {k: v for k, v in sub.items() if len(v) >= MIN_INDUSTRY}
        order = [n for n, _ in INDUSTRIES.get(sid, [])]
        for name, cs in sub.items():
            iid = f"{sid}-{order.index(name)}" if name in order else f"{sid}-etc" if name == "기타" else f"{sid}-o{zlib.crc32(name.encode()) % 1000}"
            # 산업이 하나뿐이면 섹터 이름, '기타'는 섹터 이름을 붙여 보드에서 알아보게
            label = names[sid] if len(sub) == 1 else (f"{names[sid]} 기타" if name == "기타" else name)
            ind_groups[iid] = cs
            ind_meta[iid] = {"sector": sid, "name": label}

    def level(groups: dict[str, list[str]]):
        cache: dict[tuple[int, int], dict[str, float | None]] = {}

        def xs(e: int, n: int):
            """강도 = 묶음 수익률 − 묶음들의 단순 평균(%p). (기준일, 길이)마다 한 번만 센다."""
            if (e, n) not in cache:
                raw = {g: sector_return(cs, idx, cap, e, n) for g, cs in groups.items()}
                vals = [v for v in raw.values() if v is not None]
                mean = sum(vals) / len(vals) if vals else 0.0
                cache[(e, n)] = {g: None if v is None else (v - mean) * 100 for g, v in raw.items()}
            return cache[(e, n)]

        def daily(e: int):
            return {g: sector_return(cs, idx, cap, e, 1) for g, cs in groups.items()}

        daily_cache = {e: daily(e) for e in range(max(1, end - max(PERIODS) + 1), end + 1)}

        def value_sum(cs, a, b):
            return sum(v for c in cs for v in val[c][max(0, a) : b] if v)

        total_cap_now = sum(cap[c][end] or 0 for cs in groups.values() for c in cs)

        def cap_then(cs, p):
            """기간 처음의 시총을 주가 변화분만으로 되돌린다(신규 상장·증자 몫 제외)."""
            tot = 0.0
            for c in cs:
                now = cap[c][end] or 0
                r = ret(idx[c], end, p)
                tot += now / (1 + r) if r is not None and r > -1 else now
            return tot

        total_then = {p: sum(cap_then(cs, p) for cs in groups.values()) for p in PERIODS}
        total_val = {p: (value_sum([c for cs in groups.values() for c in cs], end - p + 1, end + 1),
                         value_sum([c for cs in groups.values() for c in cs], end - 2 * p + 1, end - p + 1)) for p in PERIODS}

        out = {}
        for g, cs in groups.items():
            x, y, q, path, half, capshare, dshare, hold = {}, {}, {}, {}, {}, {}, {}, {}
            for p in PERIODS:
                k = str(p)
                xc, xp = xs(end, p)[g], xs(end - p, p)[g]
                x[k] = None if xc is None else round(xc, 2)
                y[k] = None if xc is None or xp is None else round(xc - xp, 2)
                q[k] = None if y[k] is None else quadrant(xc, y[k])
                pts = []
                for e in range(end - p + 1, end + 1):
                    a, b = xs(e, p)[g], xs(e - p, p)[g]
                    if a is not None and b is not None:
                        pts.append([round(a, 2), round(a - b, 2)])
                path[k] = pts
                n2 = p // 2
                n1 = p - n2
                h1, h2 = xs(end - n2, n1)[g], xs(end, n2)[g]
                half[k] = None if h1 is None or h2 is None else [round(h1, 2), round(h2, 2)]
                now_share = 100 * sum(cap[c][end] or 0 for c in cs) / total_cap_now if total_cap_now else None
                then_share = 100 * cap_then(cs, p) / total_then[p] if total_then[p] else None
                capshare[k] = None if now_share is None or then_share is None else round(now_share - then_share, 2)
                tv_now, tv_prev = total_val[p]
                if tv_now and tv_prev:
                    dshare[k] = round(100 * (value_sum(cs, end - p + 1, end + 1) / tv_now - value_sum(cs, end - 2 * p + 1, end - p + 1) / tv_prev), 2)
                else:
                    dshare[k] = None
                diffs = []
                for e in range(end - p + 1, end + 1):
                    d = daily_cache.get(e)
                    if not d or d.get(g) is None:
                        continue
                    vs = [v for v in d.values() if v is not None]
                    m = sum(vs) / len(vs)
                    if m < 0:
                        diffs.append(d[g] - m)
                hold[k] = round(100 * sum(diffs) / len(diffs), 2) if len(diffs) >= 3 else None
            leader = max(cs, key=lambda c: cap[c][end] or 0)
            rss = sorted(rs[c] for c in cs if c in rs)
            out[g] = {
                "count": len(cs),
                "ret": {str(p): pct(sector_return(cs, idx, cap, end, p)) for p in PERIODS},
                "x": x,
                "y": y,
                "q": q,
                "path": path,
                "half": half,
                "capShare": round(100 * sum(cap[c][end] or 0 for c in cs) / total_cap_now, 2) if total_cap_now else None,
                "capShareChg": capshare,
                "dShare": dshare,
                "hold": hold,
                "above50": round(100 * sum(a50[c] for c in cs) / len(cs)),
                "newHighs": sum(new_high(c) for c in cs),
                "leader": {"code": leader, "name": meta[leader]["name"], "fromHigh": fh[leader], "shown": ok[leader]},
                "rsLeaders": sum(1 for c in cs if ok[c] and rs.get(c, 0) >= RS_LEADER),
                "rsLeadersAll": sum(1 for c in cs if rs.get(c, 0) >= RS_LEADER),
                "rsMedian": rss[len(rss) // 2] if rss else None,
            }
        return out

    sec_stats = level(sec_groups)
    ind_stats = level(ind_groups)

    def stock_row(c):
        chg = ret(idx[c], end, 1)
        return {
            "code": c,
            "name": meta[c]["name"],
            "market": meta[c]["market"],
            "tv": f"KRX:{c}",
            "rs": rs.get(c),
            "close": round(close[c][end]),
            "chg": None if chg is None else round(chg * 100, 2),
            "r": {str(p): pct(ret(idx[c], end, p)) for p in PERIODS},
            "above50": a50[c],
            "fromHigh": fh[c],
        }

    code_ind = {c: i for i, cs in ind_groups.items() for c in cs}
    out_sectors = []
    for sid, codes in sec_groups.items():
        intro = next(t for k, _, t in SECTORS if k == sid)
        listed = sorted([c for c in codes if ok[c] and c in rs], key=lambda c: -rs[c])
        out_sectors.append(
            {
                "id": sid,
                "name": names[sid],
                "intro": intro,
                **sec_stats[sid],
                "industries": [i for i, m in ind_meta.items() if m["sector"] == sid],
                "hidden": len(codes) - len(listed),
                "stocks": [{**stock_row(c), "ind": ind_meta[code_ind[c]]["name"] if c in code_ind else None} for c in listed],
            }
        )
    out_industries = [{"id": i, **ind_meta[i], **ind_stats[i]} for i in ind_groups]

    # 시장 폭: 시장별 상승·하락 종목 수, 50일선 위 비율, 신고가 수
    breadth = {}
    for m in ("KOSPI", "KOSDAQ"):
        cs = [c for c in live if meta[c]["market"] == m]
        last = [ret(idx[c], end, 1) for c in cs]
        breadth[m] = {
            "count": len(cs),
            "up": sum(1 for v in last if v is not None and v > 0),
            "down": sum(1 for v in last if v is not None and v < 0),
            "above50": round(100 * sum(a50[c] for c in cs) / max(1, len(cs))),
            "newHighs": sum(new_high(c) for c in cs),
        }

    day = lambda d: f"{d[:4]}-{d[4:6]}-{d[6:]}"  # noqa: E731
    asof = day(dates[end])
    spark_from = day(dates[max(0, end - SPARK + 1)])
    sectors = {
        "market": "kr",
        "sample": False,
        "asof": asof,
        "periods": PERIODS,
        "source": "금융위원회 주식시세정보(공공데이터포털) · DART 기업개황 업종",
        "sparkFrom": spark_from,
        "breadth": breadth,
        "sectors": out_sectors,
        "industries": out_industries,
    }

    # 종목 검색 자료: 모든 보통주. 열 이름 + 줄(크기를 줄이려고)
    cols = ["code", "name", "market", "sector", "industry", "rs", "close", "chg", *[f"r{p}" for p in PERIODS], "fromHigh", "above50", "capEok", "base", "spark"]
    rows = []
    for c in sorted(live):
        last_close, last_idx = close[c][end], idx[c][end]
        spark = [None if v is None else round(last_close * v / last_idx) for v in idx[c][max(0, end - SPARK + 1) : end + 1]]
        chg = ret(idx[c], end, 1)
        sid = sec_of[c] if sec_of[c] in sec_groups else None
        rows.append(
            [
                c,
                meta[c]["name"],
                meta[c]["market"],
                sid,
                ind_meta[code_ind[c]]["name"] if c in code_ind else None,
                rs.get(c),
                round(last_close),
                None if chg is None else round(chg * 100, 2),
                *[pct(ret(idx[c], end, p)) for p in PERIODS],
                fh[c],
                a50[c],
                round((cap[c][end] or 0) / 1e8),
                ok[c],
                spark,
            ]
        )
    stocks = {"asof": asof, "sparkFrom": spark_from, "cols": cols, "rows": rows}
    return sectors, stocks
