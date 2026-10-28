"""
테마 관련주(로봇·ESS·원전·양자컴퓨터) 자료.

업종 분류(KSIC)로는 한 칸에 모이지 않지만 사람들이 '로봇 관련주'처럼 묶어 찾는 종목들이다.
사업보고서·공시에 적힌 사업 내용을 보고 직접 고른 목록이며(네이버 테마 등 남의 분류는 쓰지 않는다),
값은 종목 검색 자료(kr-stocks.json)에서 그대로 가져와 src/data/kr-themes.json 으로 쓴다.
Collect KR 워크플로가 krx.py 다음에 돌린다.

    python collector/themes.py --stocks public/data/kr-stocks.json --out src/data/kr-themes.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

# 테마 id → [(종목코드, 관련 사업)]. 고칠 때는 사업 내용이 공시로 확인되는 종목만 넣는다.
THEMES: dict[str, list[tuple[str, str]]] = {
    "robot": [
        ("277810", "휴머노이드·협동로봇"),
        ("454910", "협동로봇"),
        ("108490", "로봇 구동기(액추에이터)·배송로봇"),
        ("058610", "정밀 감속기·모터"),
        ("160190", "서보모터·로봇 구동부"),
        ("319400", "물류 자동화·물류로봇"),
        ("437730", "로봇 구동 모듈"),
        ("056080", "자율주행·청소 로봇"),
        ("090360", "산업용 로봇"),
        ("348340", "협동로봇"),
        ("090710", "산업용 로봇"),
        ("466100", "로봇 관제·자율주행 소프트웨어"),
        ("388720", "산업용 로봇·자동화 설비"),
        ("455900", "웨어러블 로봇"),
        ("389500", "하모닉 감속기"),
        ("004380", "직선 운동 부품(LM 가이드)"),
        ("117730", "진공 이송 로봇"),
        ("060280", "수술 로봇"),
        ("459510", "산업용 로봇"),
        ("140670", "모션 제어·서보 드라이브"),
        ("270660", "로봇청소기"),
    ],
    "ess": [
        ("373220", "ESS용 배터리"),
        ("006400", "ESS용 배터리"),
        ("096770", "배터리 자회사(SK온)"),
        ("066970", "LFP 양극재"),
        ("178320", "ESS 함체·전력 장치"),
        ("010120", "ESS 전력 변환·배전"),
        ("298040", "ESS 시스템"),
        ("107640", "ESS 냉각 장치"),
        ("453450", "ESS 운영·수요반응"),
    ],
    "nuclear": [
        ("034020", "원자로·증기발생기 주기기"),
        ("052690", "원전 설계"),
        ("051600", "원전 정비"),
        ("015760", "원전 운영(한국수력원자력 모회사)"),
        ("000720", "원전 시공"),
        ("047040", "원전 시공"),
        ("028260", "원전 시공"),
        ("032820", "원전 제어계측"),
        ("083650", "원전 보조기기"),
        ("105840", "원전 계측기"),
        ("006910", "원전 기자재"),
        ("094820", "원전·발전 정비"),
        ("019990", "원전용 밸브 구동기"),
        ("189860", "원전용 배전반"),
        ("046120", "방사선 관리·원전 해체"),
        ("126720", "원전 정비"),
    ],
    "quantum": [
        ("017670", "양자암호통신·아이온큐 지분"),
        ("030200", "양자암호통신"),
        ("032640", "양자내성암호 전용회선"),
        ("356680", "양자암호 VPN"),
        ("046970", "양자암호 광부품"),
        ("115500", "양자암호 보안칩"),
        ("115440", "양자암호 전송 장비"),
        ("042510", "양자내성암호"),
        ("203650", "양자내성암호"),
        ("456010", "보안칩·양자내성암호"),
    ],
}

KEEP = ["code", "name", "market", "rs", "close", "chg", "fromHigh", "above50", "capEok", "base", "industry"]
PERIODS = [5, 10, 20, 30, 60]


def avg(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 2) if xs else None


def build(stocks: dict) -> dict:
    i = {c: k for k, c in enumerate(stocks["cols"])}
    rows = {r[i["code"]]: r for r in stocks["rows"]}
    out = {}
    for tid, members in THEMES.items():
        items = []
        for code, note in members:
            r = rows.get(code)
            if r is None:  # 상장폐지·거래정지 등으로 자료가 없으면 뺀다
                continue
            s = {k: r[i[k]] for k in KEEP}
            s["r"] = {str(p): r[i[f"r{p}"]] for p in PERIODS}
            s["note"] = note
            items.append(s)
        items.sort(key=lambda s: -(s["capEok"] or 0))
        # 테마 등락률은 종목 단순 평균(시총이 큰 한 종목이 테마 전체를 대신하지 않게)
        ret = {str(p): avg([s["r"][str(p)] for s in items if s["r"][str(p)] is not None]) for p in PERIODS}
        out[tid] = {"stocks": items, "ret": ret}
    return {"asof": stocks["asof"], "sparkFrom": stocks.get("sparkFrom"), "themes": out}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stocks", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    data = build(json.loads(Path(a.stocks).read_text()))
    Path(a.out).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print({k: len(v["stocks"]) for k, v in data["themes"].items()})


if __name__ == "__main__":
    main()
