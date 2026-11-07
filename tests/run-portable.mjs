// قابلية النقل والخصوصية: عامل الخدمة والعمل بلا شبكة، تفضيل عرض الكاميرا العام، وإخفاء الصورة أثناء الفتح. كاميرا Chrome المزيفة (بلا مصدر DebugSynth).
import { readFileSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome({ fake: true }); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + (i === undefined ? '' : '  ' + JSON.stringify(i))); };
const wait = async (expr, ms = 8000) => { for (let t = 0; t < ms; t += 200) { if (await c.ev(expr)) return true; await sleep(200); } return false; };
const root = new URL('..', import.meta.url).pathname, rd = f => readFileSync(root + f, 'utf8');
try {
  // ثابت: تطابق الإصدار، وCSP لم تُفتح إلا بما يلزم
  const ver = /VERSION = '([\d.]+)'/.exec(rd('engine.js'))[1], swVer = /VERSION = '([\d.]+)'/.exec(rd('sw.js'))[1];
  ok('sw.js VERSION == engine.js VERSION', ver === swVer, { ver, swVer });
  { const core = /const CORE = \[([^\]]*)\]/.exec(rd('sw.js'))[1], srcs = [...rd('index.html').matchAll(/<script src="([^"?]+)/g)].map(m => m[1]), miss = srcs.filter(s => !core.includes("'" + s + "'"));
    ok('every <script> of index.html is precached by sw.js', !miss.length, { miss }); }
  const csp = /Content-Security-Policy" content="([^"]+)"/.exec(rd('index.html'))[1];
  { // connect-src = 'self' + عدّاد الزيارات المعلن + مرحّلات Nostr المثبّتة في net.js بالضبط (للمصافحة فقط)؛ ولا شيء غيرها في أي توجيه آخر
    const relays = /const RELAYS = \[([^\]]*)\]/.exec(rd('net.js'))[1].match(/'([^']+)'/g).map(x => 'wss://' + x.slice(1, -1)).sort();
    const conn = (/connect-src ([^;]+)/.exec(csp) || [, ''])[1].trim().split(/\s+/), rest = csp.replace(/connect-src [^;]+;?/, '');
    const extra = conn.filter(x => x !== "'self'" && x !== 'https://abacus.jasoncameron.dev' && !relays.includes(x)), missing = relays.filter(r => !conn.includes(r));
    ok('CSP: connect-src = self + العدّاد + مرحّلات net.js فقط، ولا مصادر خارجية في غيره، بلا unsafe-eval', conn[0] === "'self'" && !extra.length && !missing.length && !/unsafe-eval|https?:|wss?:|\*/.test(rest) && /default-src 'none'/.test(csp), { extra, missing }); }

  await c.send('Network.enable');
  await c.nav(BASE + '/index.html', 2500);
  ok('عامل الخدمة سُجّل وفعّال', await wait(`navigator.serviceWorker.ready.then(r=>!!r.active)`));
  const keys = await c.ev(`caches.keys()`); ok('مخزن بإصدار المحرك', keys.length === 1 && keys[0] === 'cam-games-' + ver, keys);
  const cached = await c.ev(`caches.open(${JSON.stringify('cam-games-' + ver)}).then(x=>x.keys()).then(k=>k.map(r=>new URL(r.url).pathname))`);
  const need = ['/index.html', '/engine.js', '/tracker.js', '/draw.js', '/runtime.js', '/launcher.js', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/games/index.txt', ...rd('games/index.txt').split('\n').filter(Boolean).map(n => '/games/' + n)];
  ok('كل الملفات وكل الألعاب مخزّنة', need.every(p => cached.includes(p)), need.filter(p => !cached.includes(p)));
  ok('manifest يُجلب بلا انتهاك CSP', !c.log.some(l => /Content Security Policy|violat/i.test(l)), c.log.slice(0, 3));

  // قطع الشبكة ثم إعادة التحميل
  await c.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await c.ev(`localStorage.removeItem('engine-camview')`);
  await c.nav(BASE + '/index.html', 2500);
  const cards = await c.ev(`[...document.querySelectorAll('#list .card')].map(b=>({t:b.querySelector('b').textContent,badge:!!b.querySelector('.badge')}))`);
  ok('بلا شبكة: القائمة تُحمَّل بكل الألعاب', cards.length === rd('games/index.txt').split('\n').filter(s => s && !s.startsWith('zz-')).length, cards);
  const byT = t => cards.find(x => x.t.includes(t));
  ok('شارة الكاميرا: ظهرت في «فقاعات» ولم تظهر في «صيد الألوان» و«تجمّد»', byT('صيد') && !byT('صيد').badge && byT('تجمّ') && !byT('تجمّ').badge && cards.some(x => x.badge));

  // مراقبة صف الصورة: لا ظهور قبل جاهزية اللعبة
  await c.ev(`window.__obs=[];new MutationObserver(()=>{const s=__engine.state();__obs.push({off:document.getElementById('cam').classList.contains('off'),cam:__engine.cameraOpen(),ready:!!(s&&s.ready),alive:!!(s&&s.alive)})}).observe(document.getElementById('cam'),{attributes:true,attributeFilter:['class']})`);
  const run = async (g, ms = 1500) => { await c.ev(`__engine.startGame('${g}')`); const up = await wait(`!!(__engine.state()&&__engine.state().ready)&&__engine.cameraOpen()`, 10000); await sleep(ms); return up; };
  ok('بلا شبكة: صيد الألوان تعمل وتفتح الكاميرا', await run('games/color-hunt.js'));
  ok('صيد الألوان: الصورة مخفية + مؤشر «لا تُعرض ولا تغادر»', !(await c.ev(`__engine.camShown()`)) && (await c.ev(`document.getElementById('camind').textContent`)).includes('لا تُعرض ولا تغادر') && !(await c.ev(`document.getElementById('camind').hidden`)));
  await c.ev(`__engine.stopGame('exit')`); await sleep(300);
  ok('بعد الخروج: المؤشر مخفي والكاميرا مغلقة', (await c.ev(`document.getElementById('camind').hidden`)) && !(await c.ev(`__engine.cameraOpen()`)));

  ok('بلا شبكة: فقاعات (تعرض الصورة بطلبها)', await run('games/bubble-mirror.js'));
  ok('فقاعات: الصورة ظاهرة + مؤشر «تُعرض على شاشتك فقط»', (await c.ev(`__engine.camShown()`)) && (await c.ev(`document.getElementById('camind').textContent`)).includes('على شاشتك فقط'));
  await c.ev(`__engine.stopGame('exit')`); await sleep(300);

  // الإعداد العام: إطفاؤه يُتجاهل معه showCamera(true)
  await c.ev(`(()=>{const k=document.getElementById('camview');k.checked=false;k.dispatchEvent(new Event('change'))})()`);
  ok('الإعداد يُحفظ في localStorage', (await c.ev(`localStorage.getItem('engine-camview')`)) === '0');
  await run('games/bubble-mirror.js');
  ok('الإعداد مطفأ: showCamera(true) تُتجاهل والمؤشر «لا تُعرض»', !(await c.ev(`__engine.camShown()`)) && (await c.ev(`document.getElementById('cam').classList.contains('off')`)) && (await c.ev(`document.getElementById('camind').textContent`)).includes('لا تُعرض'));
  await c.ev(`__engine.stopGame('exit')`); await sleep(300);
  const obs = await c.ev(`window.__obs||[]`);
  await c.nav(BASE + '/index.html', 2000);
  ok('الإعداد يبقى بعد إعادة التحميل', (await c.ev(`document.getElementById('camview').checked`)) === false);
  await c.ev(`localStorage.removeItem('engine-camview')`);

  ok('الصورة لم تُعرض قط قبل أن يعمل كود اللعبة (أثناء فتح الكاميرا)', obs.length > 0 && !obs.some(o => !o.off && !o.alive), obs);
  await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
