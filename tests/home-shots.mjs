// لقطات الرئيسية 0.7.0 للمراجعة: node tests/home-shots.mjs [مجلد]  (CDP_PORT منفصل إن شغّلت غيره بالتوازي)
// كل الشاشات على جوال 375×812 وتلفاز 1920×1080، وتطبع أي خطأ في الصفحة أو عنصر يخرج عن عرض الشاشة.
import { writeFileSync, mkdirSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const OUT = process.argv[2] || new URL('./shots/0.7', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const c = await chrome({ size: '1440,900' }); const files = [];
const metrics = (w, h, mobile) => c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
const shot = async n => { writeFileSync(OUT + '/' + n + '.png', Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64')); files.push(n + '.png'); };
// عناصر ظاهرة تخرج عن عرض الشاشة أفقيًا (خلل تخطيط)
const off = () => c.ev(`(()=>{const W=innerWidth; return [...document.querySelectorAll('body *')].filter(e=>{if(!e.offsetParent&&getComputedStyle(e).position!=='fixed')return false; if(e.closest('.cats,.chips,[hidden]'))return false; const r=e.getBoundingClientRect(); return r.width>0&&(r.right>W+1||r.left<-1)}).slice(0,5).map(e=>(e.id||e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().left)+'..'+Math.round(e.getBoundingClientRect().right))})()`);
const report = async n => { const o = await off(); if (o.length) console.log('OFFSCREEN', n, o); };
try {
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await metrics(375, 812, true); await c.nav(BASE + '/index.html?nosw=1', 300); await c.ev(`localStorage.clear()`); await c.nav(BASE + '/index.html?nosw=1', 2500);
  await c.ev(`document.getElementById('inst').hidden=true`); // شريط التثبيت يظهر لمرة؛ اللقطة للرئيسية نفسها
  await shot('01-home-375-top'); await report('home');
  await c.ev(`document.getElementById('menu').scrollTop=900`); await sleep(300); await shot('02-home-375-scrolled');
  await c.ev(`document.getElementById('menu').scrollTop=99999`); await sleep(300); await shot('03-home-375-bottom'); await report('home-bottom');
  for (const [k, n] of [['camera', '04-tab-camera'], ['pads', '05-tab-pads'], ['device', '06-tab-device'], ['quiz', '07-tab-quiz']]) { await c.ev(`document.getElementById('menu').scrollTop=0; document.getElementById('cat-${k}').click()`); await sleep(300); await shot(n); await report(n); }
  await c.ev(`document.getElementById('menu').scrollTop=0; document.getElementById('cat-all').click()`);
  await c.ev(`__engine.home.open('games/balloon-bop.js')`); await sleep(500); await shot('08-sheet-camera-375'); await report('sheet');
  await c.ev(`__engine.home.open('games/pad-stars.js')`); await sleep(500); await shot('09-sheet-pads-375');
  await c.ev(`__engine.home.close(); document.getElementById('serBtn').click()`); await sleep(1500); await shot('10-league-375'); await report('league');
  await c.ev(`document.getElementById('serBack').click()`); await sleep(300);
  await c.ev(`document.getElementById('tvGuideBtn').click()`); await sleep(300); await shot('11-tv-guide-375'); await report('guide');
  await c.ev(`document.getElementById('menu').scrollTop=700`); await sleep(200); await shot('12-tv-guide-375-ways');
  await c.ev(`CGHome.go('home'); document.getElementById('setBtn').click()`); await sleep(400); await c.ev(`document.getElementById('gContact').scrollIntoView({block:'center'})`); await sleep(200); await shot('13-settings-about-contact-375'); await report('settings');
  await c.ev(`document.getElementById('setClose').click(); document.getElementById('tabMake').click()`); await sleep(300); await shot('14-make-375');
  await c.ev(`CGHome.go('home'); QuizPacks.open()`); await sleep(300); await shot('15-family-quiz-375');
  await c.ev(`CGHome.go('home'); Pads.open()`); await sleep(1500); await shot('16-tv-lobby-375'); await report('lobby');
  await c.ev(`document.getElementById('tvHow').click()`); await sleep(400); await shot('17-tv-lobby-guide-375');
  await c.ev(`document.querySelector('#guideDlg .back').click(); Pads.close(); __engine.show('menu')`);
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await c.nav(BASE + '/index.html?nosw=1', 2000); await c.ev(`document.getElementById('inst').hidden=true`); await shot('18-home-375-light');
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await metrics(1920, 1080, false); await c.nav(BASE + '/index.html?nosw=1', 2500); await c.ev(`document.getElementById('inst').hidden=true`); await shot('19-home-1920'); await report('home-1920');
  await c.ev(`__engine.home.open('games/freeze.js')`); await sleep(500); await shot('20-sheet-1920'); await c.ev(`__engine.home.close()`);
  await c.ev(`Pads.open()`); await sleep(1500); await shot('21-tv-lobby-1920'); await c.ev(`document.getElementById('tvHow').click()`); await sleep(400); await shot('22-tv-lobby-guide-1920');
  await c.ev(`document.querySelector('#guideDlg .back').click(); Pads.close(); __engine.show('menu')`);
  await metrics(820, 1180, true); await c.nav(BASE + '/index.html?nosw=1', 2500); await c.ev(`document.getElementById('inst').hidden=true`); await shot('23-home-tablet-820'); await report('tablet');
  const errs = c.log.filter(l => /exception|error/i.test(l)); console.log(errs.length ? errs.slice(0, 8) : 'no page errors'); console.log(files.length + ' shots in ' + OUT);
} finally { c.close(); process.exit(0); }
