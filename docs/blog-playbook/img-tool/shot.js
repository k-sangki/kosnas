const {chromium}=require('playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1080,height:800},deviceScaleFactor:1});
for(const [f,o] of process.argv.slice(2).map(a=>a.split(':'))){await p.goto('file://'+process.cwd()+'/'+f);await p.waitForTimeout(400);await p.locator('.card').screenshot({path:o});}
await b.close()})();
