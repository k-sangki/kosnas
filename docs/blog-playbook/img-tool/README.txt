인포그래픽 만드는 법 (컨테이너가 바뀌었을 때)
1. 스크래치 폴더에서: npm init -y && npm i @fontsource/noto-sans-kr@5.0.18 playwright-core
2. 이 폴더의 base.css, shot.js, cover.html, table.html 을 거기로 복사해 내용 수정
3. node shot.js "cover.html:/mnt/project-files/kosnas/blog/img/YYYY-MM-DD_1_표지.png" "table.html:/mnt/project-files/kosnas/blog/img/YYYY-MM-DD_2_이름.png"
   (chromium 경로: /opt/pw-browsers/chromium-*/chrome-linux/chrome)

== 글 1편을 한 번에 만들기 (2026-10-28) ==
spec/YYYY-MM-DD_N.json 을 쓰고: python3 build.py spec/... (info 폴더에서 실행, base.css·shot.js·node_modules 필요)
결과: img/YYYY-MM-DD_N_표지.png, img/YYYY-MM-DD_N_계산표.png, YYYY-MM-DD_N_붙여넣기.html(이미지 포함)
spec 형식:
{"txt":"2026-10-29_1_주제.txt","capture":"대시보드 SOXX 카드",
 "cover":{"title":"제목 줄<br><em>노랑 강조</em>","big":"-0.5%","cap":"큰 숫자 설명<br>둘째 줄","list":["① …","② …","③ …"]},
 "table":{"kicker":"예시 계산 · 가정","title":"표 제목 <em>강조</em>","head":["열1","열2"],"rows":[["+1%","-0.5%"]],"color_plus":true,"note":"계산식<br>한 줄 해석"},
 "after":{"cover":"표지를 넣을 문단 시작 글자","table":"계산표 뒤 문단 시작 글자","product":"상품 여담 문단 시작","capture":"캡처 뒤 문단 시작"}}
'-'로 시작하는 칸은 빨강, '+'는 민트(color_plus:false면 '+' 색 없음). 문단을 못 찾으면 종료 코드 1.
