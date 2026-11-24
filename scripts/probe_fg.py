"""일회성: 우리 미장 공탐 추정과 CNN 값을 날짜별로 견준다(화면에는 쓰지 않음)."""
import json, sys, urllib.request
sys.path.insert(0, "collector")
import fear_greed as f
f.CAL_A, f.CAL_B = 0.0, 1.0  # 보정 전 원래 평균으로 비교

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
junk = {x["d"]: x for x in f.series(hyg, ief, None)}
rsp, spy = f.yahoo("RSP"), f.yahoo("SPY")
breadth = {x["d"]: x for x in f.series(rsp, spy, None)}  # 동일가중 대 시총가중: safe 항목 = 20일 상대수익 백분위  # 정크본드 대 국채: safe 항목을 쓴다
rows = []
for d in sorted(ours):
    if d in cnn and d in junk and d in breadth:
        p = ours[d]["parts"]
        rows.append((d, cnn[d], ours[d]["score"], p["momentum"], p["high52"], p["rsi"], p["volatility"], p["safe"], junk[d]["parts"]["safe"], breadth[d]["parts"]["safe"], breadth[d]["parts"]["momentum"]))
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
names = ["momentum", "high52", "rsi", "volatility", "safe", "junk", "breadth20", "breadth125"]
c = [r[1] for r in rows]; o = [r[2] for r in rows]
print(f"전체 상관 {corr(c, o):.3f} 평균차(우리-CNN) {st.mean(x - y for x, y in zip(o, c)):+.1f} 평균절대차 {st.mean(abs(x - y) for x, y in zip(o, c)):.1f}")
for i, nm in enumerate(names):
    print(f"  항목 {nm} 상관 {corr(c, [r[3 + i] for r in rows]):.3f}")
cut = int(len(rows) * 0.75); tr, te = rows[:cut], rows[cut:]
def band(v): return 0 if v < 25 else 1 if v < 45 else 2 if v <= 55 else 3 if v <= 75 else 4
a, b = lsq([[1, r[2]] for r in tr], [r[1] for r in tr])
# 분위수 맞춤: 학습 구간의 우리 값 분포를 CNN 값 분포에 겹친다
so = sorted(r[2] for r in tr); sc = sorted(r[1] for r in tr)
def qmap(x):
    import bisect
    k = bisect.bisect_left(so, x) / max(1, len(so) - 1)
    return sc[min(len(sc) - 1, int(k * (len(sc) - 1)))]
w = lsq([[1] + list(r[3:11]) for r in tr], [r[1] for r in tr])
print("회귀 비중", " ".join(f"{n}:{x:.2f}" for n, x in zip(["상수"] + names, w)))
reg = lambda r: w[0] + sum(wi * xi for wi, xi in zip(w[1:], r[3:11]))
avg7 = lambda r: (sum(r[3:8]) + r[9] + r[10]) / 7
a7, b7 = lsq([[1, avg7(r)] for r in tr], [r[1] for r in tr])
models = {"그대로": lambda r: r[2], "직선": lambda r: a + b * r[2], "폭포함평균": avg7, "폭포함직선": lambda r: a7 + b7 * avg7(r), "회귀": reg}
for lab, data in (("학습", tr), ("검증", te)):
    print(lab)
    for nm, m in models.items():
        for bd in range(5):
            sel = [r for r in data if band(r[1]) == bd]
            if not sel: continue
            print(f"  {nm} CNN구간{bd} n={len(sel)} 평균차 {st.mean(m(r) - r[1] for r in sel):+.1f} 평균절대차 {st.mean(abs(m(r) - r[1]) for r in sel):.1f}")
        p = [m(r) for r in data]; t = [r[1] for r in data]
        print(f"  {nm} 전체 평균절대차 {st.mean(abs(x - y) for x, y in zip(p, t)):.1f} 구간일치 {st.mean(1 if band(x) == band(y) else 0 for x, y in zip(p, t)) * 100:.0f}%")
print("최근 15일 날짜 CNN 그대로 직선 폭포함평균 폭포함직선 회귀")
for r in rows[-15:]: print(" ", r[0], round(r[1]), r[2], round(a + b * r[2]), round(avg7(r)), round(a7 + b7 * avg7(r)), round(reg(r)))
# 연도별 평균차
from collections import defaultdict
g = defaultdict(list)
for r in rows: g[r[0][:7]].append((r[2] - r[1], avg7(r) - r[1], a7 + b7 * avg7(r) - r[1], reg(r) - r[1]))
for k in sorted(g): print(" 월", k, " ".join(f"{st.mean(x[i] for x in g[k]):+.1f}" for i in range(4)))
