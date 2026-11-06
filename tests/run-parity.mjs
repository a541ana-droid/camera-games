// تكافؤ الرسم: مشهد Canvas2D واحد (tests/games/draw-parity.js) يُرسم (أ) عبر Worker ← مخزن أوامر ← المضيف، و(ب) مباشرةً على canvas حقيقي. يُقارَن البكسل بالبكسل.
import { writeFileSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const SHOTS = process.env.SHOTS || (await import('node:os')).tmpdir();
const a = await chrome({ port: 9353 }), b = await chrome({ port: 9354 });
let fail = 0;
try {
  await a.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto')); await a.ev(`document.getElementById('synth').checked=false`);
  await a.ev(`__engine.startGame('tests/games/draw-parity.js')`); await sleep(2500);
  const st = await a.ev(`(()=>{const s=__engine.state(); const c=document.getElementById('cv'); return {ok:!!s&&s.ready, mode:s&&s.mode, frames:s&&s.frames, cmdN:s&&s.cmdN, w:c.width, h:c.height, dpr:devicePixelRatio, ov:document.getElementById('ovT').textContent}})()`);
  console.log('host', JSON.stringify(st));
  const w = Math.round(st.w / st.dpr), h = Math.round(st.h / st.dpr);
  const hostUrl = await a.ev(`document.getElementById('cv').toDataURL('image/png')`);
  await b.nav(BASE + '/tests/parity-ref.html', 500);
  const imgUrl = await b.ev(`(async()=>{const r=await fetch('/tests/games/spr.png'); const bl=await r.blob(); const fr=new FileReader(); const u=await new Promise(res=>{fr.onload=()=>res(fr.result); fr.readAsDataURL(bl)}); return draw('/tests/games/draw-parity.js', ${st.w}, ${st.h}, {spr:u})})()`);
  writeFileSync(SHOTS + '/parity-ref.png', Buffer.from(imgUrl.split(',')[1], 'base64')); writeFileSync(SHOTS + '/parity-host.png', Buffer.from(hostUrl.split(',')[1], 'base64'));
  const cmp = await a.ev(`(async()=>{const load=u=>new Promise((res,no)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=no; i.src=u}); const A=await load(${JSON.stringify(hostUrl)}), B=await load(${JSON.stringify(imgUrl)});
    const d=i=>{const c=document.createElement('canvas'); c.width=i.width; c.height=i.height; const x=c.getContext('2d'); x.drawImage(i,0,0); return x.getImageData(0,0,c.width,c.height).data;}; const p=d(A), q=d(B); let diff=0, big=0, maxd=0; const n=p.length/4;
    for(let i=0;i<p.length;i+=4){const m=Math.max(Math.abs(p[i]-q[i]),Math.abs(p[i+1]-q[i+1]),Math.abs(p[i+2]-q[i+2]),Math.abs(p[i+3]-q[i+3])); if(m>0)diff++; if(m>24)big++; if(m>maxd)maxd=m;} return {w:A.width,h:A.height,pixels:n,differing:diff,bigDiff:big,maxDelta:maxd, pctBig:+(100*big/n).toFixed(4)}})()`);
  console.log('parity', JSON.stringify(cmp));
  if (!(cmp.pctBig < 0.5)) fail = 1;
} catch (e) { console.log('ERR', e); fail = 1; } finally { a.close(); b.close(); process.exit(fail); }
