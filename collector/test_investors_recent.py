import unittest

from investors_recent import ark_trades, form4_event, parse_13dg, parse_ark, parse_form4

FORM4 = b"""<?xml version="1.0"?><ownershipDocument><issuer><issuerName>LENNAR CORP</issuerName><issuerTradingSymbol>LEN</issuerTradingSymbol></issuer><reportingOwner><reportingOwnerId><rptOwnerCik>0001067983</rptOwnerCik></reportingOwnerId></reportingOwner>
<nonDerivativeTable>
<nonDerivativeTransaction><transactionDate><value>2026-10-01</value></transactionDate><transactionCoding><transactionCode>P</transactionCode></transactionCoding>
<transactionAmounts><transactionShares><value>100</value></transactionShares><transactionPricePerShare><value>80</value></transactionPricePerShare>
<transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts>
<postTransactionAmounts><sharesOwnedFollowingTransaction><value>1100</value></sharesOwnedFollowingTransaction></postTransactionAmounts></nonDerivativeTransaction>
<nonDerivativeTransaction><transactionDate><value>2026-10-02</value></transactionDate><transactionCoding><transactionCode>P</transactionCode></transactionCoding>
<transactionAmounts><transactionShares><value>300</value></transactionShares><transactionPricePerShare><value>90</value></transactionPricePerShare>
<transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode></transactionAmounts>
<postTransactionAmounts><sharesOwnedFollowingTransaction><value>1400</value></sharesOwnedFollowingTransaction></postTransactionAmounts></nonDerivativeTransaction>
<nonDerivativeTransaction><transactionDate><value>2026-10-02</value></transactionDate><transactionCoding><transactionCode>F</transactionCode></transactionCoding>
<transactionAmounts><transactionShares><value>5</value></transactionShares><transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode></transactionAmounts></nonDerivativeTransaction>
</nonDerivativeTable></ownershipDocument>"""

D13 = b"""<?xml version="1.0"?><edgarSubmission xmlns="http://www.sec.gov/edgar/schedule13D"><formData><coverPageHeader><dateOfEvent>10/13/2026</dateOfEvent>
<issuerInfo><issuerCIK>0001779128</issuerCIK><issuerCusips><issuerCusipNumber>092667104</issuerCusipNumber></issuerCusips><issuerName>Strata</issuerName></issuerInfo></coverPageHeader>
<reportingPersons><reportingPersonInfo><aggregateAmountOwned>5126511</aggregateAmountOwned><percentOfClass>5.8</percentOfClass></reportingPersonInfo></reportingPersons>
</formData></edgarSubmission>"""

ARK = """date,fund,company,ticker,cusip,shares,market value ($),weight (%)
10/22/2026,ARKK,TESLA INC,TSLA,88160R101,"1,000","$400,000.00",10%
10/22/2026,ARKK,OPENAI SERIES C,,PPOPENAIC,"10","$100.00",
"The principal risks ..."
"""


class Form4Test(unittest.TestCase):
    def test_market_buys_only(self):
        p = parse_form4(FORM4)
        self.assertEqual(p["ticker"], "LEN")
        self.assertEqual(p["owners"], [1067983])
        e = form4_event(p)
        self.assertEqual(e["kind"], "buy")
        self.assertEqual(e["shares"], 400)  # 세금 원천징수(F)는 장내 매매가 있으면 뺀다
        self.assertEqual(e["value"], 100 * 80 + 300 * 90)
        self.assertEqual(e["after"], 1400)
        self.assertEqual((e["from"], e["to"]), ("2026-10-01", "2026-10-02"))


class Stake13Test(unittest.TestCase):
    def test_parse(self):
        p = parse_13dg(D13)
        self.assertEqual(p["issuer_cik"], 1779128)
        self.assertEqual(p["pct"], 5.8)
        self.assertEqual(p["shares"], 5126511)
        self.assertEqual(p["event_date"], "10/13/2026")


class ArkTest(unittest.TestCase):
    def test_parse(self):
        day, h = parse_ark(ARK)
        self.assertEqual(day, "2026-10-22")
        self.assertEqual(h["TSLA"][2], 1000)
        self.assertIn("PPOPENAIC", h)

    def test_creation_is_not_a_trade(self):
        prev = {k: ["", k, 100.0, 1000.0] for k in "ABCDE"}
        cur = {k: ["", k, 110.0, 1100.0] for k in "ABCD"}  # 모두 10% 늘어난 것은 설정
        cur["A"] = ["", "A", 130.0, 1300.0]  # A만 더 샀다
        cur["F"] = ["", "F", 50.0, 500.0]  # 새로 샀다, E는 다 팔았다
        t = {x["ticker"]: x for x in ark_trades("ARKK", "2026-10-22", prev, cur)}
        self.assertEqual(set(t), {"A", "E", "F"})
        self.assertEqual((t["A"]["kind"], t["A"]["shares"]), ("buy", 20))
        self.assertEqual(t["E"]["kind"], "exit")
        self.assertEqual(t["F"]["kind"], "new")


if __name__ == "__main__":
    unittest.main()
