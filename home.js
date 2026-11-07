'use strict';
// الرئيسية (0.6.1): «نلعب الآن؟» (كم لاعبًا ← كيف تلعبون ← «العب الآن» يشغّل لعبة مناسبة فعلًا)، رقائق تصفية، أقسام حسب طريقة اللعب
// من بيانات @play/@players/@minutes/@age/@style (ENGINE.md §1.1)، ومسابقات بفئات، وتنقّل (شريط سفلي على الجوال، حبوب في الرأس على الشاشة الكبيرة، أسهم الريموت على التلفاز).
// الصور: الأغلفة الخمسة المعتمدة فقط؛ غيرها شكل هندسي أبيض على تدرّج بصمة اللعبة. لا وجوه ولا شخصيات ولا عيون في أي مكان.
window.CGHome = (() => {
  const E = window.__engine, $ = id => document.getElementById(id), M = window.CGPlayers;
  const NS = 'http://www.w3.org/2000/svg';
  const h = (tag, p, ...kids) => { const e = document.createElement(tag); if (p) for (const k in p) { if (k === 'style') e.style.cssText = p[k]; else if (k.startsWith('on') || k in e) e[k] = p[k]; else e.setAttribute(k, p[k]); } e.append(...kids.filter(k => k != null && k !== false)); return e; };
  // أيقونات خطّية 24×24 (ثابتة، من كتابتنا؛ لا محتوى مستخدم)
  const IC = {
    home: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>', trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20.5h.01M17.5 17.5h3.5v3.5h-3.5z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', pads: '<rect x="2" y="4" width="14" height="10" rx="2"/><rect x="15" y="9" width="7" height="12" rx="1.5"/><path d="M6 18h6"/>',
    device: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>', quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.8M12 17h.01"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5a3 3 0 0 1 0 6M18 13.6c1.9.6 3 2.5 3 5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>', play: '<path d="M18 4.5L6 12l12 7.5z"/>', back: '<path d="M9 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>', paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/>',
    share: '<path d="M12 15V3M7 8l5-5 5 5M5 13v8h14v-8"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', camview: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>'
  };
  const paint = s => { s.innerHTML = IC[s.getAttribute('data-i')] || ''; s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); return s; };
  const icon = (n, cls) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'ic' + (cls ? ' ' + cls : '')); s.setAttribute('data-i', n); return paint(s); };
  // الغلاف الهندسي: شكل أبيض واحد يرمز لفعل اللعبة (@howto-act) على تدرّج بصمتها
  const W = 'fill="#fff"', WS = 'fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"';
  const ART = {
    'push-up': `<circle cx="80" cy="44" r="24" ${W}/><path d="M80 68l-5 8h10z" ${W}/>`, pop: `<circle cx="64" cy="56" r="20" ${W} opacity=".95"/><circle cx="100" cy="38" r="13" ${W} opacity=".7"/><circle cx="102" cy="72" r="8" ${W} opacity=".5"/>`,
    'show-color': `<circle cx="80" cy="50" r="27" ${WS}/><circle cx="80" cy="50" r="12" ${W}/>`, freeze: `<path d="M80 22v56M56 36l48 28M56 64l48-28" ${WS}/>`,
    'hand-zone': [0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${52 + c * 20}" y="${22 + r * 20}" width="16" height="16" rx="4" ${W} opacity="${r === 1 && c === 2 ? 1 : 0.35}"/>`).join('')).join(''),
    block: `<path d="M48 76V28h64v48" ${WS}/><circle cx="80" cy="56" r="11" ${W}/>`, dodge: `<path d="M92 20l10 14-10 14-10-14z" ${W}/><path d="M50 78h60" ${WS}/><circle cx="62" cy="66" r="8" ${W} opacity=".7"/>`,
    'wave-lane': `<path d="M58 80l8-58M80 80V22M102 80l-8-58" ${WS} opacity=".55"/><path d="M60 44l6-6 6 6M74 34l6-6 6 6M88 50l6-6 6 6" ${WS}/>`,
    tilt: `<rect x="52" y="30" width="56" height="40" rx="8" ${WS} transform="rotate(-12 80 50)"/><circle cx="74" cy="52" r="8" ${W}/>`,
    joystick: `<path d="M80 18l9.5 19.5 21.5 3-15.5 15 3.7 21.3L80 66.7 60.8 76.8l3.7-21.3-15.5-15 21.5-3z" ${W}/>`, 'tap-beat': `<path d="M40 50h80" ${WS}/><circle cx="80" cy="50" r="12" ${W}/>`,
    react: `<path d="M88 16L60 56h18l-6 30 28-42H82z" ${W}/>`, tap: `<circle cx="80" cy="50" r="10" ${W}/><circle cx="80" cy="50" r="24" ${WS} opacity=".55"/>`,
    voice: `<path d="M64 36a22 22 0 0 0 0 28M54 28a34 34 0 0 0 0 44M96 36a22 22 0 0 1 0 28M106 28a34 34 0 0 1 0 44" ${WS}/><circle cx="80" cy="50" r="9" ${W}/>`,
    wave: `<path d="M56 60c8-16 16-16 24 0s16 16 24 0" ${WS}/>`, simon: [0, 1].map(r => [0, 1].map(c => `<rect x="${58 + c * 24}" y="${26 + r * 24}" width="20" height="20" rx="5" ${W} opacity="${(r + c) % 2 ? 0.55 : 1}"/>`).join('')).join(''),
    quiz: `<rect x="50" y="24" width="60" height="52" rx="12" ${WS}/><path d="M72 42a8 8 0 1 1 10 7.6V54M80 62v.5" ${WS}/>`
  };
  const actOf = e => e.h['howto-act'] && ART[e.h['howto-act']] ? e.h['howto-act'] : e.quiz ? 'quiz' : e.meta.play === 'pads' ? 'joystick' : e.meta.play === 'device' ? 'tilt' : 'wave';
  function art(e) {
    const a = h('span', { className: 'art' }); a.style.setProperty('--ac', e.accent.c); a.style.setProperty('--ac-hi', e.accent.hi); a.style.setProperty('--ac-lo', e.accent.lo);
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 160 100'); s.setAttribute('preserveAspectRatio', 'xMidYMid meet'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ART[actOf(e)]; a.append(s);
    if (e.cover) { const img = new Image(); img.alt = ''; img.decoding = 'async'; img.className = 'pic'; img.onload = () => s.remove(); img.onerror = () => img.remove(); img.src = e.cover; a.append(img); }
    return a;
  }
  const rng = p => p ? h('bdi', { dir: 'ltr' }, p[0] === p[1] ? String(p[0]) : p[0] + '–' + p[1]) : null;
  function metaLine(m) {
    return h('span', { className: 'meta' }, m.players ? h('span', { title: 'عدد اللاعبين' }, icon('users'), rng(m.players)) : null, m.minutes ? h('span', { title: 'المدة' }, icon('clock'), m.minutes + ' د') : null, m.age ? h('span', { title: 'العمر' }, icon('star'), h('bdi', { dir: 'ltr' }, m.age + '+'))  : null);
  }
  const STYLE = { coop: 'تعاون', versus: 'تنافس', teams: 'فريقان', calm: 'هادئة' };

  // ---------- الحالة ----------
  const NOW_KEY = 'engine-now', PC = [[1, 1, '1'], [2, 2, '2'], [3, 4, '3–4'], [5, 8, 'فريقان']];
  const PLAY = [['camera', 'أمام الكاميرا', 'ثبّتوا الجهاز وقفوا', '#4da3ff'], ['pads', 'الجوالات أذرع', 'الشاشة للعرض', '#ff8a3d'], ['device', 'بيد الجوال', 'ميلان وتمرير', '#a37bff']];
  const bigScreen = () => innerWidth >= 1200 && navigator.maxTouchPoints === 0 && !matchMedia('(pointer:coarse)').matches;
  const loadNow = () => { let o = null; try { o = JSON.parse(localStorage.getItem(NOW_KEY) || 'null'); } catch (e) { /* */ } o = o && typeof o === 'object' ? o : {};
    return { pc: Number.isInteger(o.pc) && o.pc >= 0 && o.pc < PC.length ? o.pc : 2, play: PLAY.some(p => p[0] === o.play) ? o.play : bigScreen() ? 'pads' : 'camera', k: 0 }; };
  let N = loadNow(), entries = [], quizIdx = null; const F = new Set(); // F: الرقائق المفعّلة
  const saveNow = () => { try { localStorage.setItem(NOW_KEY, JSON.stringify({ pc: N.pc, play: N.play })); } catch (e) { /* */ } };
  const fitsPlayers = (m, i) => !m.players || (m.players[0] <= PC[i][1] && m.players[1] >= PC[i][0]);
  const card = e => e.card;
  const ok = e => !e.card || !e.card.disabled;

  // ---------- «نلعب الآن؟» ----------
  function candidates() { return entries.filter(e => !e.quiz && e.meta.play === N.play && fitsPlayers(e.meta, N.pc) && ok(e)); }
  function paintNow() {
    const box = $('now'); if (!box) return; box.textContent = '';
    const c = candidates(), e = c.length ? c[N.k % c.length] : null;
    const pcs = h('div', { className: 'pcount', role: 'group', 'aria-label': 'كم واحد بيلعب؟' }, ...PC.map((p, i) => h('button', { type: 'button', className: 'pc', 'aria-pressed': String(N.pc === i), onclick: () => { N.pc = i; N.k = 0; saveNow(); paintNow(); paintFilters(); $('now').querySelectorAll('.pc')[i].focus(); } },
      h('span', { className: 'dots', 'aria-hidden': 'true' }, ...Array.from({ length: Math.min(4, p[1]) }, (_, j) => M ? M.el(i === 3 ? (j % 2 ? 1 : 0) : j) : null).filter(Boolean)), h('bdi', { dir: 'ltr' }, p[2]))));
    if (M) pcs.querySelectorAll('.pc')[3].querySelectorAll('svg').forEach((s, j) => { s.style.color = j % 2 ? '#a37bff' : '#ff8a3d'; s.querySelectorAll('*').forEach(x => { x.setAttribute('fill', j % 2 ? '#a37bff' : '#ff8a3d'); }); });
    const hw = h('div', { className: 'how', role: 'group', 'aria-label': 'كيف تلعبون؟' }, ...PLAY.map((p, i) => { const b = h('button', { type: 'button', className: 'hw', 'aria-pressed': String(N.play === p[0]), onclick: () => { N.play = p[0]; N.k = 0; saveNow(); paintNow(); $('now').querySelectorAll('.hw')[i].focus(); } }, icon(p[0]), h('b', 0, p[1]), h('small', 0, p[2])); b.style.setProperty('--sc', p[3]); return b; }));
    const pick = h('div', { className: 'pick', id: 'nowPick' });
    if (e) pick.append(art(e), h('div', 0, h('b', { id: 'nowTitle' }, e.h.title || e.name), metaLine(e.meta)));
    else pick.append(h('p', { className: 'none' }, 'لا لعبة بهذا الاختيار على هذا الجهاز. جرّبوا طريقة أخرى أو عددًا آخر.'));
    const go = h('button', { className: 'pri', type: 'button', id: 'nowGo', disabled: !e, onclick: () => e && E.launch(e.src, e.h, null) }, icon('play'), 'العب الآن');
    const alt = h('button', { className: 'alt', type: 'button', id: 'nowAlt', disabled: c.length < 2, onclick: () => { N.k++; paintNow(); $('nowAlt').focus(); } }, 'غيرها');
    box.append(h('div', { className: 'nowk' }, h('h2', { id: 'nowH' }, 'نلعب الآن؟'), h('small', 0, 'سؤالان وتبدأ')), h('p', { className: 'q' }, 'كم واحد بيلعب؟'), pcs, h('p', { className: 'q' }, 'كيف تلعبون؟'), hw, pick, h('div', { className: 'goes' }, go, alt));
    E.nowPick = e ? e.src : null;
  }
  // «لعبة الليلة» على الشاشة الكبيرة: لعبة بغلاف معتمد، تتغيّر كل يوم
  function paintHero() {
    const lead = $('lead'), old = $('hero'); if (old) old.remove(); lead.classList.remove('hero2');
    if (innerWidth < 1100) return;
    const pool = entries.filter(e => e.cover && ok(e)); if (!pool.length) return;
    const e = pool[Math.floor(Date.now() / 864e5) % pool.length];
    const hero = h('section', { className: 'hero', id: 'hero', 'aria-label': 'لعبة الليلة' }, art(e), h('span', { className: 'tag' }, 'لعبة الليلة'), h('h2', 0, e.h.title || e.name), e.h.desc ? h('p', 0, e.h.desc) : null, metaLine(e.meta),
      h('button', { className: 'pri', type: 'button', onclick: () => E.launch(e.src, e.h, null) }, icon('play'), 'العب الآن'));
    lead.classList.add('hero2'); lead.append(hero);
  }

  // ---------- الرقائق والأقسام ----------
  const CHIPS = [['all', 'الكل'], ['players', 'اللاعبون', 'users'], ['short', 'أقل من 3 د', 'clock'], ['young', 'العمر 4+', 'star'], ['coop', 'تعاون'], ['versus', 'تنافس'], ['calm', 'هادئة']];
  const pass = e => { const m = e.meta;
    if (F.has('players') && !fitsPlayers(m, N.pc)) return false; if (F.has('short') && !(m.minutes && m.minutes < 3)) return false; if (F.has('young') && !(m.age && m.age <= 4)) return false;
    for (const s of ['coop', 'versus', 'calm']) if (F.has(s) && !m.style.includes(s)) return false; return true; };
  function paintFilters() {
    const box = $('chips'); box.textContent = '';
    for (const [k, t, ic] of CHIPS) {
      const on = k === 'all' ? !F.size : F.has(k), lab = k === 'players' ? [t, ' ', h('bdi', { dir: 'ltr' }, PC[N.pc][2])] : [t];
      box.append(h('button', { type: 'button', className: 'fchip', 'data-f': k, 'aria-pressed': String(on), onclick: () => { if (k === 'all') F.clear(); else F.has(k) ? F.delete(k) : F.add(k); paintFilters(); paintShelves(); box.querySelector('[data-f="' + k + '"]').focus(); } },
        ic ? icon(ic) : null, ...lab, k === 'all' ? h('i', 0, String(entries.filter(pass).length)) : null));
    }
  }
  const SHELF = { camera: 'shCamera', pads: 'shPads', device: 'shDevice' };
  function buildCards() {
    for (const e of entries) {
      const b = h('button', { className: 'card g', type: 'button' }), body = h('span', { className: 'body' }), nt = h('em'); nt.hidden = true;
      b.dataset.src = e.src; b.dataset.play = e.meta.play; b.dataset.players = e.meta.players ? e.meta.players.join('-') : ''; b.dataset.minutes = e.meta.minutes || ''; b.dataset.age = e.meta.age || ''; b.dataset.style = e.meta.style.join(' ');
      b.style.setProperty('--ac', e.accent.c);
      const a = art(e), st = e.meta.style.find(s => s === 'teams' || s === 'coop'); if (st) a.append(h('span', { className: 'tag' }, STYLE[st]));
      body.append(h('b', 0, e.h.title || e.name), h('small', { className: 'd' }, e.h.desc), metaLine(e.meta));
      if (e.h.caps.includes('camera.view')) body.append(h('span', { className: 'badge' }, icon('camview'), 'تعرض صورتك على شاشتك'));
      body.append(nt); b.append(a, body); b.setAttribute('aria-label', (e.h.title || e.name) + (e.h.desc ? '، ' + e.h.desc : ''));
      b.onclick = () => E.launch(e.src, e.h, null); e.card = b;
      E.addCard({ b, h: e.h, n: nt });
    }
  }
  function paintShelves() {
    for (const [play, id] of Object.entries(SHELF)) {
      const sec = $(id), row = sec.querySelector('.shrow'), list = entries.filter(e => !e.quiz && e.meta.play === play), vis = list.filter(pass);
      row.textContent = ''; for (const e of list) { if (vis.includes(e)) row.append(e.card); }
      let em = sec.querySelector('.empty'); if (!vis.length) { if (!em) sec.append(em = h('p', { className: 'empty' })); em.textContent = list.length ? 'لا ألعاب هنا بهذا التصفية.' : 'لا ألعاب في هذا القسم بعد.'; } else if (em) em.remove();
      const more = sec.querySelector('.more:not(#tvBtn)'); if (more) { more.textContent = sec.classList.contains('open') ? 'أقل' : 'الكل ' + vis.length; more.hidden = vis.length < 3; more.onclick = () => { sec.classList.toggle('open'); paintShelves(); }; }
    }
    // ألعاب المسابقات (@pack) تعيش في قسم «مسابقات» فوق بلاطات الفئات
    const qg = $('quizGames'), ql = entries.filter(e => e.quiz && pass(e)); qg.textContent = ''; ql.forEach(e => qg.append(e.card)); qg.hidden = !ql.length;
    for (const e of entries) if (e.quiz && !ql.includes(e) && e.card.parentNode) e.card.remove();
    for (const e of entries) if (!e.quiz && !pass(e) && e.card.parentNode) e.card.remove();
  }
  // ---------- المسابقات: بلاطة لكل فئة رسمية + «أسئلة العائلة» + فئات العائلة ----------
  const TC = ['#3ddc97', '#4da3ff', '#ffc145', '#ff6b8b', '#ff8a3d', '#a37bff'];
  const quizGame = () => entries.find(e => e.quiz && ok(e)) || entries.find(e => e.src === 'games/quiz.js' && ok(e)) || null;
  function playPack(p) {
    const g = quizGame(); if (!g) { toast('لعبة المسابقة لم تُضف إلى هذه النسخة بعد'); return false; }
    E.launch(g.src, g.h, { id: p.id, title: p.name, questions: p.questions }); return true;
  }
  async function playOfficial(id, b) { try { b.disabled = true; playPack(await QuizPacks.official(id)); } catch (e) { toast('تعذّر تحميل أسئلة هذه الفئة'); } finally { b.disabled = false; } }
  async function paintQuiz() {
    const box = $('quizTiles'); if (!box || !window.QuizPacks) return; box.textContent = '';
    const fam = h('button', { type: 'button', className: 'qtile fam', id: 'famTile', onclick: () => QuizPacks.open() }, icon('plus'), h('small', 0, 'من صنعكم'), h('b', 0, 'أسئلة العائلة'));
    box.append(fam);
    for (const p of QuizPacks.list()) box.append(tile(p.name, p.questions.length, 5, () => playPack(p), p.imported ? 'مستوردة' : 'من صنعكم', 'u'));
    try { if (!quizIdx) quizIdx = await QuizPacks.index(); quizIdx.forEach((p, i) => box.append(tile(p.name, p.count, i, b => playOfficial(p.id, b), '', p.id))); } catch (e) { box.append(h('p', { className: 'empty' }, 'تعذّر تحميل فئات الأسئلة')); }
  }
  function tile(name, n, i, go, note, id) {
    const b = h('button', { type: 'button', className: 'qtile', 'data-pack': id }); b.style.setProperty('--tc', TC[i % TC.length]);
    if (M) b.append(M.el(i % 4)); b.append(h('small', 0, (note ? note + ' · ' : '') + n + ' سؤالًا'), h('b', 0, name)); b.onclick = () => go(b); return b;
  }

  // ---------- التنقّل ----------
  const PAGES = ['home', 'makePage', 'famPage'];
  function go(pg) {
    for (const p of PAGES) $(p).hidden = p !== pg;
    for (const b of document.querySelectorAll('#tabs [data-page]')) if (b.dataset.page === pg || (pg === 'famPage' && b.dataset.page === 'home')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    $('menu').scrollTop = 0; E.page = pg;
  }
  let toastT = 0; function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3200); }
  // أسهم الريموت/لوحة المفاتيح على التلفاز: أقرب عنصر قابل للتركيز في الاتجاه نفسه على الشاشة
  function spatial(e) {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d || e.altKey || e.ctrlKey || e.metaKey) return;
    const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return; if ($('menu').hidden || !$('settings').hidden || document.querySelector('.dlg')) return;
    const all = [...$('menu').querySelectorAll('button:not(:disabled),a[href],input,textarea')].filter(x => x.offsetWidth && x.offsetHeight && !x.closest('[hidden]'));
    if (!all.length) return; e.preventDefault();
    if (!a || a === document.body || !all.includes(a)) { all[0].focus(); return; }
    const r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let best = null, bs = Infinity;
    for (const x of all) { if (x === a) continue; const q = x.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy, along = dx * d[0] + dy * d[1]; if (along <= 4) continue; const side = Math.abs(dx * d[1] + dy * d[0]), s = along + side * 2.5; if (s < bs) { bs = s; best = x; } }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); }
  }
  function init() {
    document.querySelectorAll('svg.ic[data-i]').forEach(paint);
    $('tabHome').onclick = () => go('home'); $('tabMake').onclick = () => go('makePage'); $('makeCard').onclick = () => { go('makePage'); $('idea').focus(); };
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = () => go('home'); });
    addEventListener('keydown', spatial);
    paintNow(); paintQuiz();
  }
  function render(list) {
    entries = list; buildCards(); paintNow(); paintFilters(); paintShelves(); paintHero();
    if (bigScreen()) setTimeout(() => { if (!$('menu').hidden && document.activeElement === document.body && $('nowGo')) $('nowGo').focus({ preventScroll: true }); }, 50);
  }
  E.onAvail = () => { if (entries.length) { paintNow(); paintHero(); } };
  let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (entries.length) paintHero(); }, 200); });
  init();
  if (E.menuEntries) render(E.menuEntries); E.onMenu = render;
  E.home = { go, now: () => ({ pc: N.pc, play: N.play, pick: E.nowPick }), filters: () => [...F] };
  return { paint, icon, art, go, toast, playPack, refreshQuiz: paintQuiz };
})();
