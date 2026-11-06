'use strict';
// أدوات التجربة فقط (تُحمَّل عند ?debug=1): مصدر فيديو اصطناعي + مشغّل اختبارات. ليست جزءًا من المحرك الإنتاجي.
window.DebugSynth = (() => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d');
  const st = { blobs: [], hand: null, full: null }; let iv = 0, stream = null;
  // blobs: [{c:'#e5484d', x:.5, y:.5, r:.12, ax:.1, ay:0, hz:1}] (ax/ay سعة الذبذبة بنسبة العرض/الارتفاع، hz تردّدها)  hand: {x,y,r} يتحرك (يُحاكي يدًا)  full: لون يملأ الإطار
  function draw() {
    x.fillStyle = st.full || '#3a3a3a'; x.fillRect(0, 0, 320, 240);
    if (!st.full) { x.fillStyle = '#444'; for (let i = 0; i < 6; i++) x.fillRect(i * 55, 0, 3, 240); }
    const t = performance.now() / 1000, pos = (b, k) => b[k] + (b['a' + k] || 0) * Math.sin(t * (b.hz || 0) * 6.2832 + (b.ph || 0)); // ax/ay/hz: ذبذبة حول (x,y) لمحاكاة حركة
    for (const b of st.blobs) { x.fillStyle = b.c; x.beginPath(); x.arc(pos(b, 'x') * 320, pos(b, 'y') * 240, b.r * 320, 0, 7); x.fill(); }
    if (st.hand) { x.fillStyle = '#d9a37a'; x.beginPath(); x.arc(pos(st.hand, 'x') * 320, pos(st.hand, 'y') * 240, st.hand.r * 320, 0, 7); x.fill(); }
  }
  return { state: st,
    start() { draw(); stream = c.captureStream(30); iv = setInterval(draw, 33); return stream; },
    stop() { clearInterval(iv); iv = 0; stream = null; },
    running: () => !!iv };
})();

// مشغّل اختبار: يشغّل لعبة ويجمع النتيجة ويقيس تضرر المضيف. يُستدعى من وحدة التحكم/أداة الاختبار.
window.__engine.runTest = async (path, ms = 12000) => {
  const E = window.__engine, fp = () => [document.title, document.getElementById('menu').innerHTML.length, document.getElementById('hud').parentElement.id, document.body.children.length, [...document.body.children].map(c => c.id).join(','), document.cookie, localStorage.length, sessionStorage.length].join('|');
  const before = fp(); E.events.length = 0; let maxLag = 0, last = performance.now();
  const lag = setInterval(() => { const n = performance.now(); maxLag = Math.max(maxLag, n - last - 50); last = n; }, 50);
  const t0 = performance.now(); let outcome = null, detail = null;
  E.startGame(path);
  while (performance.now() - t0 < ms && !outcome) {
    await new Promise(r => setTimeout(r, 100));
    const s = E.events.find(e => e.n === 'end'); if (s) { outcome = 'ended'; detail = s.d; break; }
    const k = E.events.find(e => e.n === 'stop' && e.d !== 'replace' && e.d !== 'exit'); if (k) { outcome = 'stopped:' + k.d; break; }
    if (E.events.find(e => e.n === 'load-error')) { outcome = 'load-error'; detail = document.getElementById('ovT').textContent; break; }
  }
  const elapsed = Math.round(performance.now() - t0), ovt = document.getElementById('ovT').textContent;
  const viol = E.events.filter(e => e.n === 'violation').map(e => e.d);
  clearInterval(lag); E.stopGame('exit'); await new Promise(r => setTimeout(r, 200));
  return { path, outcome: outcome || 'timeout-still-running', detail, ms: elapsed, hostMaxLagMs: Math.round(maxLag), hostIntact: fp() === before, overlay: ovt.slice(0, 80), viol: [...new Set(viol)], modes: E.events.filter(e => e.n === 'launch').map(e => e.d), fallback: E.events.some(e => e.n === 'fallback'), iframeGone: !document.getElementById('launcher'), cameraClosed: !E.cameraOpen() };
};

// تقرير آلي من أي متصفح (Safari مثلًا): ?debug=1&game=...&auto=1&report=مللي_ث يرسل حالة المحرك وأحداثه وأقصى تأخّر لحلقة المضيف إلى /__report (خادم tests/server.mjs).
(() => {
  const qs = new URLSearchParams(location.search), ms = +qs.get('report'); if (!ms) return;
  let maxLag = 0, last = performance.now(); setInterval(() => { const n = performance.now(); maxLag = Math.max(maxLag, n - last - 50); last = n; }, 50);
  setTimeout(() => {
    const E = window.__engine, s = E.state();
    fetch('/__report', { method: 'POST', body: JSON.stringify({ ua: navigator.userAgent, game: qs.get('game'), mode: qs.get('mode'), maxHostLagMs: Math.round(maxLag), state: s && { ready: s.ready, alive: s.alive, mode: s.mode, frames: s.frames, cmdN: s.cmdN },
      hud: document.getElementById('hTitle').textContent, hidden: document.hidden, fellBack: E.fellBack(), events: E.events.filter(e => e.n !== 'hb').slice(-25), overlay: document.getElementById('ovT').textContent.slice(0, 160) }) }).catch(() => {});
  }, ms);
})();
