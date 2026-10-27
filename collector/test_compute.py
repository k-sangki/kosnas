"""python -m unittest discover collector — 가짜 시세로 계산 흐름을 점검한다."""

import random
import unittest

from compute import compute, is_common, latest_quarter
from taxonomy import sector_of


def fake_days(n_days=260, seed=1):
    rnd = random.Random(seed)
    stocks = []
    # 섹터마다 5종목: 반도체(261), 조선(311), 금융(641), 음식료(107)
    for k, ksic in enumerate(["261", "311", "641", "107"]):
        for j in range(5):
            stocks.append((f"{k}{j}{j}{j}{j}0", f"종목{k}{j}", "KOSPI" if j % 2 else "KOSDAQ", ksic, (k - 1.5) * 0.002))
    days = {}
    for i in range(n_days):
        day = f"2026{(i // 28) % 12 + 1:02d}{i % 28 + 1:02d}" if i < 336 else None
        rows = []
        for code, name, market, _, drift in stocks:
            rows.append({"code": code, "name": name, "market": market, "close": 10000.0, "chg": round((drift + rnd.gauss(0, 0.01)) * 100, 2), "value": 1e10, "cap": 5e11})
        rows.append({"code": "00001K", "name": "어떤우", "market": "KOSPI", "close": 1.0, "chg": 0.0, "value": 0.0, "cap": 1e9})
        days[day] = rows
    industry = {code: ksic for code, _, _, ksic, _ in stocks}
    return days, industry


class ComputeTest(unittest.TestCase):
    def test_common(self):
        self.assertTrue(is_common("005930", "삼성전자"))
        self.assertFalse(is_common("005935", "삼성전자우"))
        self.assertFalse(is_common("123450", "하나스팩1호"))

    def test_sector_of(self):
        self.assertEqual(sector_of("000660", "26110"), "semis")
        self.assertEqual(sector_of("005930", "264"), "semis")  # 예외 목록
        self.assertEqual(sector_of("111110", "20423"), "cosmetics")
        self.assertEqual(sector_of("111110", "20111"), "chem")
        self.assertEqual(sector_of("111110", None), "etc")
        self.assertEqual(sector_of("105560", "64992", "KB금융"), "finance")
        self.assertEqual(sector_of("111110", "64992", "어떤홀딩스"), "etc")

    def test_compute(self):
        days, industry = fake_days()
        d, st = compute(days, industry)
        ids = {s["id"] for s in d["sectors"]}
        self.assertEqual(ids, {"semis", "ship", "finance", "food"})
        for p in ("5", "20", "60"):
            xs = [s["x"][p] for s in d["sectors"]]
            self.assertLess(abs(sum(xs)), 0.05)  # 소수 둘째 자리 반올림 오차
        # 추세가 가장 강한 음식료가 60일 강도 1위
        top = max(d["sectors"], key=lambda s: s["x"]["60"])
        self.assertEqual(top["id"], "food")
        for s in d["sectors"]:
            self.assertEqual(len(s["stocks"]), 5)
            self.assertTrue(all(1 <= x["rs"] <= 99 for x in s["stocks"]))
        self.assertEqual(d["breadth"]["KOSPI"]["count"] + d["breadth"]["KOSDAQ"]["count"], 20)
        self.assertEqual(len(st["rows"]), 20)
        for s in d["sectors"]:
            self.assertEqual(len(s["path"]["30"]), 30)
            self.assertEqual(len(s["half"]["20"]), 2)
        self.assertAlmostEqual(sum(s["capShareChg"]["20"] for s in d["sectors"]), 0, places=1)


    def test_latest_quarter(self):
        e = {
            "2025.3Q": {"rev": (100, 300, 80, 240), "op": (10, 25, -5, 0), "net": (8, 20, -4, 1)},
            "2025.4Q": {"rev": (420, None, 330, None), "op": (40, None, 6, None), "net": (30, None, 2, None)},
        }
        # 사업보고서 연간 − 3분기 누적 = 4분기
        self.assertEqual(latest_quarter(e), ("2025.4Q", 120, 15, 10, 90, 6))
        # 3분기 자료가 없으면 사업보고서는 건너뛴다
        self.assertEqual(latest_quarter({"2025.4Q": e["2025.4Q"], "2025.2Q": e["2025.3Q"]})[0], "2025.2Q")
        self.assertIsNone(latest_quarter(None))

    def test_new_columns(self):
        days, industry = fake_days()
        for rows in days.values():
            for r in rows:
                r["vol"], r["open"] = 1000.0, r["close"] * 0.99
        last = max(days)
        for r in days[last]:
            r["vol"] = 3000.0
        code = days[last][0]["code"]
        _, st = compute(days, industry, {code: {"2026.2Q": {"rev": (150, 0, 100, 0), "op": (5, 0, -1, 0), "net": (3, 0, 1, 0)}}})
        i = {k: n for n, k in enumerate(st["cols"])}
        row = next(r for r in st["rows"] if r[0] == code)
        self.assertEqual(row[i["volRatio"]], 3.0)
        self.assertEqual(row[i["earnP"]], "2026.2Q")
        self.assertEqual(row[i["revYoY"]], 50.0)


if __name__ == "__main__":
    unittest.main()
