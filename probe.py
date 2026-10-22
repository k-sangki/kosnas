import json, urllib.request, time
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"}
def get(u, body=None):
    if body is None:
        r = urllib.request.Request(u, headers=UA)
    else:
        r = urllib.request.Request(u, data=json.dumps(body).encode(), headers={**UA, "content-type": "application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=30).read())
out = []
for i in range(4):
    row = {"i": i, "at": time.strftime("%H:%M:%S", time.gmtime())}
    try:
        d = get(f"https://kosnas.com/api/night?x={time.time()}")
        row.update({k: d.get(k) for k in ["method", "base", "baseKind", "est", "chg", "chgPct", "high", "low", "factor", "at0600", "nightClose", "updated", "error"]})
        row["first"] = d.get("points", [None])[0]
        row["last3"] = d.get("points", [])[-3:]
        row["npts"] = len(d.get("points", []))
    except Exception as e:
        row["err"] = repr(e)[:300]
    try:
        ctx = get("https://api.hyperliquid.xyz/info", {"type": "metaAndAssetCtxs", "dex": "xyz"})
        for u, c in zip(ctx[0]["universe"], ctx[1]):
            if u["name"] == "xyz:KR200":
                row["hl_kr200"] = {k: c.get(k) for k in ["oraclePx", "markPx", "midPx", "premium"]}
    except Exception as e:
        row["hl_err"] = repr(e)[:200]
    out.append(row)
    time.sleep(20)
json.dump(out, open("out.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False)[:3000])
