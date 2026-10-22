import json, urllib.request, time
URLS = [
  "https://finance.naver.com/sise/sise_index.naver?code=FUT",
  "https://polling.finance.naver.com/api/realtime?query=SERVICE_INDEX:FUT",
  "https://polling.finance.naver.com/api/realtime/domestic/index/FUT",
  "https://m.stock.naver.com/api/index/FUT/basic",
  "https://m.stock.naver.com/api/index/FUT/integration",
  "https://api.stock.naver.com/index/FUT/basic",
  "https://fchart.stock.naver.com/sise.nhn?symbol=FUT&timeframe=day&count=5&requestType=0",
  "https://fchart.stock.naver.com/siseJson.nhn?symbol=FUT&requestType=1&startTime=20261015&endTime=20261023&timeframe=day",
  "https://finance.naver.com/sise/sise_index_day.naver?code=FUT",
]
out = {}
for u in URLS:
    try:
        r = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Referer": "https://finance.naver.com/"})
        resp = urllib.request.urlopen(r, timeout=20)
        raw = resp.read()
        ct = resp.headers.get("content-type", "")
        enc = "euc-kr" if ("euc-kr" in ct.lower() or "finance.naver.com/sise" in u) else "utf-8"
        try:
            txt = raw.decode(enc, "replace")
        except Exception:
            txt = raw.decode("utf-8", "replace")
        out[u] = {"status": resp.status, "ct": ct, "len": len(raw), "body": txt[:6000]}
    except Exception as e:
        out[u] = {"error": repr(e)[:300]}
    time.sleep(1)
json.dump(out, open("out.json", "w"), ensure_ascii=False, indent=1)
print({u: (v.get("status"), v.get("len"), v.get("error")) for u, v in out.items()})
