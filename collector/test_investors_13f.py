"""유명 투자자 포트폴리오: 13F 정보 표 읽기와 전 분기 비교"""

import unittest

from investors_13f import aggregate, compare, flow_rows, parse_table, sector_flows, sector_of, sic_sector, summarize

XML = b"""<?xml version="1.0"?>
<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
<infoTable><nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip>
<value>600</value><shrsOrPrnAmt><sshPrnamt>3</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>
<infoTable><nameOfIssuer>APPLE INC</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>037833100</cusip>
<value>400</value><shrsOrPrnAmt><sshPrnamt>2</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>
<infoTable><nameOfIssuer>SPDR S&amp;P 500</nameOfIssuer><titleOfClass>TR UNIT</titleOfClass><cusip>78462f103</cusip>
<value>1000</value><shrsOrPrnAmt><sshPrnamt>10</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt><putCall>Put</putCall></infoTable>
</informationTable>"""


class T(unittest.TestCase):
    def test_parse(self):
        rows = parse_table(XML, "2026-08-14")
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[2]["cusip"], "78462F103")
        self.assertEqual(rows[2]["put_call"], "Put")
        self.assertEqual(parse_table(XML, "2022-11-14")[0]["value"], 600_000)  # 예전 보고서는 천 달러

    def test_compare(self):
        cur = aggregate(parse_table(XML, "2026-08-14"))
        self.assertEqual(cur[("037833100", None)]["shares"], 5)  # 나눠 적은 줄을 합친다
        prev = {("037833100", None): {"name": "APPLE INC", "cls": "COM", "cusip": "037833100", "value": 500, "shares": 4, "put_call": None},
                ("594918104", None): {"name": "MICROSOFT", "cls": "COM", "cusip": "594918104", "value": 300, "shares": 1, "put_call": None}}
        holdings, sold, total = compare(cur, prev)
        self.assertEqual(total, 2000)
        by = {h["cusip"]: h for h in holdings}
        self.assertEqual(by["037833100"]["change"], "add")
        self.assertEqual(by["78462F103"]["change"], "new")
        self.assertAlmostEqual(by["037833100"]["weight"], 50)
        self.assertEqual([s["cusip"] for s in sold], ["594918104"])
        self.assertIsNone(compare(cur, None)[0][0]["change"])


class Sectors(unittest.TestCase):
    def test_flows(self):
        cur = aggregate(parse_table(XML, "2026-08-14"))
        prev = {("037833100", None): {"name": "APPLE INC", "cls": "COM", "cusip": "037833100", "value": 500, "shares": 4, "put_call": None},
                ("594918104", None): {"name": "MICROSOFT", "cls": "COM", "cusip": "594918104", "value": 300, "shares": 1, "put_call": None}}
        holdings, sold, _ = compare(cur, prev)
        f = dict(flow_rows(holdings, sold))
        self.assertAlmostEqual(f["037833100"], 200)  # 1주 더 × 200달러
        self.assertEqual(f["594918104"], -300)
        self.assertNotIn("78462F103", f)  # 풋옵션은 뺀다
        sf = sector_flows(list(f.items()), {}, {"037833100": "AAPL", "594918104": "MSFT"}, {"AAPL": 3571, "MSFT": 7372})
        self.assertEqual(sf["기술"][:2], [200, -300])
        inv = [{"person": "A", "period": "2026-06-30", "sector_flows": sf}]
        s = summarize(inv)
        self.assertEqual(s["sectors"][0]["net"], -100)
        self.assertEqual(s["sectors"][0]["sellers"], ["A"])

    def test_sector(self):
        self.assertEqual(sic_sector(3674), "반도체")
        self.assertEqual(sic_sector(2834), "헬스케어")
        self.assertEqual(sic_sector(6798), "부동산")
        self.assertEqual(sector_of("SPDR S&P 500 ETF TR", "SPY", {}), "ETF·지수")
        self.assertEqual(sector_of("VISA", "V", {"V": 7389}), "금융")


if __name__ == "__main__":
    unittest.main()
