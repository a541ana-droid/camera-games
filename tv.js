'use strict';
// وضع التلفاز (الشاشة = المضيف): ردهة برمز QR + رمز من 4 أحرف، قائمة اللاعبين بألوانهم وأشكالهم، اختيار لعبة وطريقة لعب، وشاشة النتيجة.
// يملك جلسة النقل (net.js) ومقاعد الأذرع (≤8). اللعبة نفسها لا ترى شيئًا من هذا: يمرّر لها المحرك قائمة نظيفة ومدخلات أرقام فقط (ENGINE.md §3.4).
// كل ما يأتي من جوال غير موثوق: الأسماء تُقصّ وتُنظّف، والأرقام تُحصر، والأوامر (اختيار/بدء) لا تُقبل إلا من «القائد» (أصغر لاعب متصل).
(() => {
  const E = window.__engine, $ = id => document.getElementById(id), M = window.CGPlayers;
  const MAXP = 8, TEAMN = ['الفريق أ', 'الفريق ب'], TEAMC = ['#ff8a3d', '#a37bff'];
  const MODES = [['free', 'كلٌّ لنفسه'], ['1v1', '1 ضد 1'], ['2v2', '2 ضد 2'], ['teams', 'فريقان']];
  const MODEDESC = { free: 'كل لاعب يجمع لنفسه', '1v1': 'لاعبان وجهًا لوجه', '2v2': 'أربعة: فريقان من لاعبين', teams: 'كل اللاعبين في فريقين' };
  const h = (tag, p, ...kids) => { const e = document.createElement(tag); if (p) for (const k in p) { if (k === 'style') e.style.cssText = p[k]; else if (k in e) e[k] = p[k]; else e.setAttribute(k, p[k]); } e.append(...kids.filter(k => k != null)); return e; };
  const fin = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩<>]/g, '').trim().slice(0, n);

  let S = null; // الجلسة: {code, net, slots[], peerOf Map(peer→slot), mode, game, phase: lobby|playing|result, catalog, last}

  // ---------- كتالوج ألعاب الجوالات (الألعاب التي تعلن players.pads) ----------
  async function catalog() {
    if (S.catalog) return S.catalog;
    const names = (await (await fetch('games/index.txt')).text()).split('\n').map(s => s.trim()).filter(s => /^[\w.-]+\.js$/.test(s) && (E.debug || !s.startsWith('zz-')));
    const texts = await Promise.all(names.map(n => fetch('games/' + n).then(r => (r.ok ? r.text() : null), () => null)));
    const out = [];
    names.forEach((n, i) => { if (texts[i] == null) return; const hd = E.parseHeader(texts[i]); if (!hd.caps.includes('players.pads')) return; out.push({ src: 'games/' + n, title: hd.title || n, desc: hd.desc, accent: E.accentOf(hd).c, ...padsSpec(hd.pads) }); });
    return (S.catalog = out);
  }
  // رأس // @pads 1-8 free 1v1 2v2 teams : المدى وطرق اللعب التي تدعمها اللعبة (الافتراضي 1-8 free)
  function padsSpec(s) {
    const m = /(\d)\s*-\s*(\d)/.exec(s || ''), modes = MODES.map(x => x[0]).filter(k => new RegExp('(^|\\s)' + k + '(\\s|$)').test(s || ''));
    return { min: m ? Math.max(1, +m[1]) : 1, max: m ? Math.min(MAXP, +m[2]) : MAXP, modes: modes.length ? modes : ['free'] };
  }

  // ---------- الجلسة والنقل ----------
  const online = () => S ? S.slots.filter(p => p && p.online) : [];
  const leader = () => online()[0] || null;
  const teamMode = () => S && S.mode !== 'free';
  function open(pre) {
    if (!S) {
      const code = Net.newCode(); S = { code, net: Net.open({ code, role: 'host' }), slots: [], peerOf: new Map(), mode: 'free', game: null, phase: 'lobby', catalog: null, status: 'loading', at: Date.now(), last: null };
      const n = S.net;
      n.on('status', st => { S.status = st; paintStatus(); });
      S.statT = setInterval(() => { if (S && S.phase === 'lobby') paintStatus(); }, 2000); // عدد وسطاء المصافحة المتصلين يتغيّر بعد «جاهز»
      n.on('join', p => n.send(p, { t: 'host', code: S.code }));
      n.on('leave', p => { const s = S.peerOf.get(p); S.peerOf.delete(p); if (s && s.peer === p) { s.online = false; s.peer = null; s.left = Date.now(); E.ev('pad-leave', { index: s.index }); changed(); } });
      n.on('msg', onMsg);
      E.ev('tv-open', code);
    }
    if (pre) S.game = pre;
    S.phase = 'lobby'; lobby();
  }
  function close() { if (!S) return; clearInterval(S.statT); for (const p of online()) S.net.send(p.peer, { t: 'bye' }); S.net.close(); S = null; E.ev('tv-close'); }
  function onMsg(peer, m) {
    if (!S || !m || typeof m !== 'object' || typeof m.t !== 'string') return;
    let s = S.peerOf.get(peer);
    if (m.t === 'hello') {
      const pid = clean(m.pid, 24); if (!/^[\w-]{6,24}$/.test(pid)) return;
      s = S.slots.find(x => x && x.pid === pid);
      if (!s) { let i = S.slots.findIndex(x => !x || (!x.online && Date.now() - x.left > 120000)); if (i < 0) i = S.slots.length; if (i >= MAXP) return S.net.send(peer, { t: 'full' });
        s = S.slots[i] = { pid, index: i, name: '', ch: 0, team: -1, online: false, input: [0, 0, 0, 0, 0, 0, 0, 0], raw: [0, 0], acc: [0, 0], base: [0, 0], left: 0, rtt: -1 }; }
      if (s.peer && s.peer !== peer) S.peerOf.delete(s.peer);
      s.peer = peer; s.online = true; S.peerOf.set(peer, s); setProfile(s, m);
      if (teamMode() && s.team < 0) s.team = balanceTeam();
      E.ev('pad-join', { index: s.index, name: s.name });
      S.net.send(peer, { t: 'welcome', index: s.index, name: s.name, ch: s.ch, team: s.team, phase: S.phase }); changed(); return;
    }
    if (!s || s.peer !== peer) return; // لم يعرّف نفسه بعد
    switch (m.t) {
      case 'in': { const a = Array.isArray(m.v) ? m.v : []; const v = s.input;
        v[0] = fin(a[0], -1, 1, 0); v[1] = fin(a[1], -1, 1, 0); v[2] = a[2] ? 1 : 0; v[3] = a[3] ? 1 : 0; for (let k = 0; k < 2; k++) { const r = fin(a[4 + k], 0, 1e6, -1) | 0; if (r < 0) continue; const d = r >= s.raw[k] ? r - s.raw[k] : r; s.acc[k] += Math.min(d, 20); s.raw[k] = r; } /* عدّاد ضغطات أحادي الاتجاه للمقعد: يتحمّل إعادة تحميل الجوال (يبدأ عدّاده من 0) */ v[6] = fin(a[6], -1, 1, 0); v[7] = fin(a[7], -1, 1, 0); s.inAt = performance.now(); break; }
      case 'set': if (S.phase === 'playing') break; setProfile(s, m); changed(); break;
      case 'ping': S.net.send(peer, { t: 'pong', ts: fin(m.ts, 0, 1e13, 0), rtt: s.rtt }); if (typeof m.rtt === 'number') s.rtt = fin(m.rtt, -1, 1e5, -1); break;
      case 'pick': if (s === leader() && S.phase === 'lobby') { const g = S.catalog && S.catalog.find(x => x.src === m.src); if (g) { S.game = g.src; if (!g.modes.includes(S.mode)) setMode(g.modes[0]); changed(); } } break;
      case 'mode': if (s === leader() && S.phase === 'lobby') { setMode(String(m.m)); changed(); } break;
      case 'start': if (s === leader() && S.phase === 'lobby') start(); break;
      case 'again': if (s === leader() && S.phase === 'result') start(); break;
      case 'lobby': if (s === leader() && S.phase === 'result') { S.phase = 'lobby'; lobby(); } break;
    }
  }
  function setProfile(s, m) { const nm = clean(m.name, 16); s.name = nm || 'لاعب ' + (s.index + 1); s.ch = fin(m.ch, 0, 3, s.ch) | 0; }
  function balanceTeam() { const on = online(), a = on.filter(p => p.team === 0).length, b = on.filter(p => p.team === 1).length; return a <= b ? 0 : 1; }
  function setMode(k) {
    if (!MODES.some(x => x[0] === k)) return; S.mode = k;
    const on = online(); on.forEach((p, i) => { p.team = k === 'free' ? -1 : i % 2; }); S.slots.forEach(p => { if (p && !p.online) p.team = k === 'free' ? -1 : p.team; });
  }
  // تغيّر في اللاعبين: الردهة + كل الأذرع + اللعبة الجارية (المحرك يمرّر القائمة إلى Worker)
  function changed() {
    if (!S) return;
    if (S.phase === 'lobby') { paintPlayers(); paintSetup(); }
    for (const p of online()) S.net.send(p.peer, lobbyMsg(p));
    if (Pads.onChange) Pads.onChange();
  }
  function lobbyMsg(p) {
    const g = S.catalog && S.catalog.find(x => x.src === S.game), why = reason();
    return { t: 'lobby', phase: S.phase, index: p.index, name: p.name, ch: p.ch, team: p.team, leader: p === leader(), mode: S.mode, game: S.game, why,
      games: p === leader() ? (S.catalog || []).map(x => ({ src: x.src, title: x.title, modes: x.modes })) : undefined, title: g ? g.title : '' };
  }
  function reason() {
    const n = online().length, g = S.catalog && S.catalog.find(x => x.src === S.game);
    if (!n) return 'بانتظار أول جوال';
    if (!g) return 'اختر لعبة';
    if (!g.modes.includes(S.mode)) return 'هذه اللعبة لا تدعم «' + MODES.find(x => x[0] === S.mode)[1] + '»';
    if (S.mode === '1v1' && n !== 2) return '1 ضد 1 يحتاج لاعبَين بالضبط (الآن ' + n + ')';
    if (S.mode === '2v2' && n !== 4) return '2 ضد 2 يحتاج أربعة لاعبين بالضبط (الآن ' + n + ')';
    if (S.mode === 'teams' && (n < 2 || !online().some(p => p.team === 0) || !online().some(p => p.team === 1))) return 'الفريقان يحتاجان لاعبًا في كل فريق';
    if (n < g.min) return 'هذه اللعبة تحتاج ' + g.min + ' لاعبين على الأقل';
    if (n > g.max) return 'هذه اللعبة تتسع لـ' + g.max + ' لاعبين';
    return '';
  }
  function start(dbgSrc) {
    if (!S) return; const g = typeof dbgSrc === 'string' && E.debug ? { src: dbgSrc, title: dbgSrc } : (reason() ? null : S.catalog.find(x => x.src === S.game)); if (!g) return;
    S.phase = 'playing'; S.last = null;
    for (const p of S.slots) if (p) { p.input.fill(0); p.base = p.acc.slice(); } // كل لعبة تبدأ عدّادَي الضغط من 0 (نسبيًا)، فلا تضيع ضغطة بعد البدء ولا تظهر ضغطات من لعبة سابقة
    for (const p of online()) S.net.send(p.peer, { t: 'play', title: g.title, ctl: { stick: true, a: 'اضغط', b: '', tilt: false } });
    E.ev('tv-start', { game: g.src, mode: S.mode, n: online().length });
    E.startGame(g.src);
  }

  // ---------- واجهة الردهة ----------
  const view = () => $('tv');
  function lobby() {
    const v = view(); v.textContent = ''; E.show('tv');
    const url = padUrl();
    const qr = h('canvas', { className: 'qr', width: 600, height: 600, 'aria-label': 'رمز QR للانضمام' });
    const top = h('header', { className: 'tvtop' }, h('button', { className: 'ico', onclick: () => { close(); E.show('menu'); }, 'aria-label': 'رجوع إلى القائمة' }, '→'), h('h1', 0, '📺 العب بالجوالات'),
      h('span', { className: 'tvnet', id: 'tvNet' }, ''));
    const join = h('section', { className: 'tvjoin' }, qr, h('div', { className: 'tvhow' }, 'امسح الرمز بكاميرا الجوال'),
      h('div', { className: 'tvcode', dir: 'ltr', id: 'tvCode', 'aria-label': 'رمز الغرفة ' + S.code.split('').join(' ') }, ...S.code.split('').map(ch => h('b', 0, ch))),
      h('small', { className: 'tvurl' }, 'أو افتح ', h('span', { dir: 'ltr' }, location.host + location.pathname.replace(/index\.html$/, '')), ' واضغط «📱 انضم» واكتب الرمز'));
    const right = h('section', { className: 'tvside' }, h('h2', 0, 'اللاعبون'), h('div', { className: 'tvplayers', id: 'tvPlayers' }),
      h('h2', 0, 'طريقة اللعب'), h('div', { className: 'tvmodes', id: 'tvModes' }), h('h2', 0, 'اللعبة'), h('div', { className: 'tvgames', id: 'tvGames' }),
      h('div', { className: 'tvgo' }, h('button', { className: 'pri big', id: 'tvStart', onclick: start }, '▶ ابدأ اللعب'), h('span', { id: 'tvWhy' })));
    v.append(h('div', { className: 'tvw' }, top, join, right));
    loadQR().then(() => drawQR(qr, url), () => drawQR(qr, url)); paintStatus();
    catalog().then(() => { if (!S.game && S.catalog[0]) S.game = S.catalog[0].src; const g = S.catalog.find(x => x.src === S.game); if (g && !g.modes.includes(S.mode)) setMode(g.modes[0]); changed(); }).catch(() => { $('tvGames').textContent = 'تعذّر تحميل قائمة الألعاب'; });
    paintPlayers();
  }
  function padUrl() { // الرابط نفسه + #pad=رمز. نُبقي net/debug فقط (للاختبارات) ولا نضع شيئًا شخصيًا في الرابط
    const q = new URLSearchParams(location.search), keep = new URLSearchParams(); for (const k of ['net', 'debug']) if (q.get(k)) keep.set(k, q.get(k));
    const qs = keep.toString(); return location.origin + location.pathname + (qs ? '?' + qs : '') + '#pad=' + S.code;
  }
  // مولّد QR محلي (vendor/qrcode.js، MIT) يُحمَّل عند فتح الردهة فقط: لا شبكة ولا خدمة خارجية
  let qrLib = null; const loadQR = () => qrLib || (qrLib = new Promise((ok, no) => { if (typeof qrcode === 'function') return ok(); const s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = ok; s.onerror = () => { qrLib = null; no(); }; document.head.append(s); }));
  function drawQR(c, url) {
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    if (typeof qrcode !== 'function') { g.fillStyle = '#1a1430'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.fillText(S.code, c.width / 2, c.height / 2); return; }
    const q = qrcode(0, 'M'); q.addData(url); q.make(); const n = q.getModuleCount(), pad = 2, cell = Math.floor(c.width / (n + pad * 2)), off = Math.floor((c.width - cell * n) / 2);
    g.fillStyle = '#1a1430'; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(off + k * cell, off + r * cell, cell, cell);
    c.dataset.url = url;
  }
  function paintStatus() {
    const el = $('tvNet'); if (!el || !S) return; const st = S.status || '';
    let t = st === 'ready' ? 'جاهز للانضمام' : st === 'loading' ? 'جارٍ تجهيز الربط…' : st.startsWith('error') ? 'تعذّر تحميل الربط — هل الإنترنت متصل؟' : st.startsWith('join-error') ? 'تعذّر اتصال جوال — جرّبوا من جديد' : st;
    if (S.net.kind === 'nostr' && st === 'ready' && window.Trystero && Trystero.getRelaySockets) { const ss = Object.values(Trystero.getRelaySockets() || {}), up = ss.filter(w => w && w.readyState === 1).length; t = up ? 'متصل بالإنترنت للمصافحة (' + up + ' وسيط)' : 'نتصل بوسطاء الربط…'; }
    if (S.net.kind === 'bc') t = 'وضع تجربة: داخل هذا المتصفح فقط';
    el.textContent = t; el.className = 'tvnet' + (/تعذّر/.test(t) ? ' bad' : '');
  }
  function paintPlayers() {
    const box = $('tvPlayers'); if (!box) return; box.textContent = '';
    const shown = Math.max(4, Math.min(MAXP, Math.ceil(S.slots.length / 4) * 4)), team = teamMode(); // صفوف كاملة: لا خانة فارغة وحيدة في صفّ
    for (let i = 0; i < shown; i++) {
      const p = S.slots[i];
      if (!p) { box.append(h('div', { className: 'pcard empty' }, h('div', { className: 'slot' }, String(i + 1)), h('b', 0, 'بانتظار لاعب…'))); continue; }
      const I = M.info[p.ch], card = h('button', { className: 'pcard' + (p.online ? '' : ' off'), style: '--pc:' + I.color, onclick: () => { if (team && S.mode === 'teams' && S.phase === 'lobby') { p.team = p.team === 0 ? 1 : 0; changed(); } } },
        M.el(p.ch), h('b', 0, p.name), h('small', 0, I.label + (p.online ? '' : ' · انقطع')),
        team && p.team >= 0 ? h('span', { className: 'team t' + p.team }, TEAMN[p.team]) : null);
      if (!(team && S.mode === 'teams')) card.tabIndex = -1;
      box.append(card);
    }
  }
  function paintSetup() {
    const mb = $('tvModes'), gb = $('tvGames'); if (!mb || !gb) return; const g = S.catalog && S.catalog.find(x => x.src === S.game);
    mb.textContent = ''; for (const [k, t] of MODES) { const ok = !g || g.modes.includes(k); mb.append(h('button', { className: 'chip' + (S.mode === k ? ' on' : ''), disabled: !ok, onclick: () => { setMode(k); changed(); } }, h('b', 0, t), h('small', 0, MODEDESC[k]))); }
    gb.textContent = ''; for (const x of S.catalog || []) {
      const img = h('img', { className: 'gpic', src: x.src.replace(/\.js$/, '.cover.jpg'), alt: '' }); img.onerror = () => img.remove();
      gb.append(h('button', { className: 'gcard' + (S.game === x.src ? ' on' : ''), style: '--ac:' + x.accent, onclick: () => { S.game = x.src; if (!x.modes.includes(S.mode)) setMode(x.modes[0]); changed(); } }, img, h('b', 0, x.title), h('small', 0, x.desc || '')));
    }
    const why = reason(); $('tvStart').disabled = !!why; $('tvWhy').textContent = why || 'أو يبدأ أول لاعب من جواله';
  }
  // ---------- النتيجة ----------
  // ترتيب scores/ranks في ألعاب الجوالات = رقم مقعد الجوال (index)؛ teamScores = [أ، ب]. كله يُنقّى هنا (اللعبة غير موثوقة).
  function ended(m) {
    if (!S) return; S.phase = 'result';
    const pl = S.slots.filter(Boolean), sc = i => fin(Array.isArray(m.scores) ? m.scores[i] : undefined, -1e9, 1e9, null), rk = i => { const r = Array.isArray(m.ranks) ? m.ranks[i] : undefined; return Number.isInteger(r) && r >= 1 && r <= 8 ? r : null; };
    const rows = pl.map(p => ({ p, score: sc(p.index), rank: rk(p.index) }));
    let ts = Array.isArray(m.teamScores) ? m.teamScores.slice(0, 2).map(v => fin(v, -1e9, 1e9, null)) : null;
    if (teamMode() && !(ts && ts.length === 2 && ts.every(v => v !== null))) { // لم تُرسل اللعبة teamScores: متوسط درجات أعضاء كل فريق (كالدوري)
      const avg = t => { const v = rows.filter(r => r.p.team === t && r.score !== null).map(r => r.score); return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length * 10) / 10 : null; };
      ts = [avg(0), avg(1)];
    }
    const team = teamMode() && ts && ts.length === 2 && ts.every(v => v !== null);
    for (const r of rows) if (r.rank === null && r.score !== null) r.rank = 1 + rows.filter(o => o.score !== null && o.score > r.score).length;
    let title = 'انتهت الجولة', winT = -1, winners = [];
    if (team) { winT = ts[0] === ts[1] ? -1 : ts[0] > ts[1] ? 0 : 1; title = winT < 0 ? 'تعادل الفريقان!' : 'فاز ' + TEAMN[winT] + '!'; }
    else { winners = rows.filter(r => r.rank === 1); if (winners.length === 1) title = 'فاز ' + winners[0].p.name + '!'; else if (winners.length > 1 && winners.length < rows.length) title = 'فاز ' + winners.map(r => r.p.name).join(' و') + '!'; else if (winners.length) title = 'تعادل!'; }
    const won = r => (team ? (winT < 0 || r.p.team === winT) : r.rank === 1);
    S.last = { title, team, ts, winT, rows: rows.map(r => ({ index: r.p.index, name: r.p.name, score: r.score, rank: r.rank, won: won(r), team: r.p.team })), text: clean(m.text, 120) };
    for (const r of rows) if (r.p.online) S.net.send(r.p.peer, { t: 'over', title, won: won(r), line: team ? TEAMN[0] + ' ' + ts[0] + ' — ' + TEAMN[1] + ' ' + ts[1] : r.score !== null ? 'نقاطك ' + r.score : '', leader: r.p === leader() });
    E.ev('tv-result', S.last);
    result();
  }
  function result() {
    const v = view(), L = S.last; v.textContent = ''; E.show('tv');
    const card = r => { const p = S.slots[r.index], ch = p ? p.ch : 0; return h('div', { className: 'rcard' + (r.won ? ' win' : ''), style: '--pc:' + M.info[ch].color }, M.el(ch), h('b', 0, r.name), h('span', { className: 'rs' }, r.score === null ? '—' : String(r.score)), r.rank ? h('small', 0, 'المركز ' + r.rank) : null); };
    let body;
    if (L.team) body = h('div', { className: 'rteams' }, ...[0, 1].map(t => h('div', { className: 'rteam t' + t + (L.winT === t ? ' win' : '') }, h('h2', 0, TEAMN[t]), h('div', { className: 'rbig' }, String(L.ts[t])), h('div', { className: 'rrow' }, ...L.rows.filter(r => r.team === t).map(card)))));
    else body = h('div', { className: 'rrow' }, ...L.rows.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99)).map(card));
    v.append(h('div', { className: 'tvres' }, h('h1', 0, L.title), L.text ? h('p', { className: 'rtext' }, L.text) : null, body,
      h('div', { className: 'row' }, h('button', { className: 'pri big', id: 'tvAgain', onclick: start }, '↻ العب مرة أخرى'), h('button', { className: 'big', onclick: () => { S.phase = 'lobby'; lobby(); changed(); } }, 'الردهة'))));
  }
  // اللعبة توقفت (خطأ أو خروج بـ✕): رسالة قصيرة ثم الردهة
  function stopped(why) {
    if (!S || S.phase !== 'playing') return; S.phase = 'lobby'; E.ev('tv-stopped', why);
    for (const p of online()) S.net.send(p.peer, { t: 'stopped' });
    lobby(); changed(); if (why && why !== 'exit') { const w = h('p', { className: 'warn tvwarn' }, String(why).slice(0, 200)); view().prepend(w); setTimeout(() => w.remove(), 8000); }
  }

  // ---------- جسر المحرك (Pads) ----------
  window.Pads = {
    active: () => !!S, playing: () => !!S && S.phase === 'playing', mode: () => (S ? S.mode : 'free'),
    snapshot: () => (S ? S.slots.filter(Boolean).map(p => ({ index: p.index, name: p.name, colorIndex: p.ch, color: M.info[p.ch].color, team: p.team, connected: !!p.online })) : []),
    inputs() { const out = []; if (S) for (const p of S.slots) if (p) { const st = p.online && performance.now() - (p.inAt || 0) < 1500; out.push(p.index, st ? p.input[0] : 0, st ? p.input[1] : 0, st ? p.input[2] : 0, st ? p.input[3] : 0, p.acc[0] - p.base[0], p.acc[1] - p.base[1], st ? p.input[6] : 0, st ? p.input[7] : 0); } return out; },
    say(i, text) { if (!S) return; const t = clean(text, 60); for (const p of online()) if (i < 0 || p.index === i) S.net.send(p.peer, { t: 'say', text: t }); },
    vibrate(i, ms) { if (!S) return; ms = fin(ms, 1, 300, 40) | 0; for (const p of online()) if (i < 0 || p.index === i) S.net.send(p.peer, { t: 'vib', ms }); },
    controls(i, o) { if (!S) return; const c = { stick: o.stick !== false, a: clean(o.a, 12), b: clean(o.b, 12), tilt: !!o.tilt }; for (const p of online()) if (i < 0 || p.index === i) S.net.send(p.peer, { t: 'ctl', ctl: c }); },
    _play: src => start(src), // للاختبارات فقط (?debug=1): يبدأ لعبة ليست في القائمة
    ended, stopped, open, close, onChange: () => E.padsChanged && E.padsChanged(),
    state: () => S && { code: S.code, phase: S.phase, mode: S.mode, game: S.game, kind: S.net.kind, status: S.status, url: S ? padUrl() : '', last: S.last, pads: window.Pads.snapshot(), reason: reason(), rtt: S.slots.filter(Boolean).map(p => p.rtt) }
  };
  // القائمة: زرّ «العب بالجوالات»، واقتراحه تلقائيًا على شاشة كبيرة بلا لمس
  const tvBtn = $('tvBtn'); if (tvBtn) tvBtn.onclick = () => open();
  const big = innerWidth >= 1200 && navigator.maxTouchPoints === 0 && !matchMedia('(pointer:coarse)').matches;
  if (big && $('tvHint')) { $('tvHint').hidden = false; $('tvHintGo').onclick = () => open(); }
})();
