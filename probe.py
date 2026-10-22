import json, time, urllib.request
URL = "https://api.hyperliquid.xyz/info"
def info(body):
    r = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=30))
start = 1761109200000  # placeholder, replaced below
# 2026-10-22 05:00 UTC = 14:00 KST
import datetime as dt
start = int(dt.datetime(2026, 10, 22, 5, 0, tzinfo=dt.timezone.utc).timestamp() * 1000)
now = int(time.time() * 1000)
out = {}
for c in ["KR200", "EWY"]:
    out[c] = info({"type": "candleSnapshot", "req": {"coin": f"xyz:{c}", "interval": "1m", "startTime": start, "endTime": now}})
    out[c + "|funding"] = info({"type": "fundingHistory", "coin": f"xyz:{c}", "startTime": start - 86400000})
m, ctx = info({"type": "metaAndAssetCtxs", "dex": "xyz"})
out["ctx"] = {u["name"]: x for u, x in zip(m["universe"], ctx) if u["name"] in ("xyz:KR200", "xyz:EWY")}
json.dump(out, open("out.json", "w"))
print({k: len(v) for k, v in out.items()})
