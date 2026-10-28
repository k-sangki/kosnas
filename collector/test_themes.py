"""테마 관련주 목록 점검: 코드 형식·중복, 자료가 없는 종목은 빠지는지."""

import unittest

from themes import THEMES, build


class ThemesTest(unittest.TestCase):
    def test_codes(self):
        for tid, members in THEMES.items():
            codes = [c for c, _ in members]
            self.assertEqual(len(codes), len(set(codes)), tid)
            for c, note in members:
                self.assertRegex(c, r"^\d{6}$")
                self.assertTrue(note)

    def test_build(self):
        cols = ["code", "name", "market", "rs", "close", "chg", "r5", "r10", "r20", "r30", "r60", "fromHigh", "above50", "capEok", "base", "industry"]
        rows = [
            ["277810", "레인보우로보틱스", "KOSDAQ", 90, 100, 1.0, 1, 2, 10, 4, 5, -3, True, 500, True, "특수 목적 기계"],
            ["454910", "두산로보틱스", "KOSPI", 50, 100, -1.0, 1, 2, -20, 4, 5, -3, False, 900, True, "특수 목적 기계"],
        ]
        d = build({"asof": "2026-10-27", "sparkFrom": "2026-05-01", "cols": cols, "rows": rows})
        robot = d["themes"]["robot"]
        self.assertEqual([s["name"] for s in robot["stocks"]], ["두산로보틱스", "레인보우로보틱스"])
        self.assertEqual(robot["ret"]["20"], -5.0)
        self.assertEqual(d["themes"]["ess"]["stocks"], [])


if __name__ == "__main__":
    unittest.main()
