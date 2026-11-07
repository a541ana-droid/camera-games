// التحديث التلقائي (0.5.3) بعامل خدمة حقيقي: خادم صغير خاص بهذا الاختبار يخدم المستودع، ويغيّر sw.js عند الطلب (= نشر نسخة جديدة).
// يتحقق: أول تثبيت بلا إعادة تحميل · النسخة الجديدة تتولّى فورًا ولا تنتظر · لا إعادة تحميل أثناء لعبة ولا في ردهة التلفاز
// · إعادة تحميل تلقائية مرة واحدة عند العودة إلى القائمة أو حالًا إن كانت مفتوحة · صفحات نسخ ما قبل 0.5.2 (مخزن cam-games-0.5.1) تُعاد فتحًا.
// الاستعمال: node tests/run-update.mjs   (لا يحتاج tests/server.mjs؛ يفتح المنفذ UPD_PORT أو 8497)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { chrome, sleep } from './lib.mjs';
const root = new URL('..', import.meta.url).pathname, port = +process.env.UPD_PORT || 8497, BASE = 'http://127.0.0.1:' + port;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let build = 1;
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = normalize(join(root, p === '/' ? 'index.html' : p));
  if (!f.startsWith(root) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  let body = readFileSync(f); if (p === '/sw.js') body = Buffer.concat([body, Buffer.from('\n// build ' + build + '\n')]); // تغيير بايت واحد في sw.js = نسخة جديدة في نظر المتصفح
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
}).listen(port, '127.0.0.1');
const c = await chrome({ port: +process.env.CDP_PORT || 9397 }); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + (i === undefined ? '' : '  ' + JSON.stringify(i))); };
const until = async (expr, ms = 15000) => { for (let t = 0; t < ms; t += 200) { try { if (await c.ev(expr)) return true; } catch (e) { /* أثناء إعادة التحميل */ } await sleep(200); } return false; };
const bar = () => c.ev(`!document.getElementById('upd').hidden`);
const swBuild = () => c.ev(`fetch('sw.js?probe=' + Date.now()).then(()=>navigator.serviceWorker.getRegistration()).then(r => ({ active: !!(r && r.active), waiting: !!(r && r.waiting), ctl: !!navigator.serviceWorker.controller }))`);
try {
  await c.nav(BASE + '/index.html?debug=1', 1500);
  ok('first visit: the service worker installs and takes control at once', await until(`!!navigator.serviceWorker.controller`), await swBuild());
  await c.ev(`window.__mark = 1`); await sleep(800);
  ok('first install: no reload, no update bar', (await c.ev(`window.__mark === 1`)) && !(await bar()));

  // نسخة جديدة تصل أثناء لعبة: تتولّى فورًا، ولا إعادة تحميل حتى نعود إلى القائمة
  await c.ev(`document.getElementById('synth').checked = true; __engine.startGame('games/tilt-maze.js')`); await until(`!!(__engine.state() && __engine.state().ready)`, 10000);
  build = 2; await c.ev(`navigator.serviceWorker.getRegistration().then(r => r.update())`); await sleep(2500);
  const mid = await swBuild();
  ok('new version takes over at once (nothing left waiting)', !mid.waiting && mid.active, mid);
  ok('during a game: no reload, game keeps running', await c.ev(`window.__mark === 1 && !!__engine.state()`));
  await c.ev(`__engine.stopGame('exit'); __engine.show('menu')`);
  ok('back on the menu: the page reloads by itself, once', await until(`window.__mark === undefined && document.querySelectorAll('#list .card').length >= 14`, 10000));

  // نسخة جديدة والقائمة مفتوحة: إعادة تحميل فورية
  await c.ev(`window.__mark = 2`); build = 3; await c.ev(`navigator.serviceWorker.getRegistration().then(r => r.update())`);
  ok('new version while on the menu: reloads by itself', await until(`window.__mark === undefined && !!navigator.serviceWorker.controller`, 12000));
  await sleep(800);

  // ردهة التلفاز مفتوحة: لا إعادة تحميل حتى تُغلق
  await c.ev(`window.__mark = 3; Pads.open()`); await sleep(500);
  build = 4; await c.ev(`navigator.serviceWorker.getRegistration().then(r => r.update())`); await sleep(2500);
  ok('TV lobby open: no reload', await c.ev(`window.__mark === 3`));
  await c.ev(`Pads.close(); __engine.show('menu')`);
  ok('room closed, back on the menu: reloads by itself', await until(`window.__mark === undefined && document.querySelectorAll('#list .card').length >= 14`, 10000));
  await sleep(800);

  // صفحة من نسخة قديمة (لا تعرف إعادة التحميل وحدها): العامل الجديد يعيد فتحها
  await c.ev(`caches.open('cam-games-0.5.1').then(()=>{ window.__mark = 4 })`); await sleep(200);
  build = 5; await c.ev(`navigator.serviceWorker.getRegistration().then(r => r.update())`);
  ok('legacy cache present: the new worker reopens the page', await until(`window.__mark === undefined && !!navigator.serviceWorker.controller`, 12000));
  await sleep(800);
  ok('legacy cache removed', await c.ev(`caches.keys().then(k => !k.includes('cam-games-0.5.1'))`));
  const after = await swBuild();
  ok('after all updates: one active version, nothing waiting, no bar', !after.waiting && after.active && !(await bar()), after);
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); srv.close(); process.exit(fails ? 1 : 0); }
