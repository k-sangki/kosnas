"""python -m unittest discover collector — 가짜 시세로 계산 흐름을 점검한다."""

import random
import unittest

from compute import compute, is_common
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
        self.assertEqual(sector_of("078930", "64992", "GS"), "etc")

    def test_compute(self):
        days, industry = fake_days()
        d = compute(days, industry)
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


if __name__ == "__main__":
    unittest.main()
