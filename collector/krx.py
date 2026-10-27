"""국내 섹터 자료를 갱신한다.

    python collector/krx.py --state state --out src/data/kr-sectors.json

state/days/YYYYMMDD.json.gz  날짜별 전 종목 시세 (금융위원회 주식시세정보)
state/industry.json          종목코드 → KSIC 업종 코드 (DART)
state/earnings/YYYY_코드.json 보고서별 매출액·영업이익·당기순이익 (DART 다중회사 주요계정)
필요한 값: DATA_GO_KR_KEY (공공데이터포털 인증키, 인코딩되지 않은 값), DART_API_KEY
"""

import argparse
import datetime as dt
import gzip
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from compute import compute  # noqa: E402
from fetch import dart_corp_codes, dart_ksic, dart_multi_accounts, fsc_range  # noqa: E402

KEEP_DAYS = 300  # 252일 신고가·12개월 상대강도 + 여유
BACKFILL_CAL_DAYS = 450
MIN_ROWS_RATIO = 0.95  # 새 날 종목 수가 직전 날의 이만큼은 돼야 다 올라온 것으로 본다
# 한 번 실행에서 받는 데 쓰는 시간. 넘으면 받은 데까지 저장하고 다음 실행이 이어 받는다
BUDGET_SEC = int(os.environ.get("COLLECT_BUDGET_SEC", 50 * 60))
START = time.monotonic()


def over_budget() -> bool:
    return time.monotonic() - START > BUDGET_SEC


def load_days(state: Path) -> dict[str, list[dict]]:
    out = {}
    for f in sorted((state / "days").glob("*.json.gz")):
        out[f.name[:8]] = json.loads(gzip.decompress(f.read_bytes()))
    return out


def save_day(state: Path, day: str, rows: list[dict]):
    d = state / "days"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{day}.json.gz").write_bytes(gzip.compress(json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))


def month_chunks(begin: dt.date, end: dt.date):
    cur = begin
    while cur <= end:
        stop = min(end, (cur.replace(day=1) + dt.timedelta(days=32)).replace(day=1) - dt.timedelta(days=1))
        yield cur, stop
        cur = stop + dt.timedelta(days=1)


def update_prices(state: Path, key: str, days: dict, today: dt.date):
    if days:
        begin = dt.datetime.strptime(max(days), "%Y%m%d").date() + dt.timedelta(days=1)
    else:
        begin = today - dt.timedelta(days=BACKFILL_CAL_DAYS)
    if begin > today:
        print("새 시세 없음")
        return True
    for a, b in month_chunks(begin, today):
        if over_budget():
            notice(f"시간이 다 돼 {a} 이후 시세는 다음 실행에서 받습니다")
            return False
        got = fsc_range(key, a.strftime("%Y%m%d"), b.strftime("%Y%m%d"))
        for day, rows in sorted(got.items()):
            # 13시 전후에는 일부 종목만 올라와 있을 수 있다. 한 번 저장한 날은 다시 받지 않으므로
            # 직전 날보다 종목 수가 크게 적으면 저장하지 않고 다음 실행에서 다시 받는다
            if days and len(rows) < MIN_ROWS_RATIO * len(days[max(days)]):
                notice(f"{day} 시세가 {len(rows)}종목뿐이라(직전 {len(days[max(days)])}) 다음 실행에서 다시 받습니다")
                return True
            days[day] = rows
            save_day(state, day, rows)
    # 오래된 날은 지운다
    for day in sorted(days)[:-KEEP_DAYS]:
        days.pop(day)
        (state / "days" / f"{day}.json.gz").unlink(missing_ok=True)
    return True


def refill_extra(state: Path, key: str, days: dict) -> bool:
    """예전에 받은 날 중 거래량·시가가 없는 날을 다시 받는다(최근 달부터). 다 채웠으면 True."""
    old = sorted((d for d, rows in days.items() if rows and "vol" not in rows[0]), reverse=True)
    if not old:
        return True
    notice(f"거래량·시가 없는 날 {len(old)}일을 다시 받습니다")
    months = sorted({d[:6] for d in old}, reverse=True)
    for m in months:
        if over_budget():
            notice(f"시간이 다 돼 {m} 이전 달은 다음 실행에서 다시 받습니다")
            return False
        a = dt.date(int(m[:4]), int(m[4:]), 1)
        got = fsc_range(key, a.strftime("%Y%m%d"), max(d for d in old if d.startswith(m)))
        for day, rows in got.items():
            if day in days and "vol" not in days[day][0] and len(rows) >= MIN_ROWS_RATIO * len(days[day]):
                days[day] = rows
                save_day(state, day, rows)
    return True


# 분기 보고서: (보고서 코드, 기간 끝 월, 이름). 사업보고서(11011)는 연간
REPORTS = [("11013", 3, "1Q"), ("11012", 6, "2Q"), ("11014", 9, "3Q"), ("11011", 12, "4Q")]
FINAL_AFTER_DAYS = 150  # 기간 끝에서 이만큼 지나면 늦은 제출까지 다 들어왔다고 보고 다시 받지 않는다


def recent_periods(today: dt.date, n: int = 5) -> list[tuple[int, str, str, dt.date]]:
    """기간이 끝난 보고서를 최근 것부터 n개: (사업연도, 보고서 코드, 이름, 기간 끝 날)."""
    out = []
    for y in range(today.year, today.year - 3, -1):
        for code, m, name in reversed(REPORTS):
            end = dt.date(y, m, 30 if m in (6, 9) else 31)
            if end < today:
                out.append((y, code, name, end))
    return out[:n]


def update_earnings(state: Path, key: str | None, codes: list[str], today: dt.date) -> dict[str, dict]:
    """최근 보고서들의 주요계정을 받아(하루 한 번, 끝난 기간은 한 번만) 종목코드 → 보고서 이름 → 값으로 돌려준다."""
    d = state / "earnings"
    d.mkdir(parents=True, exist_ok=True)
    corp = None
    out: dict[str, dict] = {}
    for y, code, name, end in recent_periods(today):
        path = d / f"{y}_{code}.json"
        saved = json.loads(path.read_text()) if path.exists() else None
        final = saved and saved.get("final")
        fresh = saved and saved.get("fetched") == today.isoformat()
        if key and not final and not fresh and not over_budget():
            if corp is None:
                corp = dart_corp_codes(key)
            ids = [corp[c] for c in codes if c in corp]
            data: dict[str, dict] = {}
            for i in range(0, len(ids), 100):
                data.update(dart_multi_accounts(key, ids[i : i + 100], y, code))
                time.sleep(0.3)
            saved = {"fetched": today.isoformat(), "final": (today - end).days > FINAL_AFTER_DAYS, "data": data}
            path.write_text(json.dumps(saved, ensure_ascii=False, separators=(",", ":")))
            print(f"DART 주요계정 {y} {name}: {len(data)}종목")
        if saved:
            for c, v in saved["data"].items():
                out.setdefault(c, {})[f"{y}.{name}"] = v
    return out


def update_industry(state: Path, key: str | None, codes: list[str]) -> dict | None:
    """업종 표를 채운다. 시간이 다 되면 받은 데까지 저장하고 None."""
    path = state / "industry.json"
    ind = json.loads(path.read_text()) if path.exists() else {}
    missing = [c for c in codes if c not in ind]
    if missing and key:
        print(f"DART 업종 조회: {len(missing)}종목")
        corp = dart_corp_codes(key)
        save = lambda: path.write_text(json.dumps(ind, ensure_ascii=False, sort_keys=True, indent=0))  # noqa: E731
        for i, c in enumerate(missing):
            if over_budget():
                save()
                notice(f"시간이 다 돼 업종 {len(missing) - i}종목은 다음 실행에서 받습니다")
                return None
            ind[c] = dart_ksic(key, corp[c]) if c in corp else None
            if i % 200 == 199:
                print(f"  {i + 1}/{len(missing)}")
                save()
            time.sleep(0.2)  # DART 분당 1,000회 넘으면 막힐 수 있어 분당 300회 안쪽으로
        path.write_text(json.dumps(ind, ensure_ascii=False, sort_keys=True, indent=0))
    elif missing:
        print(f"DART_API_KEY가 없어 {len(missing)}종목은 기타로 둡니다")
    return ind


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--stocks", help="종목 검색 자료(JSON)를 쓸 곳")
    ap.add_argument("--today", help="YYYY-MM-DD (시험용)")
    args = ap.parse_args()

    state = Path(args.state)
    state.mkdir(parents=True, exist_ok=True)
    today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()

    days = load_days(state)
    key = os.environ.get("DATA_GO_KR_KEY", "").strip()
    if key:
        if not update_prices(state, key, days, today):
            return more()
    elif not days:
        sys.exit("DATA_GO_KR_KEY가 없고 저장된 시세도 없습니다")
    notice(f"저장된 시세 {len(days)}일 ({min(days, default='-')}~{max(days, default='-')})")
    if len(days) < 130:
        sys.exit(f"시세가 {len(days)}일뿐이라 계산하지 않습니다 (130일 이상 필요)")

    if key and not refill_extra(state, key, days):
        return more()
    latest = days[max(days)]
    industry = update_industry(state, os.environ.get("DART_API_KEY", "").strip() or None, sorted({r["code"] for r in latest}))
    if industry is None:
        return more()
    earnings = update_earnings(state, os.environ.get("DART_API_KEY", "").strip() or None, sorted({r["code"] for r in latest}), today)
    data, stocks = compute(days, industry, earnings)
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    if args.stocks:
        Path(args.stocks).parent.mkdir(parents=True, exist_ok=True)
        Path(args.stocks).write_text(json.dumps(stocks, ensure_ascii=False, separators=(",", ":")) + "\n")
    notice(f"{data['asof']} 기준 섹터 {len(data['sectors'])}개를 {args.out}에 썼습니다 (시세 {len(days)}일)")


def more():
    """받을 것이 남았다고 워크플로에 알린다 (워크플로가 자기 자신을 한 번 더 돌린다)."""
    if out := os.environ.get("GITHUB_OUTPUT"):
        with open(out, "a") as f:
            f.write("more=1\n")


def notice(msg: str, level: str = "notice"):
    """GitHub Actions 주석으로도 남긴다 (실행 기록을 못 내려받을 때 API로 읽을 수 있게)."""
    print(msg)
    if os.environ.get("GITHUB_ACTIONS"):
        print(f"::{level}::" + msg.replace("%", "%25").replace("\r", "").replace("\n", "%0A"))


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (0, None):
            notice(str(e.code), "error")
        raise
    except Exception:
        import traceback

        notice(traceback.format_exc()[-3000:], "error")
        sys.exit(1)
