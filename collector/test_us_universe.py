"""미국 종목 범위: 위키백과 표 읽기와 기호 묶기"""

import unittest

from us_universe import Tables, clean_symbol, col, key

HTML = """
<table class="infobox"><tr><th>Symbol</th></tr><tr><td>XXX</td></tr></table>
<table class="wikitable sortable" id="constituents">
<tr><th>Symbol</th><th>Security</th><th>GICS Sector</th></tr>
<tr><td><a>MMM</a></td><td>3M</td><td>Industrials</td></tr>
<tr><td>BRK.B<sup>[1]</sup></td><td>Berkshire Hathaway</td><td>Financials</td></tr>
</table>
"""


class T(unittest.TestCase):
    def test_tables(self):
        p = Tables()
        p.feed(HTML)
        self.assertEqual(len(p.tables), 1)  # wikitable만
        t = p.tables[0]
        self.assertEqual(t[0], ["Symbol", "Security", "GICS Sector"])
        self.assertEqual(t[2][0], "BRK.B")  # 각주 번호는 뺀다
        self.assertEqual(col(t[0], ("ticker", "symbol")), 0)

    def test_symbols(self):
        self.assertEqual(clean_symbol("NYSE: MMM"), "MMM")
        self.assertEqual(clean_symbol("brk-b"), "BRK.B")
        self.assertEqual(clean_symbol("BRK B"), "BRK.B")
        self.assertEqual(key("BRK.B"), key("BRKB"))


if __name__ == "__main__":
    unittest.main()
