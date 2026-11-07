// شريط «نسخة جديدة جاهزة — تحديث» (0.5.2) بعامل خدمة حقيقي: خادم صغير خاص بهذا الاختبار يخدم المستودع، ويغيّر sw.js عند الطلب (= نشر نسخة جديدة).
// يتحقق: أول تثبيت بلا شريط · النسخة الجديدة تنتظر ولا تتولّى وحدها · الشريط في القائمة فقط (لا أثناء لعبة ولا في ردهة التلفاز) · لا إعادة تحميل تلقائية أبدًا
// · «لاحقًا» يخفيه · «تحديث» يفعّل النسخة الجديدة ويعيد التحميل مرة واحدة ثم يختفي الشريط.
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
  await sleep(500); ok('first install shows no update bar', !(await bar()));
  await c.ev(`window.__mark = 1`);

  // نسخة جديدة تصل أثناء لعبة: لا شريط ولا إعادة تحميل
  await c.ev(`document.getElementById('synth').checked = true; __engine.startGame('games/tilt-maze.js')`); await until(`!!(__engine.state() && __engine.state().ready)`, 10000);
  build = 2; await c.ev(`navigator.serviceWorker.getRegistration().then(r => r.update())`);
  ok('new version installs and WAITS (does not take over the open page by itself)', await until(`navigator.serviceWorker.getRegistration().then(r => !!r.waiting)`), await swBuild());
  await sleep(800);
  ok('during a game: no update bar and no reload', !(await bar()) && (await c.ev(`window.__mark === 1 && !!__engine.state()`)));
  await c.ev(`__engine.stopGame('exit'); __engine.show('menu')`); await sleep(400);
  ok('back on the menu: the bar appears («نسخة جديدة جاهزة» + «تحديث»)', (await bar()) && (await c.ev(`/نسخة جديدة جاهزة/.test(document.getElementById('upd').textContent) && document.getElementById('updGo').textContent === 'تحديث'`)));
  const geo = await c.ev(`(()=>{const r=document.getElementById('upd').getBoundingClientRect(), g=document.getElementById('updGo').getBoundingClientRect(); return {bottom: innerHeight - r.bottom, h: Math.round(g.height), inside: r.left >= 0 && r.right <= innerWidth}})()`);
  ok('bar sits at the bottom, inside the screen, «تحديث» ≥ 48px tall', geo.bottom >= 8 && geo.bottom < 60 && geo.h >= 48 && geo.inside, geo);

  // ردهة التلفاز والإعدادات المفتوحة
  await c.ev(`Pads.open()`); await sleep(500);
  ok('TV lobby: no update bar (a room is open)', !(await bar()));
  await c.ev(`Pads.close(); __engine.show('menu')`); await sleep(300);
  ok('room closed, back on the menu: bar again', await bar());

  // «لاحقًا»
  await c.ev(`document.getElementById('updNo').click()`); await sleep(200);
  ok('«لاحقًا» hides the bar for this visit, nothing reloads', !(await bar()) && (await c.ev(`window.__mark === 1`)));
  await c.ev(`__engine.startGame('games/tilt-maze.js')`); await sleep(800); await c.ev(`__engine.stopGame('exit'); __engine.show('menu')`); await sleep(300);
  ok('…and stays hidden after another game', !(await bar()));

  // «تحديث»: يُعاد التحميل مرة واحدة على النسخة الجديدة
  await c.nav(BASE + '/index.html?debug=1', 1500); // زيارة جديدة: النسخة ما زالت تنتظر
  ok('next visit: the waiting version is still waiting and the bar is offered', (await until(`!document.getElementById('upd').hidden`, 8000)) && (await swBuild()).waiting);
  await c.ev(`window.__mark = 2; document.getElementById('updGo').click()`);
  ok('«تحديث» activates the new version and reloads once', await until(`window.__mark === undefined && !!navigator.serviceWorker.controller`, 12000));
  await sleep(1200); const after = await swBuild();
  ok('after the update: no waiting version, no bar', !after.waiting && after.active && !(await bar()), after);
  ok('page works after the update (menu built)', await c.ev(`document.querySelectorAll('#list .card').length >= 14`));
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); srv.close(); process.exit(fails ? 1 : 0); }
