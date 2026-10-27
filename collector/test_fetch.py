"""python -m unittest discover collector — DART 주요계정 응답 해석을 점검한다."""

import json
import unittest
from unittest import mock

import fetch


def row(acc, fs="CFS", sj="IS", amt="1,000"):
    return {"stock_code": "005930", "fs_div": fs, "sj_div": sj, "account_nm": acc,
            "thstrm_amount": amt, "thstrm_add_amount": "2,000", "frmtrm_amount": "500", "frmtrm_add_amount": "900"}


class MultiAccounts(unittest.TestCase):
    def parse(self, rows):
        body = json.dumps({"status": "000", "list": rows}).encode()
        with mock.patch.object(fetch, "_get", return_value=body):
            return fetch.dart_multi_accounts("k", ["00126380"], 2026, "11012")

    def test_net_with_parenthesis(self):
        got = self.parse([row("매출액"), row("영업이익"), row("당기순이익(손실)")])["005930"]
        self.assertEqual(set(got), {"fs", "rev", "op", "net"})
        self.assertEqual(got["net"], (1000.0, 2000.0, 500.0, 900.0))

    def test_cfs_wins_and_bs_ignored(self):
        got = self.parse([row("영업이익", fs="OFS", amt="1"), row("영업이익", amt="7"), row("당기순이익", sj="BS")])["005930"]
        self.assertEqual(got["fs"], "CFS")
        self.assertEqual(got["op"][0], 7.0)
        self.assertNotIn("net", got)


if __name__ == "__main__":
    unittest.main()
