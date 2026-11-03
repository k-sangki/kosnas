#!/usr/bin/env python3
"""글 1편 = spec JSON 1개 → 표지·계산표 PNG + 붙여넣기 HTML.
사용: python3 build.py /mnt/project-files/kosnas/blog/spec/2026-10-29_1.json"""
import json, sys, os, base64, html, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
BLOG = '/mnt/project-files/kosnas/blog'
sp = json.load(open(sys.argv[1], encoding='utf-8'))
tag = os.path.splitext(os.path.basename(sys.argv[1]))[0]          # 2026-10-29_1
foot = '<div class=foot><span>kosnas.com</span><span>%s</span></div>'
c, t = sp['cover'], sp['table']
cover = ('<html><head><link rel=stylesheet href=base.css></head><body><div class=card>'
  f'<div class=kicker>{c.get("kicker","코스나스 · 시장을 읽는 법")}</div><h1>{c["title"]}</h1>'
  f'<div class=big>{c["big"]}</div><div class=cap>{c["cap"]}</div><div class=list>'
  + ''.join(f'<div>{x}</div>' for x in c['list']) + '</div>' + foot % '매수·매도 권유가 아닙니다' + '</div></body></html>')
def cell(x):
    x = str(x); cls = ' class=n' if x.startswith('-') else (' class=p' if x.startswith('+') and t.get('color_plus', True) else '')
    return f'<td{cls}>{x}</td>'
rows = ''.join('<tr>' + ''.join(cell(x) for x in r) + '</tr>' for r in t['rows'])
table = ('<html><head><link rel=stylesheet href=base.css></head><body><div class=card>'
  f'<div class=kicker>{t["kicker"]}</div><h1 style="font-size:60px">{t["title"]}</h1><table><tr>'
  + ''.join(f'<th>{h}</th>' for h in t['head']) + f'</tr>{rows}</table><div class=note>{t["note"]}</div>'
  + foot % '수치는 이해를 돕기 위한 가정입니다' + '</div></body></html>')
open(f'{HERE}/_c.html', 'w', encoding='utf-8').write(cover)
open(f'{HERE}/_t.html', 'w', encoding='utf-8').write(table)
png1, png2 = f'{BLOG}/img/{tag}_표지.png', f'{BLOG}/img/{tag}_계산표.png'
subprocess.run(['node', 'shot.js', f'_c.html:{png1}', f'_t.html:{png2}'], cwd=HERE, check=True)
# 붙여넣기 HTML: after = {이미지/표시: 그 문단 시작 글자}
def img(p): return f'<p><img src="data:image/png;base64,{base64.b64encode(open(p,"rb").read()).decode()}" style="width:100%;max-width:720px"></p>'
mark = lambda s: f'<p style="color:#c00;font-weight:700">{s}</p>'
after = sp['after']; inserts = {after['cover']: img(png1), after['table']: img(png2)}
if after.get('product'): inserts[after['product']] = mark('(여기에 쇼핑커넥트 상품 링크)')
if after.get('capture'): inserts[after['capture']] = mark(f'(여기에 코스나스 캡처 — {sp.get("capture","")})')
txt = f'{BLOG}/{sp["txt"]}'; lines = open(txt, encoding='utf-8').read().split('\n')
out, used = [], set()
for i, l in enumerate(lines):
    e = html.escape(l)
    if i == 0: out.append(f'<h2>{e}</h2>'); continue
    if not l.strip(): continue
    out.append(f'<h3>{e}</h3>' if l[:2] in ('01','02','03','04','05') and l[2:3] == ' ' else f'<p>{e}</p>')
    for k, v in inserts.items():
        if k not in used and l.startswith(k): out.append(v); used.add(k)
miss = set(inserts) - used
doc = ('<!doctype html><html><head><meta charset="utf-8"><title>' + html.escape(lines[0]) +
  '</title><style>body{font-family:sans-serif;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.7}</style></head><body>'
  + '\n'.join(out) + '</body></html>')
paste = f'{BLOG}/{tag}_붙여넣기.html'; open(paste, 'w', encoding='utf-8').write(doc)
print(png1, png2, paste, sep='\n')
if miss: print('경고: 문단을 못 찾음 →', miss); sys.exit(1)
