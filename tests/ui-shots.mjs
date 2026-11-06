// لقطات الواجهة: قائمة، إعدادات، بطاقة معطّلة، لعبة، نهاية لعبة، إعداد الدوري وترتيبه — داكن/فاتح × 375/1024/1920. تُحفظ في tests/shots/ui-*.png
import { writeFileSync, mkdirSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const OUT = new URL('./shots', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const c = await chrome({ size: '1920,1080' });
const sizes = [[375, 812, 'phone'], [1024, 768, 'tablet'], [1920, 1080, 'tv']], only = process.env.ONLY;
const shot = async n => { await sleep(350); writeFileSync(`${OUT}/ui-${n}.png`, Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64')); };
const click = async sel => { const p = await c.ev(`(()=>{const b=document.querySelector(${JSON.stringify(sel)}); b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]})()`); for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: p[0], y: p[1], button: 'left', clickCount: 1 }); await sleep(200); };
const GAME = `// @title صيد الألوان
// @accent #ffc145
// @engine 0.2
// @capabilities camera.color hud
defineGame({ init(api) { this.api = api; api.hud.set({ score: '03', title: 'ابحث عن اللون الأحمر', time: '12' }); }, update(dt, t) { if (t > 1.2 && !this.d) { this.d = 1; this.api.end({ score: 87, text: 'أحسنت! أنهيت كل الألوان' }); } }, render(c, w, h) { c.fillStyle = '#d33'; c.beginPath(); c.arc(w / 2, h / 2, Math.min(w, h) / 5, 0, 7); c.fill(); } });`;
for (const scheme of ['dark', 'light']) for (const [w, h, nm] of sizes) {
  const tag = `${nm}-${scheme}`; if (only && !tag.includes(only)) continue;
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await c.nav(BASE + '/index.html?nosw=1', 1500); await shot(`menu-${tag}`);
  await click('#setBtn'); await c.ev('window.scrollTo(0,0);document.querySelector(".view").scrollTop=0'); await shot(`settings-${tag}`);
  await c.nav(BASE + '/index.html?debug=1&sensors=0&nosw=1', 1500); await c.ev('document.querySelector("#list .card:disabled").scrollIntoView({block:"center"})'); await shot(`disabled-${tag}`);
  await c.nav(BASE + '/index.html?debug=1&nosw=1', 1500); await c.ev(`document.getElementById('synth').checked=true`);
  await c.ev(`__engine.startGame('games/mole-air.js')`); await sleep(2500); await shot(`game-${tag}`);
  await c.ev(`__engine.startGame({text:${JSON.stringify(GAME)}})`); await sleep(2600); await shot(`gameover-${tag}`);
  await c.nav(BASE + '/index.html?debug=1&nosw=1', 1500); await click('#serBtn'); await sleep(500); await shot(`series-setup-${tag}`);
  await c.nav(BASE + '/index.html?debug=1&nosw=1', 1500); await c.ev(`document.getElementById('synth').checked=true; Series.start({names:['سالم','فهد'],games:['tests/games/s-multi.js'],rounds:2})`); await sleep(600);
  await click('#ser .pri'); await sleep(2500); await shot(`series-standings-${tag}`);
}
console.log('done'); c.close(); process.exit(0);
