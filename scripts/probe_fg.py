"""일회성: 우리 미장 공탐 추정과 CNN 값을 날짜별로 견준다(화면에는 쓰지 않음)."""
import json, sys, urllib.request
sys.path.insert(0, "collector")
import fear_greed as f

req = urllib.request.Request("https://production.dataviz.cnn.io/index/fearandgreed/graphdata/2024-11-01",
    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36", "Accept": "application/json", "Referer": "https://edition.cnn.com/"})
from datetime import datetime, timezone
j = json.loads(urllib.request.urlopen(req, timeout=60).read())
cnn = {}
for p in j["fear_and_greed_historical"]["data"]:
    cnn[datetime.fromtimestamp(p["x"] / 1000, timezone.utc).strftime("%Y-%m-%d")] = p["y"]
print("cnn days", len(cnn), min(cnn), max(cnn))
# CNN 구성 항목도 있으면 이름만
print("cnn keys", list(j.keys()))

spx, vix, ief, hyg = f.yahoo("^GSPC"), f.yahoo("^VIX"), f.yahoo("IEF"), f.yahoo("HYG")
ours = {x["d"]: x for x in f.series(spx, ief, vix)}
junk = {x["d"]: x for x in f.series(hyg, ief, None)}  # 정크본드 대 국채: safe 항목을 쓴다
rows = []
for d in sorted(ours):
    if d in cnn and d in junk:
        p = ours[d]["parts"]
        rows.append((d, cnn[d], ours[d]["score"], p["momentum"], p["high52"], p["rsi"], p["volatility"], p["safe"], junk[d]["parts"]["safe"]))
rows = [r for r in rows if None not in r]
print("matched", len(rows), rows[0][0], rows[-1][0])
import statistics as st
def corr(a, b):
    ma, mb = st.mean(a), st.mean(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    return num / (sum((x - ma) ** 2 for x in a) ** .5 * sum((y - mb) ** 2 for y in b) ** .5)
def lsq(X, y):
    # 최소제곱(정규방정식), X 첫 열 1
    n = len(X[0]); A = [[sum(r[i] * r[k] for r in X) for k in range(n)] for i in range(n)]; bb = [sum(r[i] * t for r, t in zip(X, y)) for i in range(n)]
    for i in range(n):
        piv = A[i][i]
        for k in range(i, n): pass
        for r in range(n):
            if r != i:
                fct = A[r][i] / piv
                A[r] = [a - fct * c for a, c in zip(A[r], A[i])]; bb[r] -= fct * bb[i]
    return [bb[i] / A[i][i] for i in range(n)]
names = ["momentum", "high52", "rsi", "volatility", "safe", "junk"]
c = [r[1] for r in rows]; o = [r[2] for r in rows]
print(f"전체 상관 {corr(c, o):.3f} 평균차(우리-CNN) {st.mean(x - y for x, y in zip(o, c)):+.1f} 평균절대차 {st.mean(abs(x - y) for x, y in zip(o, c)):.1f}")
for i, nm in enumerate(names):
    print(f"  항목 {nm} 상관 {corr(c, [r[3 + i] for r in rows]):.3f}")
cut = int(len(rows) * 0.75); tr, te = rows[:cut], rows[cut:]
print("학습", tr[0][0], tr[-1][0], "검증", te[0][0], te[-1][0])
def evalm(pred, data, label):
    p = [pred(r) for r in data]; t = [r[1] for r in data]
    p = [max(0, min(100, x)) for x in p]
    print(f"  {label}: 상관 {corr(t, p):.3f} 평균절대차 {st.mean(abs(a - b) for a, b in zip(p, t)):.1f} 평균차 {st.mean(a - b for a, b in zip(p, t)):+.1f} 구간일치 {st.mean(1 if band(a) == band(b) else 0 for a, b in zip(p, t)) * 100:.0f}%")
def band(v): return 0 if v < 25 else 1 if v < 45 else 2 if v <= 55 else 3 if v <= 75 else 4
for lab, data in (("학습", tr), ("검증", te)):
    print(lab)
    evalm(lambda r: r[2], data, "지금 그대로")
    a, b = lsq([[1, r[2]] for r in tr], [r[1] for r in tr])
    evalm(lambda r: a + b * r[2], data, f"선형 보정 {a:.1f}+{b:.2f}x")
    w6 = lsq([[1] + list(r[3:9]) for r in tr], [r[1] for r in tr])
    evalm(lambda r: w6[0] + sum(wi * xi for wi, xi in zip(w6[1:], r[3:9])), data, "항목 비중+정크 " + " ".join(f"{n}:{w:.2f}" for n, w in zip(names, w6[1:])))
    evalm(lambda r: sum(r[3:9]) / 6, data, "정크 더해 6항목 평균")
print("최근 10일 (날짜 CNN 우리)")
for r in rows[-10:]: print(" ", r[0], round(r[1]), r[2])
