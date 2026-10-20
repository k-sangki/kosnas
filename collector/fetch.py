"""원천 자료 받기.

- 금융위원회 주식시세정보(공공데이터포털, 이용 제한 없음): 날짜별 전 종목 종가·등락률·거래대금·시가총액. 다음 영업일 13시 뒤 공개.
- OpenDART 기업개황: 종목의 표준산업분류(KSIC) 코드. 처음 보는 종목만 묻는다.
"""

import io
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

FSC_URL = "https://apis.data.go.kr/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2"
DART_CORP_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
DART_COMPANY_URL = "https://opendart.fss.or.kr/api/company.json"

PAGE = 1000


def _get(url: str, params: dict, tries: int = 4) -> bytes:
    q = urllib.parse.urlencode(params, safe="%")
    for i in range(tries):
        try:
            with urllib.request.urlopen(f"{url}?{q}", timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            body = e.read()[:500].decode("utf-8", "replace")
            # 403·401은 키 문제(승인 대기·미등록)라 다시 시도해도 같다
            if e.code in (401, 403) or i == tries - 1:
                raise RuntimeError(f"HTTP {e.code} {url}: {body}") from None
            print(f"  다시 시도 (HTTP {e.code})")
            time.sleep(2 * (i + 1))
        except Exception as e:  # 공공데이터포털은 가끔 타임아웃·5xx를 낸다
            if i == tries - 1:
                raise
            print(f"  다시 시도 ({e})")
            time.sleep(2 * (i + 1))
    raise RuntimeError("unreachable")


def _num(v):
    if v in (None, ""):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def fsc_range(key: str, begin: str, end: str) -> dict[str, list[dict]]:
    """begin~end(YYYYMMDD, 끝 포함)의 전 종목 시세를 날짜별로 돌려준다."""
    rows: list[dict] = []
    page = 1
    while True:
        raw = _get(
            FSC_URL,
            {
                "serviceKey": key,
                "resultType": "json",
                "numOfRows": PAGE,
                "pageNo": page,
                "beginBasDt": begin,
                "endBasDt": _next_day(end),  # endBasDt는 그 날짜 '미만'이다
            },
        )
        try:
            body = json.loads(raw)["response"]
        except (ValueError, KeyError):
            raise RuntimeError(f"금융위 응답을 읽을 수 없습니다: {raw[:300]!r}")
        code = body.get("header", {}).get("resultCode")
        if code not in ("00", "0"):
            raise RuntimeError(f"금융위 오류 {code}: {body.get('header')}")
        b = body["body"]
        items = b.get("items") or {}
        items = items.get("item", []) if isinstance(items, dict) else []
        if isinstance(items, dict):
            items = [items]
        rows.extend(items)
        total = int(b.get("totalCount") or 0)
        if page == 1:
            print(f"  {begin}~{end}: {total}행")
        if page * PAGE >= total or not items:
            break
        page += 1
        time.sleep(0.1)

    by_day: dict[str, list[dict]] = {}
    for it in rows:
        market = it.get("mrktCtg")
        if market not in ("KOSPI", "KOSDAQ"):
            continue
        code = (it.get("srtnCd") or "").lstrip("A")
        by_day.setdefault(it["basDt"], []).append(
            {
                "code": code,
                "name": it.get("itmsNm"),
                "market": market,
                "close": _num(it.get("clpr")),
                "chg": _num(it.get("fltRt")),
                "value": _num(it.get("trPrc")),
                "cap": _num(it.get("mrktTotAmt")),
            }
        )
    return by_day


def _next_day(d: str) -> str:
    import datetime as dt

    return (dt.datetime.strptime(d, "%Y%m%d") + dt.timedelta(days=1)).strftime("%Y%m%d")


def dart_corp_codes(key: str) -> dict[str, str]:
    """종목코드 → DART 고유번호."""
    raw = _get(DART_CORP_URL, {"crtfc_key": key})
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        xml = z.read(z.namelist()[0])
    out = {}
    for el in ET.fromstring(xml).iter("list"):
        stock = (el.findtext("stock_code") or "").strip()
        if stock:
            out[stock] = el.findtext("corp_code").strip()
    return out


def dart_ksic(key: str, corp_code: str) -> str | None:
    raw = _get(DART_COMPANY_URL, {"crtfc_key": key, "corp_code": corp_code})
    d = json.loads(raw)
    if d.get("status") != "000":
        return None
    return (d.get("induty_code") or "").strip() or None
