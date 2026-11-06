'use strict';
// سلسلة ألعاب (دوري): تسلسل ألعاب بنقاط تراكمية. كل المنطق هنا في المضيف؛ ملف الألعاب قائمة مسارات فقط (games/index.txt).
// الاتصال بالمحرك: Series.active()/names() عند إطلاق اللعبة، Series.result(m) عند api.end، Series.stopped(why) عند تعطّل اللعبة أو الخروج منها.
// اللعبة غير موثوقة: نتائجها تُنقّى هنا (أرقام منتهية فقط، ≤8 لاعبين، رتب صحيحة 1..8) ولا تؤثر إلا في نقاط اللاعبين المعرَّفين في السلسلة.
(() => {
  const E = window.__engine, $ = id => document.getElementById(id), AR = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const MAXP = 4, MAXR = 20, PATH = /^[\w./-]+\.js$/;
  let ph = 'idle', st = null, cfg = { n: 2, names: [], pick: null, rounds: 5, teams: false }, catalog = null; // ph: idle | setup | prep | playing | standings | final
  const arn = String;
  const hero = () => { const i = h('img', { className: 'shero', src: 'series.jpg', alt: '', decoding: 'async' }); i.onerror = () => i.remove(); return i; };
  const h = (tag, p, ...kids) => { const e = document.createElement(tag); Object.assign(e, p || {}); e.append(...kids.filter(k => k != null)); return e; };
  const btn = (t, f, cls) => h('button', { textContent: t, className: cls || '', onclick: f });
  const view = (...kids) => { const v = $('ser'); v.textContent = ''; v.append(...kids.filter(k => k != null)); v.scrollTop = 0; E.show('ser'); };
  const defName = i => 'لاعب ' + AR[i];

  // ---------- المنطق (بلا DOM) ----------
  const num = v => (typeof v === 'number' && isFinite(v)) ? Math.max(-1e9, Math.min(1e9, v)) : null;
  // نتيجة اللعبة → مصفوفة طولها N من «درجات» (الأعلى أفضل) أو null للاعب بلا نتيجة صالحة؛ null كلها إن لم تُبلغ اللعبة بشيء صالح
  function clean(m, N) {
    const fit = a => { const r = []; for (let i = 0; i < N; i++) r.push(a[i] === undefined ? null : a[i]); return r.some(x => x !== null) ? r : null; };
    if (m && Array.isArray(m.ranks)) { const r = fit(m.ranks.slice(0, N).map(v => (Number.isInteger(v) && v >= 1 && v <= 8) ? -v : null)); if (r) { r.fromRanks = true; return r; } }
    if (m && Array.isArray(m.scores)) { const r = fit(m.scores.slice(0, N).map(num)); if (r) return r; }
    return null;
  }
  // نقاط الترتيب: الأول N والأخير 1 (3/2/1 لثلاثة)، التعادل يتشارك نقاط الأفضل، ومن بلا نتيجة صفر. لاعب وحيد: نقطة لكل لعبة أكملها.
  function points(sc) { const N = sc.length; return sc.map(s => s === null ? 0 : N - sc.filter(t => t !== null && t > s).length); }
  const sane = c => {
    if (!c || typeof c !== 'object') return 'cfg';
    const names = Array.isArray(c.names) ? c.names.map(x => String(x == null ? '' : x).trim().slice(0, 16)) : [];
    const games = Array.isArray(c.games) ? c.games.filter(g => typeof g === 'string' && PATH.test(g) && !g.includes('..')) : [];
    const rounds = Math.round(c.rounds);
    if (names.length < 1 || names.length > MAXP) return 'players'; if (!games.length) return 'games'; if (!(rounds >= 1 && rounds <= MAXR)) return 'rounds';
    return { names: names.map((x, i) => x || defName(i)), games, rounds, teams: !!c.teams && names.length >= 2 };
  };
  async function head(src) { try { return E.parseHeader(await (await fetch(src)).text()); } catch (e) { return { title: src, desc: '', caps: [], series: '' }; } }

  async function start(c) {
    const v = sane(c); if (typeof v === 'string') throw new Error('سلسلة غير صالحة: ' + v);
    const hs = {}; await Promise.all(v.games.map(async g => { hs[g] = await head(g); }));
    const plan = []; for (let i = 0; i < v.rounds; i++) { const g = v.games[i % v.games.length]; plan.push({ src: g, title: hs[g].title || g, desc: hs[g].desc, multi: hs[g].caps.includes('players.local') && v.names.length > 1 }); }
    st = { names: v.names, plan, i: 0, t: 0, turn: [], pts: v.names.map(() => 0), raw: v.names.map(() => 0), log: [], notes: [], teams: v.teams ? v.names.map((_, i) => i % 2) : null, tpts: [0, 0], traw: [0, 0] };
    prep();
  }
  const names = () => st ? st.names : null;
  const teams = () => st && st.teams ? st.teams.slice() : null; // وضع الفريقين: اللاعب i في الفريق i%2 (1 و3 ⇒ أ، 2 و4 ⇒ ب)
  const cur = () => st.plan[st.i];

  // ---------- مراحل السلسلة ----------
  function prep() {
    if (st.i >= st.plan.length) return fin();
    ph = 'prep'; const g = cur(), N = st.names.length;
    view(h('h1', 0, 'اللعبة ' + AR[st.i] + ' من ' + AR[st.plan.length - 1]), h('div', { className: 'card' }, h('b', 0, g.title), h('small', 0, g.desc || '')),
      !g.multi && N > 1 ? h('p', { style: 'font-size:24px;text-align:center' }, 'الدور: ', h('b', { style: 'color:var(--brand)' }, st.names[st.t])) : null,
      !g.multi && N > 1 ? h('p', { style: 'color:var(--mut)' }, 'كل لاعب يلعب دوره وحده، ويُرتَّبون بنتائجهم.') : null,
      st.notes.length ? h('p', { className: 'warn', style: 'white-space:pre-line' }, st.notes.join('\n')) : null,
      btn('ابدأ ▶', play, 'pri sbig'), btn('إنهاء السلسلة', fin, 'sbig'));
  }
  function play() { ph = 'playing'; E.startGame(cur().src); }
  function result(m) {
    if (ph !== 'playing') return;
    if (cur().multi) { const c = clean(m, st.names.length), tsc = st.teams ? cleanTeams(m) : null; done(c || st.names.map(() => null), c || tsc ? '' : 'لم ترسل اللعبة نتائج اللاعبين فلا نقاط لأحد.', tsc); }
    else turnDone(num(m && m.score));
  }
  function stopped(why) {
    if (ph !== 'playing') return; why = String(why || '').replace(/\s+/g, ' ').slice(0, 200);
    if (cur().multi) done(st.names.map(() => null), 'توقفت اللعبة ولا نقاط فيها: ' + why); else turnDone(null, why);
  }
  function turnDone(sc, why) {
    st.turn[st.t] = sc; if (why) st.notes.push(st.names[st.t] + ': توقفت اللعبة (لا نقاط) — ' + why);
    if (++st.t < st.names.length) return prep();
    const all = st.turn.slice(), notes = st.notes.join('\n'); st.turn = []; st.t = 0; done(all, notes);
  }
  // نتيجة الفريقين من اللعبة (teamScores=[أ،ب] أرقام منتهية) وإلا null
  function cleanTeams(m) { if (!m || !Array.isArray(m.teamScores) || m.teamScores.length < 2) return null; const t = m.teamScores.slice(0, 2).map(num); return t.every(x => x !== null) ? t : null; }
  // درجة الفريق: ما أبلغت به اللعبة (teamScores)، وإلا متوسط درجات أعضائه الصالحة (المتوسط لا المجموع كي لا يُظلم الفريق الأصغر)، وإلا null
  function teamOf(sc, tsc) { if (tsc) return tsc; return [0, 1].map(t => { const v = sc.filter((s, i) => st.teams[i] === t && s !== null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }); }
  function done(sc, note, tsc) {
    if (st.teams) { // فريقان: الفائز 2 والخاسر 1 (التعادل 2 لكليهما، بلا نتيجة 0)، ولكل لاعب نقاط فريقه
      const ts = teamOf(sc, tsc), tp = points(ts); ts.forEach((v, t) => { st.tpts[t] += tp[t]; if (v !== null && !sc.fromRanks) st.traw[t] += v; });
      const p = st.names.map((_, i) => tp[st.teams[i]]); sc.forEach((s, i) => { st.pts[i] += p[i]; if (s !== null && !sc.fromRanks) st.raw[i] += s; });
      st.log.push({ src: cur().src, title: cur().title, scores: sc, pts: p, teamScores: ts, teamPts: tp, note }); st.notes = []; st.i++; return standings(p, sc, note, ts, tp);
    }
    const p = points(sc); sc.forEach((s, i) => { st.pts[i] += p[i]; if (s !== null && !sc.fromRanks) st.raw[i] += s; }); // المجموع الخام لكسر التعادل: من الدرجات لا من الرتب
    st.log.push({ src: cur().src, title: cur().title, scores: sc, pts: p, note }); st.notes = []; st.i++; standings(p, sc, note);
  }
  const order = () => st.names.map((_, i) => i).sort((a, b) => st.pts[b] - st.pts[a] || st.raw[b] - st.raw[a] || a - b);
  const TN = ['الفريق أ', 'الفريق ب'], TC = ['#ff8a3d', '#a37bff'];
  const teamRows = (ts, tp) => h('div', 0, ...[0, 1].sort((a, b) => st.tpts[b] - st.tpts[a] || st.traw[b] - st.traw[a] || a - b).map(t => h('div', { className: 'srow' + (st.tpts[t] > st.tpts[1 - t] ? ' top' : ''), style: 'border-inline-start:6px solid ' + TC[t] },
    h('span', 0, TN[t], h('small', 0, st.names.filter((_, i) => st.teams[i] === t).join('، ') + (ts && ts[t] !== null && ts[t] !== undefined ? ' · درجته ' + arn(Math.round(ts[t] * 10) / 10) : ''))), h('span', 0, h('span', { className: 'pls' }, tp && tp[t] ? '+' + arn(tp[t]) + '  ' : ''), arn(st.tpts[t]) + ' نقطة'))));
  function standings(p, sc, note, ts, tp) {
    if (st.teams) { ph = 'standings'; const g = st.log[st.log.length - 1], w = ts && tp[0] !== tp[1] ? (tp[0] > tp[1] ? 0 : 1) : -1;
      return view(h('h1', 0, 'نتيجة «' + g.title + '»'), h('p', { style: 'font-size:20px' }, w >= 0 ? '🏅 فاز ' + TN[w] : ts.every(v => v === null) ? 'لا فائز في هذه اللعبة' : 'تعادل الفريقان'),
        note ? h('p', { className: 'warn', style: 'white-space:pre-line' }, note) : null, teamRows(ts, tp),
        btn(st.i >= st.plan.length ? 'النتيجة النهائية 🏆' : 'اللعبة التالية ▶', prep, 'pri sbig'), btn('إنهاء السلسلة', fin, 'sbig')); }
    ph = 'standings'; const N = st.names.length, g = st.log[st.log.length - 1], best = Math.max(...p);
    const win = N > 1 && best > 0 && p.filter(x => x === best).length < N ? st.names.filter((_, i) => p[i] === best) : [];
    view(h('h1', 0, 'نتيجة «' + g.title + '»'),
      h('p', { style: 'font-size:20px' }, N > 1 ? (win.length ? '🏅 الفائز: ' + win.join(' و') : sc.every(s => s === null) ? 'لا فائز في هذه اللعبة' : 'تعادل') : (sc[0] === null ? 'لا نتيجة' : 'نتيجتك: ' + sc[0])),
      note ? h('p', { className: 'warn', style: 'white-space:pre-line' }, note) : null,
      h('div', 0, ...order().map(i => h('div', { className: 'srow' }, h('span', 0, st.names[i], h('small', 0, sc[i] === null ? 'بلا نتيجة' : sc.fromRanks ? 'المركز ' + AR[-sc[i] - 1] : 'درجته ' + arn(sc[i]))), h('span', 0, h('span', { className: 'pls' }, p[i] ? '+' + arn(p[i]) + '  ' : ''), arn(st.pts[i]) + ' نقطة')))),
      btn(st.i >= st.plan.length ? 'النتيجة النهائية 🏆' : 'اللعبة التالية ▶', prep, 'pri sbig'), btn('إنهاء السلسلة', fin, 'sbig'));
  }
  function fin() {
    ph = 'final'; const o = order(), N = st.names.length, medal = ['🥇', '🥈', '🥉']; let r = 0;
    const rk = o.map((i, k) => (r = (k && st.pts[i] === st.pts[o[k - 1]] && st.raw[i] === st.raw[o[k - 1]]) ? r : k + 1));
    st.rank = o.map((i, k) => ({ i, rank: rk[k] }));
    if (st.teams) { st.teamRank = st.tpts[0] === st.tpts[1] && st.traw[0] === st.traw[1] ? [1, 1] : (st.tpts[0] > st.tpts[1] || (st.tpts[0] === st.tpts[1] && st.traw[0] > st.traw[1])) ? [1, 2] : [2, 1];
      return view(hero(), h('h1', 0, 'الترتيب النهائي'), h('p', { style: 'font-size:22px' }, st.teamRank[0] === st.teamRank[1] ? 'تعادل الفريقان' : '🏆 فاز ' + TN[st.teamRank[0] === 1 ? 0 : 1]), teamRows(null, null),
        btn('سلسلة جديدة', open, 'pri sbig'), btn('القائمة', () => { ph = 'idle'; E.show('menu'); }, 'sbig')); }
    view(hero(), h('h1', 0, 'الترتيب النهائي'), st.log.length ? null : h('p', 0, 'لم تُلعب أي لعبة.'),
      h('div', 0, ...o.map((i, k) => h('div', { className: 'srow' + (rk[k] === 1 ? ' top' : '') }, h('span', 0, (medal[rk[k] - 1] || AR[rk[k] - 1] + '.') + ' ' + st.names[i], h('small', 0, N === 1 ? 'مجموع الدرجات ' + arn(st.raw[i]) : '')), h('span', 0, arn(st.pts[i]) + ' نقطة')))),
      btn('سلسلة جديدة', open, 'pri sbig'), btn('القائمة', () => { ph = 'idle'; E.show('menu'); }, 'sbig'));
  }

  // ---------- شاشة الإعداد ----------
  async function open() {
    ph = 'setup'; if (!catalog) {
      view(h('h1', 0, 'جارٍ التحميل…'));
      try { const ns = (await (await fetch('games/index.txt')).text()).split('\n').map(s => s.trim()).filter(s => /^[\w.-]+\.js$/.test(s)); catalog = [];
        for (const nm of ns) { const hd = await head('games/' + nm); if (hd.series !== 'no' && !hd.caps.includes('players.pads')) catalog.push({ src: 'games/' + nm, title: hd.title || nm }); } } catch (e) { catalog = []; }
      cfg.pick = new Set(catalog.map(g => g.src));
    }
    setup();
  }
  function setup() {
    const chips = (vals, on, f) => h('div', { className: 'row' }, ...vals.map(v => btn(AR[v - 1], () => f(v), 'chip' + (v === on ? ' on' : ''))));
    const inputs = []; for (let i = 0; i < cfg.n; i++) inputs.push(h('input', { type: 'text', maxLength: 16, placeholder: defName(i), value: cfg.names[i] || '', oninput: e => { cfg.names[i] = e.target.value; } }));
    const k = cfg.pick.size;
    view(hero(), h('h1', 0, 'دوري'),
      h('label', 0, 'عدد اللاعبين (على هذا الجهاز)'), chips([1, 2, 3, 4], cfg.n, v => { cfg.n = v; setup(); }), h('div', { className: 'row' }, ...inputs),
      cfg.n >= 2 ? h('label', 0, 'طريقة اللعب') : null, cfg.n >= 2 ? h('div', { className: 'row' }, btn('كلٌّ لنفسه', () => { cfg.teams = false; setup(); }, 'chip' + (cfg.teams ? '' : ' on')), btn('فريقان (أ / ب)', () => { cfg.teams = true; setup(); }, 'chip' + (cfg.teams ? ' on' : ''))) : null,
      cfg.n >= 2 && cfg.teams ? h('p', { style: 'color:var(--mut);font-size:14px' }, 'الفريق أ: اللاعبون 1 و3 — الفريق ب: 2 و4. الفريق الفائز في كل لعبة يأخذ نقطتين والآخر نقطة.') : null,
      h('label', 0, 'عدد الجولات (لعبة لكل جولة)'), chips([3, 5, 8, 12], cfg.rounds, v => { cfg.rounds = v; setup(); }),
      h('label', 0, 'الألعاب (' + (AR[k - 1] || '0') + ' مختارة)'), h('div', { style: 'margin-top:8px' }, ...catalog.map(g => btn((cfg.pick.has(g.src) ? '✓ ' : '○ ') + g.title, () => { cfg.pick.has(g.src) ? cfg.pick.delete(g.src) : cfg.pick.add(g.src); setup(); }, 'card' + (cfg.pick.has(g.src) ? ' on' : '')))),
      h('p', { style: 'color:var(--mut);font-size:14px' }, 'الألعاب الجماعية تُلعب مرة واحدة بكل اللاعبين؛ وغيرها يلعبها كل لاعب بدوره. الأول يأخذ أعلى النقاط.'),
      btn('ابدأ السلسلة ▶', () => { if (k) start({ teams: cfg.teams && cfg.n >= 2, names: Array.from({ length: cfg.n }, (_, i) => cfg.names[i] || ''), games: catalog.map(g => g.src).filter(s => cfg.pick.has(s)), rounds: cfg.rounds }); }, 'pri sbig'),
      btn('رجوع', () => { ph = 'idle'; E.show('menu'); }, 'sbig'));
  }

  $('serBtn').onclick = open;
  window.Series = { active: () => ph === 'playing', names, teams, result, stopped, start, _clean: clean, _points: points,
    state: () => st && { ph, i: st.i, n: st.plan.length, pts: st.pts.slice(), raw: st.raw.slice(), log: st.log, rank: st.rank, names: st.names, teams: st.teams, tpts: st.tpts.slice(), teamRank: st.teamRank }, phase: () => ph };
})();
