'use strict';
// النقل بين الشاشة (المضيف) والجوالات (الأذرع). الصفحة وحدها تملكه؛ اللعبة في Worker لا تصل إليه أبدًا (ENGINE.md §3.4).
// نوعان بالواجهة نفسها:
//  • nostr (الافتراضي): Trystero (vendor/trystero-nostr.js، يُحمَّل عند الحاجة فقط) — مرحّلات Nostr عامة للمصافحة فقط (تحتاج إنترنت لحظة الاتصال)،
//    ثم قناة بيانات WebRTC مباشرة بين الجهازين (على الواي فاي نفسه تبقى داخل الشبكة المحلية). بيانات فقط: لا صوت ولا صورة أبدًا.
//  • bc: BroadcastChannel داخل المتصفح نفسه (تبويبات/نوافذ من الأصل نفسه) — للاختبارات بلا إنترنت (?net=bc).
// Net.open({code, role:'host'|'pad'}) ⇒ { kind, self, send(to|null, msg), on(ev, cb), peers(), ping(peer), close() }؛ الأحداث: join(peer) leave(peer) msg(peer, data) status(text)
window.Net = (() => {
  const qs = new URLSearchParams(location.search), KIND = qs.get('net') === 'bc' ? 'bc' : 'nostr';
  const APP = 'a541ana-camera-games-v1';
  // المرحّلات مثبّتة هنا وفي CSP (index.html: connect-src) بالأسماء نفسها؛ لا مرحّل غير هذه القائمة. tests/run-portable.mjs يتحقق من تطابقهما.
  const RELAYS = ['nos.lol', 'nostr.mom', 'relay.damus.io', 'relay.primal.net', 'relay.nostr.dev.br', 'relay.routstr.com', 'nostr.oxtr.dev'].map(h => 'wss://' + h);
  const MAXMSG = 2048;
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
  function hub() { const h = {}; return { on(e, f) { (h[e] = h[e] || []).push(f); }, emit(e, ...a) { for (const f of h[e] || []) try { f(...a); } catch (x) { console.warn('net', e, x); } } }; }
  const size = d => { try { return JSON.stringify(d).length; } catch (e) { return 1e9; } };

  // ---------- BroadcastChannel ----------
  function openBC(code, role) {
    const H = hub(), self = role[0] + rid(), ch = new BroadcastChannel('cg-room-' + code), seen = new Map(); let iv = 0, closed = false;
    const post = m => { if (!closed) ch.postMessage(m); };
    const touch = p => { const was = seen.has(p); seen.set(p, performance.now()); if (!was) H.emit('join', p); };
    ch.onmessage = e => {
      const m = e.data; if (!m || m.from === self || typeof m.from !== 'string') return;
      if (m.k === 'bye') { if (seen.delete(m.from)) H.emit('leave', m.from); return; }
      touch(m.from);
      if (m.k === 'm' && (!m.to || m.to === self)) H.emit('msg', m.from, m.d);
    };
    iv = setInterval(() => { post({ k: 'hb', from: self }); const t = performance.now(); for (const [p, at] of seen) if (t - at > 2600) { seen.delete(p); H.emit('leave', p); } }, 700);
    post({ k: 'hb', from: self }); setTimeout(() => H.emit('status', 'ready'), 0);
    const bye = () => post({ k: 'bye', from: self }); addEventListener('pagehide', bye);
    return { kind: 'bc', self, on: H.on, peers: () => [...seen.keys()],
      send(to, d) { if (size(d) <= MAXMSG) post({ k: 'm', from: self, to: to || null, d }); },
      ping: async () => 0,
      close() { if (closed) return; bye(); closed = true; clearInterval(iv); removeEventListener('pagehide', bye); ch.close(); seen.clear(); } };
  }

  // ---------- Trystero / Nostr ----------
  let lib = null;
  const loadLib = () => lib || (lib = new Promise((ok, no) => { if (window.Trystero) return ok(window.Trystero); const s = document.createElement('script'); s.src = 'vendor/trystero-nostr.js'; s.onload = () => window.Trystero ? ok(window.Trystero) : no(new Error('trystero')); s.onerror = () => { lib = null; no(new Error('تعذّر تحميل مكتبة الربط')); }; document.head.append(s); }));
  function openNostr(code, role) {
    const H = hub(); let room = null, tx = null, closed = false, peers = new Set();
    const api = { kind: 'nostr', self: null, on: H.on, peers: () => [...peers],
      send(to, d) { if (!tx || size(d) > MAXMSG) return; try { tx.send(d, to ? { target: to } : {}).catch(() => { /* القناة تُغلق */ }); } catch (e) { /* */ } },
      async ping(p) { try { return room ? await room.ping(p) : -1; } catch (e) { return -1; } },
      close() { closed = true; try { if (room) room.leave(); } catch (e) { /* */ } room = null; tx = null; peers.clear(); } };
    H.emit('status', 'loading');
    loadLib().then(T => {
      if (closed) return; api.self = T.selfId;
      // الأذرع «سلبية» (passive): لا تتصل ببعضها، فقط بالشاشة. كلمة السرّ = رمز الغرفة فتُشفَّر المصافحة به.
      room = T.joinRoom({ appId: APP, password: 'cg-' + code, passive: role === 'pad', relayConfig: { urls: RELAYS, warnOnRelayFailure: false } }, 'room-' + code, {
        onJoinError: d => H.emit('status', 'join-error:' + String(d && d.error || '').slice(0, 80)) });
      // Trystero 0.26: makeAction يعيد كائنًا {send(data,{target}), onMessage = (data, {peerId})} لا مصفوفة كالإصدارات القديمة
      tx = room.makeAction('m');
      tx.onMessage = (d, meta) => { const p = meta && meta.peerId; if (!closed && p && size(d) <= MAXMSG) H.emit('msg', p, d); };
      room.onPeerJoin = p => { peers.add(p); H.emit('join', p); };
      room.onPeerLeave = p => { peers.delete(p); H.emit('leave', p); };
      H.emit('status', 'ready');
    }, e => H.emit('status', 'error:' + e.message));
    return api;
  }
  // رمز الغرفة: 4 أحرف لاتينية كبيرة بلا الحروف الملتبسة (I O 0 1)، عشوائية من crypto
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), b => ABC[b % ABC.length]).join('');
  const validCode = c => typeof c === 'string' && new RegExp('^[' + ABC + ']{4}$').test(c);
  return { kind: KIND, relays: RELAYS, newCode, validCode, open: ({ code, role }) => (KIND === 'bc' ? openBC : openNostr)(code, role) };
})();
