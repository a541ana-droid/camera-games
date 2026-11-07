'use strict';
// عامل الخدمة: يخزّن ملفات المحرك والألعاب مرة واحدة ثم يخدمها بلا شبكة. لا يطلب شيئًا من خارج الأصل ولا يرسل بيانات.
// ربط الإصدار (ومعه ?v= في index.html وفي جلب المحرك لملفاته): غيّر VERSION هنا مع VERSION في engine.js (اختبار tests/run-portable.mjs يتحقق من تطابقهما) فيُنشأ مخزن جديد ويُحذف القديم.
const VERSION = '0.7.0', CACHE = 'cam-games-' + VERSION;
const CORE = ['./', 'index.html', 'engine.js', 'tracker.js', 'draw.js', 'runtime.js', 'launcher.js', 'mic.js', 'sensors.js', 'series.js', 'players.js', 'net.js', 'tv.js', 'pad.js', 'vendor/trystero-nostr.js', 'vendor/qrcode.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'quizpacks.js', 'home.js', 'games/index.txt', 'games/quiz/index.json', 'art/league.cover.jpg'];
addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
  const names = (await (await c.match('games/index.txt')).text()).split('\n').map(s => s.trim()).filter(s => /^[\w.-]+\.js$/.test(s));
  await c.addAll(names.map(n => new Request('games/' + n, { cache: 'reload' })));
  // حزم الأسئلة (0.6.1): بيانات JSON تُخزَّن كلها فتعمل المسابقات بلا شبكة
  const packs = ((await (await c.match('games/quiz/index.json')).json()).packs || []).map(p => p && p.id).filter(id => /^[a-z]{2,8}$/.test(id || ''));
  await c.addAll(packs.map(id => new Request('games/quiz/' + id + '.json', { cache: 'reload' })));
  // أغلفة الألعاب اختيارية: غياب ملف لا يُفشل التثبيت
  await Promise.all(names.map(async n => { try { const u = 'games/' + n.replace(/\.js$/, '.cover.jpg'), r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); } catch (e) { /* */ } }));
  // 0.5.3: التحديث تلقائي — العامل الجديد يتولّى فورًا، والصفحة (engine.js) تعيد التحميل وحدها متى كانت في القائمة، لا أثناء لعبة أو ردهة.
  await skipWaiting();
})()));
addEventListener('message', e => { if (e.data && e.data.t === 'skip') skipWaiting(); });
addEventListener('activate', e => e.waitUntil((async () => {
  let legacy = false; // نسخ ما قبل 0.5.3 لا تعيد التحميل وحدها: نعيد فتح صفحاتها مرة واحدة لتنتقل إلى النسخة الجديدة
  for (const k of await caches.keys()) if (k.startsWith('cam-games-') && k !== CACHE) { if (/^cam-games-0\.([0-4]\.|5\.[012]$)/.test(k)) legacy = true; await caches.delete(k); }
  await clients.claim();
  if (legacy) for (const c of await clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
})()));
addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(r, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(r); } catch (err) { return r.mode === 'navigate' ? (await caches.match('index.html')) || Response.error() : Response.error(); }
  })());
});
