#!/usr/bin/env python3
"""글 txt → 서식 복사 페이지(Artifact로 발행). 사용: python3 mkcopy.py <txt> <표지png> <계산표png> <out.html>"""
import sys, html, base64, re
txt, cov, tab, out = sys.argv[1:5]
L = open(txt, encoding='utf-8').read().split('\n')
b64 = lambda p: 'data:image/png;base64,' + base64.b64encode(open(p,'rb').read()).decode()
C, T = b64(cov), b64(tab)
def img(src): return f'<p class="pic" style="text-align:center"><img src="{src}" style="width:100%;max-width:720px" alt=""></p>'
P = []; title = L[0].strip(); seen_sum = False; table_done = False
P.append(f'<h2 style="text-align:center;font-size:26px;font-weight:700;line-height:1.45;margin:0 0 14px">{html.escape(title)}</h2>')
i = 1; lines = L[1:]
for k, raw in enumerate(lines):
    s = raw.strip()
    if not s:
        continue
    e = html.escape(s)
    e = re.sub(r'(https?://[^\s<]+)', r'<a href="\1" target="_blank" style="color:#2E7D6B;text-decoration:underline">\1</a>', e)
    if s.startswith('이 포스팅은'):
        P.append(f'<p style="font-size:13px;color:#888888;text-align:center">{e}</p>'); continue
    if s.startswith('✓'):
        P.append(f'<p style="font-size:17px;font-weight:700;line-height:1.7;text-align:center">{e}</p>'); seen_sum = True
        nxt = next((x.strip() for x in lines[k+1:] if x.strip()), '')
        if not nxt.startswith('✓'): P.append('@@COVER@@')
        continue
    if re.match(r'^0[1-5] ', s):
        P.append(f'<h3 style="font-size:21px;font-weight:700;margin:34px 0 10px;line-height:1.5"><span style="color:#2E7D6B">{e[:2]}</span> {e[3:]}</h3>'); continue
    if re.match(r'^[①②③④⑤]', s):
        P.append(f'<p style="font-size:16px;font-weight:700">{e}</p>'); continue
    if s.startswith('- '):
        P.append(f'<p style="font-size:16px;line-height:1.8;padding-left:12px">· {e[2:]}</p>')
        nxt = next((x.strip() for x in lines[k+1:] if x.strip()), '')
        if not nxt.startswith('- ') and not table_done: P.append('@@TABLE@@'); table_done = True
        continue
    if s.startswith('계산식'):
        P.append(f'<p style="font-size:16px;font-style:italic;color:#555555">{e}</p>'); continue
    if s.startswith('👉'):
        P.append(f'<p style="font-size:18px;font-weight:700;text-align:center;margin:18px 0">{e}</p>'); continue
    if s.startswith('※'):
        P.append(f'<p style="font-size:13px;color:#888888">{e}</p>'); continue
    if s.startswith('#'):
        P.append(f'<p style="font-size:14px;color:#2E7D6B">{e}</p>'); continue
    P.append(f'<p style="font-size:16px;line-height:1.8">{e}</p>')
if not table_done: P.append('@@TABLE@@')
def fix(x):
    if not x.startswith('<'): return x
    def add(m):
        st=m.group(1)
        if 'text-align' not in st: st+=';text-align:left'
        if 'color:' not in st.replace('<span',''): st+=';color:#222222'
        return 'style="'+st+'"'
    return re.sub(r'style="([^"]*)"', add, x, count=1)
BL='<p style="font-size:16px;line-height:1.8">&nbsp;</p>'
Q=[]; h3n=0
for x in P:
    if x.startswith('<h3'):
        if h3n: Q += [BL, BL]
        h3n += 1; Q.append(x); Q.append(BL); continue
    if x.startswith('<p') and re.search(r'>[②③④⑤]', x):
        Q.append(BL)
    if x.startswith('<p') and '>※' in x:
        Q += [BL, BL]
    Q.append(x)
P=[fix(x) for x in Q]
body = '\n'.join(P)
plain = body.replace('@@COVER@@','').replace('@@TABLE@@','')
withimg = body.replace('@@COVER@@', img(C)).replace('@@TABLE@@', img(T))
page = open(sys.path[0] + '/copy_tpl.html', encoding='utf-8').read()
page = page.replace('%%TITLE%%', html.escape(title)).replace('%%POST%%', withimg).replace('%%PLAIN%%', plain.replace('</script','<\\/script')).replace('%%C%%', C).replace('%%T%%', T)
open(out, 'w', encoding='utf-8').write(page)
print(out, len(page)//1024, 'KB')
