'use strict';
// الجوال كذراع تحكّم (#pad=رمز): صفحة خفيفة من الموقع نفسه. اسم + لون وشكل + «ابدأ» ثم عصا وأزرار كبيرة وميل اختياري واهتزاز ورسائل قصيرة من اللعبة.
// لا يشغّل أي لعبة ولا يفتح كاميرا ولا ميكروفون؛ يرسل أرقام التحكّم فقط إلى الشاشة عبر net.js، ويعيد الاتصال وحده.
(() => {
  const E = window.__engine, $ = id => document.getElementById(id), M = window.CGPlayers;
  const TEAMN = ['الفريق أ', 'الفريق ب'];
  const MODEN = { free: 'كلٌّ لنفسه', '1v1': '1 ضد 1', '2v2': '2 ضد 2', teams: 'فريقان' };
  const h = (tag, p, ...kids) => { const e = document.createElement(tag); if (p) for (const k in p) { if (k === 'style') e.style.cssText = p[k]; else if (k in e) e[k] = p[k]; else e.setAttribute(k, p[k]); } e.append(...kids.filter(k => k != null)); return e; };
  const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } } };
  // معرّف الذراع: لكل تبويب (sessionStorage) فيبقى بعد إعادة التحميل فيعود اللاعب إلى مقعده نفسه
  const pid = (() => { try { let v = sessionStorage.getItem('padId'); if (!v) { v = 'p' + Array.from(crypto.getRandomValues(new Uint8Array(9)), b => (b % 36).toString(36)).join(''); sessionStorage.setItem('padId', v); } return v; } catch (e) { return 'p' + Math.random().toString(36).slice(2, 12); } })();
  let P = null; // {code, net, host, me:{index,name,ch,team}, view, ctl, inp, lobby, timers}
  // الملف الشخصي: لكل تبويب أولًا (sessionStorage) ثم آخر ما اختير على هذا الجهاز (localStorage) كقيمة مقترحة
  let prof = (() => { try { const v = JSON.parse(sessionStorage.getItem('padProfile')); if (v) return v; } catch (e) { /* */ } return store.get('padProfile', { name: '', ch: 0 }); })(); if (!(prof.ch >= 0 && prof.ch <= 3)) prof.ch = 0;

  const root = () => $('pad');
  function screen(...kids) { const v = root(); v.textContent = ''; v.append(...kids); E.show('pad'); }
  const shape = (i, cls) => M.el(i, cls); // لون اللاعب وشكله فقط (DESIGN.md §2)

  // ---------- 1) الرمز (إن لم يأتِ في الرابط) ----------
  function askCode(msg) {
    const inp = h('input', { className: 'pcode', dir: 'ltr', maxLength: 4, autocapitalize: 'characters', autocomplete: 'off', inputMode: 'text', placeholder: 'ABCD', 'aria-label': 'رمز الغرفة' });
    const go = () => { const c = inp.value.toUpperCase().replace(/[^A-Z]/g, ''); if (Net.validCode(c)) { location.hash = 'pad=' + c; } else { inp.focus(); err.textContent = 'الرمز 4 أحرف كما يظهر على الشاشة'; } };
    const err = h('p', { className: 'pmsg' }, msg || '');
    inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); if (inp.value.length === 4) go(); };
    screen(h('div', { className: 'pbox' }, h('h1', 0, '📱 انضم إلى الشاشة'), h('p', 0, 'اكتب الرمز الظاهر على التلفاز'), inp, err, h('button', { className: 'pri pbig', onclick: go }, 'انضم'), h('button', { className: 'big', onclick: leaveAll }, 'رجوع')));
    setTimeout(() => inp.focus(), 50);
  }
  function leaveAll() { if (P) { try { P.net.close(); } catch (e) { /* */ } stopTimers(); P = null; } history.replaceState(null, '', location.pathname + location.search); E.show('menu'); if (E.buildMenuOnce) E.buildMenuOnce(); }

  // ---------- 2) الاسم واللون ----------
  function setup(code, again) {
    if (P) P.view = 'setup';
    const name = h('input', { className: 'pname', maxLength: 16, placeholder: 'اسمك (مثل: لاعب 1)', value: prof.name || '', 'aria-label': 'اسمك' });
    const pick = h('div', { className: 'ppick', role: 'radiogroup', 'aria-label': 'اختر لونك' });
    const mk = () => { pick.textContent = ''; M.info.forEach((I, i) => pick.append(h('button', { className: 'pch' + (prof.ch === i ? ' on' : ''), style: '--pc:' + I.color, role: 'radio', 'aria-checked': String(prof.ch === i), 'aria-label': I.label, onclick: () => { prof.ch = i; mk(); } }, shape(i), h('b', 0, I.name), h('small', 0, I.shapeName)))); };
    mk();
    const go = h('button', { className: 'pri pstart', id: 'padGo', onclick: () => {
      prof.name = name.value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16); store.set('padProfile', prof); try { sessionStorage.setItem('padProfile', JSON.stringify(prof)); } catch (e) { /* */ }
      try { if (window.Sensors) Sensors.permit(); } catch (e) { /* */ } // iOS: إذن الميل يجب أن يُطلب داخل هذه النقرة
      wake();
      if (again && P) { P.net.send(P.host, { t: 'set', name: prof.name, ch: prof.ch }); P.view = 'lobby'; return lobbyView(); }
      connect(code);
    } }, 'ابدأ');
    screen(h('div', { className: 'pbox' }, h('h1', 0, 'اختر لونك'), pick, name, go, h('small', { className: 'pfoot', dir: 'ltr' }, 'غرفة ' + code)));
  }
  let lock = null; function wake() { try { if (navigator.wakeLock && !lock) navigator.wakeLock.request('screen').then(l => { lock = l; l.addEventListener('release', () => { lock = null; }); }, () => {}); } catch (e) { /* */ } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && P) wake(); });

  // ---------- 3) الاتصال وإعادة الاتصال ----------
  function connect(code) {
    if (P) { try { P.net.close(); } catch (e) { /* */ } stopTimers(); }
    P = { code, net: Net.open({ code, role: 'pad' }), host: null, me: null, view: 'wait', ctl: { stick: true, a: 'اضغط', b: '', tilt: false }, scr: null, inp: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], sent: '', sentAt: 0, rtt: -1, t0: performance.now(), timers: [] };
    const p = P, n = p.net;
    n.on('msg', (peer, m) => { if (P !== p || !m || typeof m.t !== 'string') return; if (m.t === 'host') { p.host = peer; n.send(peer, { t: 'hello', pid, name: prof.name, ch: prof.ch }); return; } if (peer === p.host) onHost(m); });
    n.on('join', peer => { if (P === p && !p.host) n.send(peer, { t: 'hello?', pid }); });
    n.on('leave', peer => { if (P === p && peer === p.host) { p.host = null; p.me = null; waitView('انقطع الاتصال بالشاشة… نعيد المحاولة'); } });
    n.on('status', st => { if (P === p && /^error/.test(st)) waitView('تعذّر تحميل الربط. هل الإنترنت متصل؟', true); });
    waitView('نبحث عن الشاشة…');
    p.timers.push(setInterval(() => sendInput(false), 33));
    p.timers.push(setInterval(() => { if (p.host) n.send(p.host, { t: 'ping', ts: performance.now(), rtt: p.rtt }); }, 2000));
    p.timers.push(setInterval(() => { if (P === p && !p.host && p.view === 'wait' && performance.now() - p.t0 > 15000) waitView('لم نجد الشاشة بعد. تأكد أن التلفاز يعرض الرمز ' + code + ' وأن الإنترنت يعمل.', true); }, 3000));
  }
  function stopTimers() { if (P) for (const t of P.timers) clearInterval(t); }
  function onHost(m) {
    const p = P;
    switch (m.t) {
      case 'welcome': try { sessionStorage.setItem('padRoom', p.code); } catch (e) { /* */ } p.me = { index: m.index | 0, name: String(m.name || ''), ch: m.ch | 0, team: m.team | 0 }; if (m.phase === 'playing') controller(); else lobbyView(); break;
      case 'lobby': p.lobby = m; if (p.me) Object.assign(p.me, { index: m.index | 0, name: String(m.name || ''), ch: m.ch | 0, team: typeof m.team === 'number' ? m.team : -1 });
        if (m.phase === 'lobby' && p.view !== 'setup') lobbyView(); else if (m.phase === 'playing' && p.view !== 'ctl') controller(); else if (p.view === 'ctl') paintTop(); break;
      case 'play': p.sayText = ''; p.scr = null; p.ctl = sane(m.ctl); controller(m.title); buzz(60); break;
      case 'scr': p.scr = scrOf(m); if (p.view === 'ctl') controller(); break; // شاشة اختيار أو لمس من اللعبة (0.6)؛ k فارغ = عودة الذراع
      case 'ctl': p.ctl = sane(m.ctl); if (p.view === 'ctl') controller(); break; // يعيد بناء الأزرار ويحتفظ بآخر رسالة
      case 'say': p.sayText = String(m.text || '').slice(0, 60); say(p.sayText); break;
      case 'vib': buzz(m.ms); break;
      case 'over': resultView(m); buzz(m.won ? [60, 60, 120] : 80); break;
      case 'stopped': lobbyView(); break;
      case 'pong': p.rtt = Math.round(performance.now() - (+m.ts || 0)); E.padRtt = p.rtt; break;
      case 'full': waitView('الغرفة ممتلئة (8 لاعبين). انتظر حتى يخرج أحد.', true); break;
      case 'bye': waitView('أُغلقت الغرفة على الشاشة.', true); break;
    }
  }
  // شاشة من المضيف: تُقصّ حقولها مرة أخرى هنا (لا innerHTML في أي مكان: نصوص textContent فقط)
  const HEX = /^#[0-9a-fA-F]{6}$/, f01 = (v, d) => (typeof v === 'number' && isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
  function scrOf(m) {
    if (!m || (m.k !== 'choice' && m.k !== 'touch') || !Array.isArray(m.items)) return null;
    const o = { k: m.k, s: m.s | 0, at: performance.now(), prompt: String(m.prompt || '').slice(0, 40), picked: Number.isInteger(m.picked) ? m.picked : -1, dark: !!m.dark, hint: !!m.hint, light: f01(m.light, 0.16),
      found: Array.isArray(m.found) ? m.found.filter(Number.isInteger) : [] };
    o.items = m.items.slice(0, m.k === 'choice' ? 4 : 20).map(x => ({ text: String((x && x.text) || '').slice(0, 16), color: HEX.test((x && x.color) || '') ? x.color : '', shape: x && Number.isInteger(x.shape) ? x.shape : -1,
      sh: x && typeof x.shape === 'string' ? x.shape : 'circle', x: f01(x && x.x, 0.5), y: f01(x && x.y, 0.5), r: f01(x && x.r, 0.06), goal: !!(x && x.goal) }));
    return o;
  }
  const sane = c => ({ stick: !c || c.stick !== false, a: String((c && c.a) || '').slice(0, 12), b: String((c && c.b) || '').slice(0, 12), tilt: !!(c && c.tilt) });
  const hapticOff = () => { try { const o = JSON.parse(localStorage.getItem('engine-prefs') || 'null'); return !!o && o.haptic === false; } catch (e) { return false; } }; // إعداد «الاهتزاز» على هذا الجوال نفسه (0.5.2)
  const buzz = ms => { try { if (hapticOff()) return; if (navigator.vibrate) navigator.vibrate(Array.isArray(ms) ? ms.slice(0, 6).map(x => Math.min(300, x | 0)) : Math.min(300, Math.max(1, ms | 0))); } catch (e) { /* */ } };

  // ---------- الشاشات ----------
  function waitView(text, retry) {
    if (!P) return; P.view = 'wait';
    screen(h('div', { className: 'pbox' }, shape(prof.ch, 'pbigm' + (retry ? ' dim' : ' pulse')), h('h1', 0, text), retry ? h('button', { className: 'pri pbig', onclick: () => connect(P.code) }, 'حاول مرة أخرى') : h('div', { className: 'pdots' }, h('i'), h('i'), h('i')), h('button', { className: 'big', onclick: () => askCode() }, 'رمز آخر')));
  }
  function lobbyView() {
    const p = P; if (!p || !p.me) return; p.view = 'lobby'; const L = p.lobby || {}, me = p.me, I = M.info[me.ch];
    const kids = [shape(me.ch, 'pbigm'), h('h1', { style: 'color:' + I.color }, me.name), h('p', { className: 'pmut' }, I.label + ' · لاعب ' + (me.index + 1)),
      me.team >= 0 && L.mode && L.mode !== 'free' ? h('span', { className: 'team t' + me.team }, TEAMN[me.team]) : null];
    if (L.leader && Array.isArray(L.games)) {
      const g = L.games.find(x => x.src === L.game);
      kids.push(h('p', { className: 'plead' }, '⭐ أنت القائد: اختر اللعبة وابدأ'),
        h('div', { className: 'plist' }, ...L.games.map(x => h('button', { className: 'card' + (x.src === L.game ? ' on' : ''), onclick: () => p.net.send(p.host, { t: 'pick', src: x.src }) }, x.title))),
        h('div', { className: 'pmodes' }, ...(g ? g.modes : ['free']).map(k => h('button', { className: 'chip' + (k === L.mode ? ' on' : ''), onclick: () => p.net.send(p.host, { t: 'mode', m: k }) }, MODEN[k] || k))),
        h('button', { className: 'pri pstart', disabled: !!L.why, onclick: () => p.net.send(p.host, { t: 'start' }) }, '▶ ابدأ اللعب'), L.why ? h('p', { className: 'pmsg' }, L.why) : null);
    } else kids.push(h('p', { className: 'pwait' }, L.title ? 'اللعبة: ' + L.title : 'انظر إلى الشاشة'), h('p', { className: 'pmut' }, L.why && L.why !== 'اختر لعبة' ? L.why : 'ينتظر أن يبدأ القائد اللعبة'));
    kids.push(h('button', { className: 'big', onclick: () => setup(p.code, true) }, 'غيّر لوني'));
    screen(h('div', { className: 'pbox' }, ...kids));
  }
  function resultView(m) {
    const p = P; if (!p || !p.me) return; p.view = 'result'; resetInput();
    screen(h('div', { className: 'pbox' }, shape(p.me.ch, 'pbigm' + (m.won ? ' pulse' : '')), h('h1', 0, m.won ? 'فزت! 🎉' : 'أحسنت!'), h('p', { className: 'pwait' }, String(m.title || '').slice(0, 60)), m.line ? h('p', { className: 'pmut' }, String(m.line).slice(0, 80)) : null,
      m.leader ? h('button', { className: 'pri pstart', onclick: () => p.net.send(p.host, { t: 'again' }) }, '↻ مرة أخرى') : null, m.leader ? h('button', { className: 'big', onclick: () => p.net.send(p.host, { t: 'lobby' }) }, 'الردهة') : h('p', { className: 'pmut' }, 'انظر إلى الشاشة')));
  }

  // ---------- 4) الذراع: عصا + أزرار + ميل ----------
  function resetInput() { if (!P) return; const v = P.inp; v[0] = v[1] = v[2] = v[3] = v[6] = v[7] = v[8] = 0; }
  function controller(title) {
    const p = P; if (!p || !p.me) return; p.view = 'ctl'; resetInput(); const c = p.ctl, I = M.info[p.me.ch];
    if (p.scr) return p.scr.k === 'choice' ? choiceView(p.scr) : touchView(p.scr);
    const top = h('div', { className: 'ptop', id: 'padTop' });
    const stick = c.stick ? h('div', { className: 'pstick', id: 'padStick' }, h('canvas', { id: 'padStickC' }), h('span', { className: 'phint' }, 'حرّك من هنا')) : null;
    const btn = (k, label, cls) => h('button', { className: 'pbtn ' + cls, id: 'padBtn' + k.toUpperCase(), style: '--pc:' + I.color, 'aria-label': label }, label);
    const btns = h('div', { className: 'pbtns' + (c.b ? ' two' : '') }, c.b ? btn('b', c.b, 'pb') : null, btn('a', c.a || 'اضغط', 'pa'));
    screen(h('div', { className: 'pctl' + (c.stick ? '' : ' nostick') }, top, h('div', { className: 'pplay' }, stick, btns), h('div', { className: 'psay' + (p.sayText ? ' on' : ''), id: 'padSay', 'aria-live': 'polite' }, p.sayText || (title ? 'اللعبة: ' + title : ''))));
    paintTop(); bindButtons(); if (stick) bindStick(); tilt(c.tilt);
  }
  // ---------- 4ب) شاشة الاختيار (0.6): 2–4 أزرار كبيرة، تُقفل بعد أول لمسة وتُبلغ الشاشة بالاختيار وزمنه ----------
  const lum = c => { const v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  function choiceView(sc) {
    const p = P, top = h('div', { className: 'ptop', id: 'padTop' }), n = sc.items.length;
    const btns = sc.items.map((it, k) => {
      const bg = it.color || (it.shape >= 0 ? M.info[M.idx(it.shape)].color : ''), fg = bg ? (lum(bg) > 0.3 ? '#1a1430' : '#ffffff') : '';
      const b = h('button', { className: 'pchc' + (bg ? ' col' : '') + (/^\P{L}+$/u.test(it.text) && it.text ? ' emo' : ''), id: 'padCh' + k, style: bg ? '--cc:' + bg + ';--cf:' + fg : '', 'aria-label': it.text || ('خيار ' + (k + 1)) });
      if (it.shape >= 0) { const s = M.el(it.shape, 'pchs'); if (bg) for (const e of s.querySelectorAll('path')) { e.setAttribute('fill', fg); e.setAttribute('stroke', fg); } b.append(s); }
      if (it.text) b.append(h('span', 0, it.text));
      b.addEventListener('pointerdown', e => { e.preventDefault(); pick(k); }); b.addEventListener('click', e => e.preventDefault()); b.addEventListener('contextmenu', e => e.preventDefault());
      return b;
    });
    function lockPaint() { btns.forEach((b, k) => { b.classList.toggle('on', sc.picked === k); b.classList.toggle('off', sc.picked >= 0 && sc.picked !== k); b.setAttribute('aria-pressed', String(sc.picked === k)); }); }
    function pick(k) { if (sc.picked >= 0 || P !== p || p.scr !== sc || !p.host) return; sc.picked = k; lockPaint(); buzz(25); p.net.send(p.host, { t: 'ch', s: sc.s, k, ms: Math.round(performance.now() - sc.at) }); }
    screen(h('div', { className: 'pctl pchoice' }, top, sc.prompt ? h('div', { className: 'pchq' }, sc.prompt) : null, h('div', { className: 'pchg n' + n }, ...btns),
      h('div', { className: 'psay' + (p.sayText ? ' on' : ''), id: 'padSay', 'aria-live': 'polite' }, p.sayText || '')));
    lockPaint(); paintTop(); tilt(false);
  }
  // ---------- 4ج) شاشة اللمس / المصباح (0.6): الجوال يرسم العتمة والضوء والعناصر محليًا (بلا تأخير)، ويرسل الإصبع ≤30/ث والعثور مرة لكل عنصر ----------
  function touchView(sc) {
    const p = P, top = h('div', { className: 'ptop', id: 'padTop' }), cv = h('canvas', { id: 'padTouchC' }), z = h('div', { className: 'ptouch' + (sc.dark ? ' dark' : ''), id: 'padTouch' }, cv);
    screen(h('div', { className: 'pctl ptch' }, top, z, h('div', { className: 'psay' + (p.sayText ? ' on' : ''), id: 'padSay', 'aria-live': 'polite' }, p.sayText || '')));
    paintTop(); tilt(false);
    const g = cv.getContext('2d'), col = M.info[p.me.ch].color; let id = null, fx = -1, fy = -1, raf = 0, buzzAt = 0;
    const W = () => z.clientWidth, H = () => z.clientHeight, D = () => Math.min(W(), H());
    const fit = () => { const d = devicePixelRatio || 1; cv.width = W() * d; cv.height = H() * d; cv.style.width = W() + 'px'; cv.style.height = H() + 'px'; g.setTransform(d, 0, 0, d, 0, 0); draw(); };
    function item(it, lit) {
      const x = it.x * W(), y = it.y * H(), r = it.r * D(); g.save(); g.fillStyle = it.color || '#ffffff'; g.strokeStyle = it.color || '#ffffff'; g.lineJoin = 'round'; g.lineWidth = r * 0.14;
      if (it.text) { g.font = Math.round(r * 1.7) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it.text, x, y + r * 0.06); }
      else { g.beginPath(); const s = it.sh;
        if (s === 'square') { const k = r * 0.86; g.rect(x - k, y - k, k * 2, k * 2); } else if (s === 'triangle') { g.moveTo(x, y - r * 1.05); g.lineTo(x + r, y + r * 0.78); g.lineTo(x - r, y + r * 0.78); g.closePath(); }
        else if (s === 'diamond') { g.moveTo(x, y - r * 1.1); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.1); g.lineTo(x - r, y); g.closePath(); }
        else if (s === 'star') { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); }
        else g.arc(x, y, r, 0, Math.PI * 2);
        g.fill(); if (s !== 'circle') g.stroke(); }
      if (lit) { g.globalAlpha = 0.9; g.lineWidth = Math.max(3, r * 0.12); g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(x, y, r * 1.45, 0, Math.PI * 2); g.stroke(); }
      g.restore();
    }
    function draw() {
      raf = 0; if (!z.isConnected) return; const w = W(), hh = H(), on = id !== null && fx >= 0;
      g.clearRect(0, 0, w, hh);
      if (sc.dark) {
        g.fillStyle = '#05040a'; g.fillRect(0, 0, w, hh);
        if (on) { const L = sc.light * D(), x = fx * w, y = fy * hh, gr = g.createRadialGradient(x, y, L * 0.2, x, y, L);
          gr.addColorStop(0, 'rgba(255,244,214,0.34)'); gr.addColorStop(1, 'rgba(255,244,214,0.04)');
          g.save(); g.beginPath(); g.arc(x, y, L, 0, Math.PI * 2); g.clip(); g.fillStyle = gr; g.fillRect(x - L, y - L, L * 2, L * 2); sc.items.forEach((it, k) => { if (!sc.found.includes(k)) item(it, false); }); g.restore(); }
        sc.items.forEach((it, k) => { if (sc.found.includes(k)) item(it, true); }); // ما وُجد يبقى ظاهرًا
      } else { sc.items.forEach((it, k) => item(it, sc.found.includes(k))); }
      if (on) { g.save(); g.globalAlpha = 0.9; g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.arc(fx * w, fy * hh, 16, 0, Math.PI * 2); g.stroke(); g.restore(); }
    }
    const ask = () => { if (!raf) raf = requestAnimationFrame(draw); };
    function at(e) {
      const r = z.getBoundingClientRect(); fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      p.inp[8] = 1; p.inp[9] = Math.round(fx * 1000) / 1000; p.inp[10] = Math.round(fy * 1000) / 1000;
      const px = fx * r.width, py = fy * r.height, d = Math.min(r.width, r.height); let near = 1e9;
      sc.items.forEach((it, k) => { if (!it.goal || sc.found.includes(k)) return; const dd = Math.hypot(it.x * r.width - px, it.y * r.height - py); near = Math.min(near, dd);
        if (dd <= Math.max(it.r * d, 22)) { sc.found.push(k); buzz([30, 40, 70]); if (p.host) p.net.send(p.host, { t: 'fd', s: sc.s, k, ms: Math.round(performance.now() - sc.at) }); } });
      if (sc.hint && sc.dark && near < 1e9) { const q = 1 - near / (0.6 * d), t = performance.now(); if (q > 0 && t - buzzAt > 520 - 380 * q) { buzzAt = t; buzz(Math.round(8 + 30 * q)); } } // أقرب = اهتزاز أسرع وأقوى، بلا صوت
      ask();
    }
    z.addEventListener('pointerdown', e => { if (id !== null) return; e.preventDefault(); id = e.pointerId; try { z.setPointerCapture(id); } catch (x) { /* */ } at(e); sendInput(true); });
    z.addEventListener('pointermove', e => { if (e.pointerId !== id) return; at(e); sendInput(false); });
    const end = e => { if (e.pointerId !== id) return; id = null; p.inp[8] = 0; ask(); sendInput(true); };
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end); z.addEventListener('lostpointercapture', end); z.addEventListener('contextmenu', e => e.preventDefault());
    fit(); const ro = new ResizeObserver(() => { if (!z.isConnected) return ro.disconnect(); fit(); }); ro.observe(z);
  }
  function paintTop() {
    const t = $('padTop'); if (!t || !P || !P.me) return; const me = P.me, I = M.info[me.ch], L = P.lobby || {}; t.textContent = '';
    t.append(...[shape(me.ch), h('b', { style: 'color:' + I.color }, me.name), me.team >= 0 && L.mode && L.mode !== 'free' ? h('span', { className: 'team t' + me.team }, TEAMN[me.team]) : null, h('small', { className: 'prtt', id: 'padRtt' }, '')].filter(Boolean));
  }
  let sayT = 0; function say(text) { const el = $('padSay'); if (!el) return; el.textContent = text; el.classList.add('on'); clearTimeout(sayT); sayT = setTimeout(() => el.classList.remove('on'), 4000); }
  function bindButtons() {
    for (const [k, i] of [['A', 2], ['B', 3]]) {
      const b = $('padBtn' + k); if (!b) continue; const ids = new Set();
      const down = e => { e.preventDefault(); if (ids.has(e.pointerId)) return; ids.add(e.pointerId); try { b.setPointerCapture(e.pointerId); } catch (x) { /* */ } if (ids.size === 1) { P.inp[i] = 1; P.inp[i + 2]++; b.classList.add('down'); buzz(12); sendInput(true); } };
      const up = e => { if (!ids.delete(e.pointerId)) return; if (!ids.size) { P.inp[i] = 0; b.classList.remove('down'); sendInput(true); } };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
  }
  function bindStick() {
    const z = $('padStick'), cv = $('padStickC'), g = cv.getContext('2d'); let id = null, ox = 0, oy = 0, kx = 0, ky = 0;
    const fit = () => { const r = z.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px'; g.setTransform(d, 0, 0, d, 0, 0); draw(); };
    const R = () => Math.min(z.clientWidth, z.clientHeight) * 0.3;
    function draw() {
      if (!P || !P.me || !z.isConnected) return;
      const w = z.clientWidth, hh = z.clientHeight, cx = id === null ? w / 2 : ox, cy = id === null ? hh / 2 : oy, r = R(), col = M.info[P.me.ch].color; g.clearRect(0, 0, w, hh);
      g.globalAlpha = 0.18; g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.globalAlpha = 0.5; g.lineWidth = 4; g.strokeStyle = col; g.stroke(); g.globalAlpha = 1;
      M.draw(g, P.me.ch, cx + kx * r, cy + ky * r, r * 0.5); // المقبض: شكل اللاعب ولونه
    }
    z.addEventListener('pointerdown', e => { if (id !== null) return; e.preventDefault(); id = e.pointerId; try { z.setPointerCapture(id); } catch (x) { /* */ } const r = z.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; kx = ky = 0; z.classList.add('on'); draw(); });
    z.addEventListener('pointermove', e => { if (e.pointerId !== id) return; const r = z.getBoundingClientRect(), dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy, L = Math.hypot(dx, dy), m = R(), k = L > m ? m / L : 1;
      kx = dx * k / m; ky = dy * k / m; P.inp[0] = Math.round(kx * 100) / 100; P.inp[1] = Math.round(ky * 100) / 100; draw(); sendInput(false); });
    const end = e => { if (e.pointerId !== id) return; id = null; kx = ky = 0; P.inp[0] = P.inp[1] = 0; z.classList.remove('on'); draw(); sendInput(true); };
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end); z.addEventListener('lostpointercapture', end);
    fit(); const ro = new ResizeObserver(() => { if (!z.isConnected) return ro.disconnect(); fit(); }); ro.observe(z);
  }
  function tilt(on) {
    if (!window.Sensors) return; Sensors.stop(); if (!on || !P) return;
    Sensors.permit().then(v => { if (v === 'granted' && P && P.ctl.tilt) Sensors.start(d => { P.inp[6] = d.x; P.inp[7] = d.y; }); else say('الميل غير متاح — استعمل العصا'); });
  }
  // الإرسال: عند التغيّر بحد أقصى ≈30 مرة/ث، ونبضة كل 400ms وإن لم يتغيّر شيء (تعرف الشاشة أن الذراع حيّ)
  function sendInput(force) {
    const p = P; if (!p || !p.host || p.view !== 'ctl') return; const t = performance.now(), v = p.inp, k = v.join(',');
    if (!force && k === p.sent && t - p.sentAt < 400) return; if (!force && k !== p.sent && t - p.sentAt < 30) return;
    p.sent = k; p.sentAt = t; p.net.send(p.host, { t: 'in', v: v.slice() });
    const r = $('padRtt'); if (r && p.rtt >= 0 && E.debug) r.textContent = p.rtt + 'ms';
  }
  // ---------- الدخول ----------
  function route() {
    const m = /^#pad(?:=([A-Za-z]{0,8}))?$/.exec(location.hash); if (!m) return false;
    const code = (m[1] || '').toUpperCase();
    if (!Net.validCode(code)) { askCode(m[1] ? 'الرمز غير صحيح' : ''); return true; }
    if (P && P.code === code) return true;
    let back = ''; try { back = sessionStorage.getItem('padRoom'); } catch (e) { /* */ }
    if (back === code) { connect(code); return true; } // إعادة تحميل الصفحة أثناء اللعب: يعود إلى مقعده بلا شاشة الإعداد
    setup(code); return true;
  }
  addEventListener('hashchange', route);
  window.PadApp = { route, state: () => P && { code: P.code, view: P.view, me: P.me, host: !!P.host, rtt: P.rtt, kind: P.net.kind, inp: P.inp.slice(), screen: P.scr ? { k: P.scr.k, s: P.scr.s, picked: P.scr.picked, found: P.scr.found.slice(), n: P.scr.items.length } : null }, pid: () => pid };
  const jb = $('joinBtn'); if (jb) jb.onclick = () => { location.hash = 'pad'; };
  if (/^#pad/.test(location.hash)) route();
})();
