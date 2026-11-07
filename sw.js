'use strict';
// عامل الخدمة: يخزّن ملفات المحرك والألعاب مرة واحدة ثم يخدمها بلا شبكة. لا يطلب شيئًا من خارج الأصل ولا يرسل بيانات.
// ربط الإصدار (ومعه ?v= في index.html وفي جلب المحرك لملفاته): غيّر VERSION هنا مع VERSION في engine.js (اختبار tests/run-portable.mjs يتحقق من تطابقهما) فيُنشأ مخزن جديد ويُحذف القديم.
const VERSION = '0.5.2', CACHE = 'cam-games-' + VERSION;
const CORE = ['./', 'index.html', 'engine.js', 'tracker.js', 'draw.js', 'runtime.js', 'launcher.js', 'mic.js', 'sensors.js', 'series.js', 'players.js', 'net.js', 'tv.js', 'pad.js', 'vendor/trystero-nostr.js', 'vendor/qrcode.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'series.jpg', 'games/index.txt'];
addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(CACHE);
  await c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })));
  const names = (await (await c.match('games/index.txt')).text()).split('\n').map(s => s.trim()).filter(s => /^[\w.-]+\.js$/.test(s));
  await c.addAll(names.map(n => new Request('games/' + n, { cache: 'reload' })));
  // أغلفة الألعاب اختيارية: غياب ملف لا يُفشل التثبيت
  await Promise.all(names.map(async n => { try { const u = 'games/' + n.replace(/\.js$/, '.cover.jpg'), r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); } catch (e) { /* */ } }));
  // 0.5.2: لا نتولّى الصفحات المفتوحة بأنفسنا. أول تثبيت (لا عامل قبلنا) يتولّى فورًا؛ أما التحديث فينتظر (waiting) حتى تضغط الصفحة «تحديث»
  // في القائمة (رسالة skip) أو تُغلق كل تبويباتها — فتبقى الصفحة المفتوحة على ملفات نسختها كاملة ولا تختلط ملفات نسختين.
  if (!self.registration.active) await skipWaiting();
})()));
addEventListener('message', e => { if (e.data && e.data.t === 'skip') skipWaiting(); });
addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('cam-games-') && k !== CACHE) await caches.delete(k);
  await clients.claim();
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
