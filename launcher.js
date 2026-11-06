// حاضن Worker داخل iframe معزول (sandbox بلا allow-same-origin، CSP صارم). لا يشغّل كود اللعبة ولا يمرّر رسائلها:
// يبني الـWorker من blob ويسلّمه منفذ القناة (MessagePort) فتصير القناة مباشرة بين Worker والمضيف. وظيفته الباقية: kill وتقرير حالة الإطلاق.
// هذا الملف مثبَّت بتجزئة SHA-256 في CSP المضيف (index.html) وفي engine.js: أي تعديل يتطلب node tools/launcher-hash.mjs --write
(() => {
  const P = parent; let w = null, go = false;
  const up = m => P.postMessage(m, '*');
  addEventListener('message', e => {
    const d = e.data; if (e.source !== P || !d) return;
    if (d.kill) { try { if (w) w.terminate(); } catch (_) { /* */ } w = null; return; }
    if (!d.hello || go || !e.ports[0]) return; go = true;
    try {
      const mk = s => URL.createObjectURL(new Blob([s], { type: 'text/javascript' }));
      w = new Worker(mk(d.wsrc)); const h = d.hello; h.game = mk(d.gsrc);
      w.onmessage = x => { if (x.data && x.data.alive) { w.onmessage = null; up({ launch: 'alive' }); } };
      w.onerror = x => { if (x.preventDefault) x.preventDefault(); up({ launch: 'error', msg: String(x.message || '').slice(0, 200) }); };
      w.postMessage(h, [e.ports[0]]);
    } catch (x) { up({ launch: 'fail', msg: String((x && x.message) || x).slice(0, 200) }); }
  });
})();
