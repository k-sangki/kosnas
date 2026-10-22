"""유명 투자자 포트폴리오: 13F 정보 표 읽기와 전 분기 비교"""

import unittest

from investors_13f import aggregate, compare, parse_table

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


if __name__ == "__main__":
    unittest.main()
