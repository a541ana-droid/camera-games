'use strict';
// الرئيسية (0.7.0): هادئة وواضحة — صف فئات واحد (الكل · أمام الكاميرا · الجوالات أذرع · بيد الجوال · مسابقات، من @play في ENGINE.md §1.1)
// ثم شبكة بطاقات مربّعة بلون كل لعبة (2 على الجوال، 3 على اللوح، حتى 6 على التلفاز). النقر يفتح ورقة تفاصيل فيها «العب».
// وصفحة «كيف أشغّلها على التلفاز؟» (تُفتح من الرأس ومن ردهة التلفاز)، والتنقّل (شريط سفلي على الجوال، أسهم الريموت على التلفاز).
// الصور: الأغلفة المعتمدة فقط (COVERS في engine.js)؛ غيرها شكل هندسي أبيض على تدرّج بصمة اللعبة. لا وجوه ولا شخصيات ولا عيون في أي مكان.
window.CGHome = (() => {
  const E = window.__engine, $ = id => document.getElementById(id), M = window.CGPlayers;
  const NS = 'http://www.w3.org/2000/svg';
  const SITE = 'a541ana-droid.github.io/camera-games', ISSUES = 'https://github.com/a541ana-droid/camera-games/issues/new';
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
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>', play: '<path d="M6.5 4.5L18.5 12l-12 7.5z"/>', back: '<path d="M9 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>', paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/>',
    share: '<path d="M12 15V3M7 8l5-5 5 5M5 13v8h14v-8"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', camview: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
    tv: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.8M12 17h.01"/>'
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
  const actOf = e => e.quiz ? 'quiz' : e.h['howto-act'] && ART[e.h['howto-act']] ? e.h['howto-act'] : e.meta.play === 'pads' ? 'joystick' : e.meta.play === 'device' ? 'tilt' : 'wave';
  const acVars = (el, a) => { el.style.setProperty('--ac', a.c); el.style.setProperty('--ac-hi', a.hi); el.style.setProperty('--ac-lo', a.lo); };
  function art(e) {
    const a = h('span', { className: 'art' }); acVars(a, e.accent);
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 160 100'); s.setAttribute('preserveAspectRatio', 'xMidYMid meet'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ART[actOf(e)]; a.append(s);
    if (e.cover) { const img = new Image(); img.alt = ''; img.decoding = 'async'; img.className = 'pic'; img.onload = () => s.remove(); img.onerror = () => { img.remove(); a.parentNode && a.parentNode.classList.remove('pic'); }; img.src = e.cover; a.append(img); }
    return a;
  }
  const rng = p => p ? h('bdi', { dir: 'ltr' }, p[0] === p[1] ? String(p[0]) : p[0] + '–' + p[1]) : null;
  const STYLE = { coop: 'تعاون', versus: 'تنافس', teams: 'فريقان', calm: 'هادئة' };
  const PLAYN = { camera: 'أمام الكاميرا', pads: 'الجوالات أذرع', device: 'بيد الجوال' };
  // سطر قصير للبطاقة: أول جملة من @desc بلا ما بين القوسين (والبطاقة تقصّه على سطرين)
  const shortOf = d => { d = String(d || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().replace(/^[^.!؟:،]{2,30}:\s*/, ''); const m = /^(.{10,}?[.!؟])(?=\s|$)/.exec(d); return (m ? m[1] : d).replace(/\.$/, ''); };
  const lum = c => { const v = [1, 3, 5].map(i => { const x = parseInt(c.slice(i, i + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };

  // ---------- الحالة ----------
  const CATS = [['all', 'الكل', null], ['camera', 'أمام الكاميرا', 'camera'], ['pads', 'الجوالات أذرع', 'pads'], ['device', 'بيد الجوال', 'device'], ['quiz', 'مسابقات', 'quiz']];
  const bigScreen = () => innerWidth >= 1200 && navigator.maxTouchPoints === 0 && !matchMedia('(pointer:coarse)').matches;
  let entries = [], quizIdx = null, cat = 'all';
  const ok = e => !e.card || !e.card.disabled;
  const inCat = (e, c) => c === 'all' || (c === 'quiz' ? e.quiz : !e.quiz && e.meta.play === c);

  // ---------- الفئات ----------
  function paintCats() {
    const box = $('cats'); box.textContent = '';
    for (const [k, t, ic] of CATS) {
      const n = entries.filter(e => inCat(e, k)).length;
      const b = h('button', { type: 'button', role: 'tab', id: 'cat-' + k, 'data-cat': k, 'aria-selected': String(cat === k), tabIndex: cat === k ? 0 : -1, onclick: () => setCat(k) }, ic ? icon(ic) : null, t);
      if (k !== 'all' && k !== 'quiz' && !n) b.hidden = true; box.append(b);
    }
  }
  const NOTE = {
    camera: 'جهاز واحد على حامل، وأنتم تتحرّكون أمامه. الصورة لا تُحفظ ولا تُرسل.',
    pads: 'التلفاز أو اللابتوب للعرض، وكل لاعب يمسح الرمز بجواله.',
    device: 'جوال واحد يمرّ بينكم بالدور: ميلان ولمس.',
    quiz: 'الجوالات أزرار الإجابة. اختر لعبة، أو فئة أسئلة تحت.'
  };
  function paintNote() {
    const p = $('catNote'); p.textContent = ''; if (!NOTE[cat]) return;
    p.append(h('span', 0, NOTE[cat]));
    if (cat === 'pads') p.append(h('button', { type: 'button', id: 'padsOpen', onclick: () => window.Pads && Pads.open() }, icon('tv'), 'افتح شاشة العرض'), h('button', { type: 'button', onclick: () => { location.hash = 'pad'; } }, icon('qr'), 'انضم برمز'), h('button', { type: 'button', onclick: () => go('tvGuide') }, icon('help'), 'كيف؟'));
  }
  function setCat(k, focus = true) {
    if (!CATS.some(c => c[0] === k)) k = 'all'; cat = k; $('home').dataset.cat = k;
    for (const e of entries) if (e.card) e.card.hidden = !inCat(e, k);
    $('quizBox').hidden = k !== 'quiz'; $('list').setAttribute('aria-labelledby', 'cat-' + k);
    paintCats(); paintNote(); const b = $('cat-' + k); if (!b) return; if (focus) b.focus({ preventScroll: true });
    const box = $('cats'); if (box.scrollWidth > box.clientWidth) b.scrollIntoView({ block: 'nearest', inline: 'center' }); // الفئة المختارة تبقى ظاهرة في الصف المنزلق
  }

  // ---------- البطاقات ----------
  function buildCards() {
    const list = $('list'); list.textContent = '';
    for (const e of entries) {
      const t = e.h.title || e.name, sh = shortOf(e.h.desc), nt = h('em'); nt.hidden = true;
      const b = h('button', { className: 'card g' + (e.cover ? ' pic' : ''), type: 'button' });
      b.dataset.src = e.src; b.dataset.play = e.meta.play; b.dataset.players = e.meta.players ? e.meta.players.join('-') : ''; b.dataset.minutes = e.meta.minutes || ''; b.dataset.age = e.meta.age || ''; b.dataset.style = e.meta.style.join(' ');
      acVars(b, e.accent);
      b.append(art(e));
      if (e.meta.players) b.append(h('span', { className: 'pb', title: 'عدد اللاعبين' }, icon('users'), rng(e.meta.players)));
      if (e.h.caps.includes('camera.view')) b.append(h('span', { className: 'badge', title: 'تعرض صورتك على شاشتك' }, icon('camview')));
      b.append(h('b', 0, t), sh ? h('small', { className: 'd' }, sh) : null, nt);
      b.setAttribute('aria-label', t + (sh ? '، ' + sh : '') + (e.meta.players ? '، ' + (e.meta.players[0] === e.meta.players[1] ? e.meta.players[0] : e.meta.players[0] + ' إلى ' + e.meta.players[1]) + ' لاعبين' : ''));
      b.setAttribute('aria-haspopup', 'dialog');
      b.onclick = () => openSheet(e); e.card = b; list.append(b);
      E.addCard({ b, h: e.h, n: nt });
    }
  }

  // ---------- ورقة التفاصيل: الشرح كاملًا + «العب» ----------
  let sheet = null, sheetRet = null;
  function closeSheet() { if (!sheet) return; sheet.remove(); sheet = null; removeEventListener('keydown', sheetKey, true); if (sheetRet && sheetRet.isConnected) sheetRet.focus({ preventScroll: true }); sheetRet = null; }
  function sheetKey(ev) {
    if (!sheet) return; if (ev.key === 'Escape') { ev.preventDefault(); closeSheet(); return; }
    if (ev.key === 'Tab') { const f = [...sheet.querySelectorAll('button:not(:disabled),a[href]')]; if (!f.length) return; const i = f.indexOf(document.activeElement); if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); } else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); } }
  }
  function openSheet(e) {
    closeSheet(); sheetRet = e.card || document.activeElement;
    const m = e.meta, t = e.h.title || e.name, pads = m.play === 'pads' && !e.quiz, why = E.reasonFor ? E.reasonFor(e.h) : '';
    const play = () => { closeSheet(); E.launch(e.src, e.h, null); };
    const tags = [PLAYN[m.play], ...m.style.map(s => STYLE[s])].filter(Boolean);
    const meta = h('div', { className: 'meta' },
      m.players ? h('span', 0, icon('users'), rng(m.players), m.players[1] === 1 ? ' لاعب' : ' لاعبين') : null,
      m.minutes ? h('span', 0, icon('clock'), h('bdi', { dir: 'ltr' }, String(m.minutes)), ' د تقريبًا') : null,
      m.age ? h('span', 0, icon('star'), 'من عمر ', h('bdi', { dir: 'ltr' }, String(m.age))) : null);
    const go = h('button', { type: 'button', className: 'pri gplay', id: 'gsPlay', disabled: !!why, onclick: play }, icon('play'), pads ? 'العب على التلفاز' : 'العب');
    acVars(go, e.accent); go.style.setProperty('--on-ac', lum(e.accent.c) > 0.42 ? '#111113' : '#fff');
    const box = h('div', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gsT' },
      h('button', { type: 'button', className: 'gx', 'aria-label': 'إغلاق', onclick: closeSheet }, '✕'), art(e),
      h('div', { className: 'gb' }, h('h3', { id: 'gsT' }, t), tags.length ? h('div', { className: 'gtags' }, ...tags.map(x => h('span', 0, x))) : null, meta,
        e.h.desc ? h('p', { id: 'gsD' }, e.h.desc) : null,
        e.h.caps.includes('camera.view') ? h('span', { className: 'badge' }, icon('camview'), 'تعرض صورتك على شاشتك فقط') : null,
        pads ? h('p', { className: 'gnote' }, 'تُفتح هنا شاشة العرض (تلفاز أو لابتوب)، وكل لاعب ينضم بجواله.') : null,
        why ? h('p', { className: 'gwhy' }, why) : null, go,
        pads ? h('div', { className: 'galt' }, h('button', { type: 'button', onclick: () => { closeSheet(); location.hash = 'pad'; } }, icon('qr'), 'انضم برمز'), h('button', { type: 'button', onclick: () => { closeSheet(); go2('tvGuide'); } }, icon('help'), 'كيف أشغّلها؟')) : null,
        e.quiz ? h('div', { className: 'galt' }, h('button', { type: 'button', onclick: () => { closeSheet(); setCat('quiz'); $('quizBox').scrollIntoView({ block: 'start' }); } }, icon('quiz'), 'اختر فئة الأسئلة')) : null));
    sheet = h('div', { className: 'gsheet', id: 'gsheet' }, box); sheet.dataset.src = e.src;
    sheet.addEventListener('click', ev => { if (ev.target === sheet) closeSheet(); });
    document.body.append(sheet); addEventListener('keydown', sheetKey, true);
    (go.disabled ? box.querySelector('.gx') : go).focus({ preventScroll: true });
  }
  const go2 = pg => go(pg);

  // ---------- المسابقات: بلاطة لكل فئة رسمية + «أسئلة العائلة» + فئات العائلة ----------
  const TC = ['#3ddc97', '#4da3ff', '#ffc145', '#ff6b8b', '#ff8a3d', '#5ad1e6'];
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
    try { if (!quizIdx) quizIdx = await QuizPacks.index(); quizIdx.forEach((p, i) => box.append(tile(p.name, p.count, i, b => playOfficial(p.id, b), '', p.id))); } catch (e) { box.append(h('p', { className: 'gnote' }, 'تعذّر تحميل فئات الأسئلة')); }
  }
  function tile(name, n, i, go, note, id) {
    const b = h('button', { type: 'button', className: 'qtile', 'data-pack': id }); b.style.setProperty('--tc', TC[i % TC.length]);
    if (M) b.append(M.el(i % 4)); b.append(h('small', 0, (note ? note + ' · ' : '') + n + ' سؤالًا'), h('b', 0, name)); b.onclick = () => go(b); return b;
  }

  // ---------- «كيف أشغّلها على التلفاز؟» (يصف المسار الفعلي في tv.js وnet.js وpad.js) ----------
  const L = t => h('bdi', { dir: 'ltr' }, t);
  function guide(inLobby) {
    const way = (n, title, lead, steps) => h('section', { className: 'gway' }, h('h3', 0, h('i', 0, String(n)), title), lead ? h('p', 0, lead) : null, h('ol', 0, ...steps.map(s => h('li', 0, ...[].concat(s)))));
    const copy = h('button', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText('https://' + SITE); toast('نُسخ العنوان'); } catch (e) { toast(SITE); } } }, icon('copy'), 'انسخ');
    return h('div', { className: 'guide' },
      h('p', { className: 'gnote', style: 'font-size:16px;color:var(--fg)' }, 'شاشة كبيرة واحدة للعرض (تلفاز أو لابتوب)، وجوال لكل لاعب يصير ذراع تحكّم. لا حساب ولا تسجيل ولا تطبيق يُنزَّل.'),
      inLobby ? null : h('div', { className: 'gacts' },
        h('button', { type: 'button', className: 'pri', id: 'tvBtn', onclick: () => window.Pads && Pads.open() }, icon('tv'), 'افتح شاشة العرض'),
        h('button', { type: 'button', id: 'joinBtn', onclick: () => { location.hash = 'pad'; } }, icon('qr'), 'انضم برمز (للجوال)')),
      h('div', { className: 'gaddr' }, h('span', 0, 'عنوان الموقع', h('b', { id: 'gSite' }, SITE.replace(/\/.*/, '/'), h('wbr'), SITE.replace(/^[^/]*\//, ''))), copy),
      way(1, 'متصفح التلفاز الذكي', 'لأغلب تلفزيونات سامسونج وإل جي وأندرويد تي في.', [
        'افتح متصفح الإنترنت في التلفاز، واكتب العنوان أعلاه.',
        ['اضغط «على التلفاز» ثم «افتح شاشة العرض».'],
        'يظهر على التلفاز رمز QR ورمز غرفة من 4 أحرف.',
        'كل لاعب يمسح رمز QR بكاميرا جواله. أو يفتح الموقع في جواله ويضغط «على التلفاز» ثم «انضم برمز»، ويكتب الرمز.',
        'يختار كل لاعب لونه وشكله واسمه. أول من ينضم هو القائد: يختار اللعبة من جواله ويبدأ، أو اضغطوا «ابدأ اللعب» على الشاشة.']),
      way(2, 'لابتوب أو كمبيوتر موصول بالتلفاز', 'إن لم يكن في التلفاز متصفح، أو كان بطيئًا.', [
        ['وصّل الجهاز بالتلفاز بكابل ', L('HDMI'), '، واختر مدخله من ريموت التلفاز.'],
        ['افتح العنوان في متصفح الجهاز، واجعل الصفحة ملء الشاشة (', L('F11'), ' على ويندوز، أو ', L('Ctrl+Cmd+F'), ' على ماك).'],
        'ثم الخطوات نفسها: «افتح شاشة العرض»، وكل لاعب ينضم بجواله.']),
      way(3, 'عكس الشاشة بلا كابل', 'الأنسب لألعاب «أمام الكاميرا»: اعكسوا الجهاز الذي فيه الكاميرا، فتلعبون أمامه وتشاهدون على التلفاز.', [
        'ثبّتوا الجوال أو اللابتوب على حامل، والكاميرا تواجهكم.',
        ['آيفون أو ماك: ', L('AirPlay'), ' — «مركز التحكّم» ثم «انعكاس الشاشة».'],
        ['أندرويد: ', L('Smart View'), ' أو «بث الشاشة» إلى التلفاز أو ', L('Chromecast'), '.'],
        ['ويندوز: ', L('Win + K'), ' (', L('Miracast'), ')، وكروم: القائمة ⋮ ثم «إرسال».'],
        'افتحوا اللعبة من الجهاز نفسه، وقفوا أمام الكاميرا.']),
      h('p', { className: 'gnote' }, 'كل الأجهزة تحتاج إنترنت لحظة الربط، والأفضل أن تكون على الواي فاي نفسه. لا تخرج صورة ولا صوت من الجوالات: أوامر التحكّم فقط. إن لم يتّصل جوال فتأكّد من الإنترنت فيه وامسح الرمز من جديد.'),
      h('p', { className: 'gnote' }, h('a', { href: ISSUES, target: '_blank', rel: 'noopener', style: 'color:var(--fg);font-weight:700' }, 'اقتراح أو مشكلة؟ تواصل معنا ↗')));
  }
  function buildGuide() {
    const pg = $('tvGuide'); pg.textContent = '';
    pg.append(h('div', { className: 'subh' }, h('button', { className: 'back', type: 'button', 'aria-label': 'رجوع', onclick: () => go('home') }, icon('back')), h('h2', 0, 'كيف أشغّلها على التلفاز؟')), guide(false));
  }
  // من ردهة التلفاز: نافذة فوق الردهة (لا تُغلق الغرفة ولا يخرج اللاعبون)
  function guideDialog() {
    const close = () => { d.remove(); removeEventListener('keydown', esc, true); }, esc = ev => { if (ev.key === 'Escape') close(); };
    const d = h('div', { className: 'dlg', id: 'guideDlg' }, h('div', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gdT' },
      h('div', { className: 'subh' }, h('button', { className: 'back', type: 'button', 'aria-label': 'رجوع إلى الردهة', onclick: () => close() }, icon('back')), h('h2', { id: 'gdT', style: 'font-size:22px' }, 'كيف أشغّلها على التلفاز؟')), guide(true)));
    d.addEventListener('click', ev => { if (ev.target === d) close(); }); addEventListener('keydown', esc, true);
    document.body.append(d); d.querySelector('.back').focus({ preventScroll: true }); return d;
  }

  // ---------- التنقّل ----------
  const PAGES = ['home', 'makePage', 'famPage', 'tvGuide'];
  function go(pg) {
    closeSheet();
    for (const p of PAGES) $(p).hidden = p !== pg;
    for (const b of document.querySelectorAll('#tabs [data-page]')) if (b.dataset.page === pg || ((pg === 'famPage' || pg === 'tvGuide') && b.dataset.page === 'home')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    $('menu').scrollTop = 0; E.page = pg;
    if (pg !== 'home') { const bk = $(pg).querySelector('.back'); if (bk) bk.focus({ preventScroll: true }); }
  }
  let toastT = 0; function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3200); }
  // أسهم الريموت/لوحة المفاتيح على التلفاز: أقرب عنصر قابل للتركيز في الاتجاه نفسه على الشاشة
  function spatial(e) {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d || e.altKey || e.ctrlKey || e.metaKey) return;
    const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    const root = sheet || (!$('menu').hidden && $('settings').hidden && !document.querySelector('.dlg') ? $('menu') : null); if (!root) return;
    const all = [...root.querySelectorAll('button:not(:disabled),a[href],input,textarea')].filter(x => x.offsetWidth && x.offsetHeight && !x.closest('[hidden]'));
    if (!all.length) return; e.preventDefault();
    if (!a || a === document.body || !all.includes(a)) { all[0].focus(); return; }
    const r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let best = null, bs = Infinity;
    for (const x of all) { if (x === a) continue; const q = x.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy, along = dx * d[0] + dy * d[1]; if (along <= 4) continue; const side = Math.abs(dx * d[1] + dy * d[0]), s = along + side * 2.5; if (s < bs) { bs = s; best = x; } }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); }
  }
  function init() {
    document.querySelectorAll('svg.ic[data-i]').forEach(paint);
    $('tabHome').onclick = () => { go('home'); if (cat !== 'all') setCat('all', false); }; $('tabMake').onclick = () => go('makePage'); $('makeCard').onclick = () => { go('makePage'); $('idea').focus(); };
    $('tvGuideBtn').onclick = () => go('tvGuide'); $('footGuide').onclick = ev => { ev.preventDefault(); go('tvGuide'); };
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = () => go('home'); });
    $('cats').addEventListener('keydown', ev => { const k = { ArrowLeft: 1, ArrowRight: -1 }[ev.key]; if (!k) return; const vis = CATS.map(c => c[0]).filter(c => !$('cat-' + c).hidden), i = vis.indexOf(cat); ev.preventDefault(); ev.stopPropagation(); setCat(vis[(i + k + vis.length) % vis.length]); }); // RTL: السهم الأيسر = التالي
    addEventListener('keydown', spatial);
    buildGuide(); paintCats(); setCat('all', false); paintQuiz();
  }
  function render(list) {
    entries = list; buildCards(); setCat(cat, false);
    if (bigScreen()) setTimeout(() => { if (!$('menu').hidden && document.activeElement === document.body) { const f = $('list').querySelector('.card:not(:disabled):not([hidden])'); if (f) f.focus({ preventScroll: true }); } }, 50);
  }
  init();
  if (E.menuEntries) render(E.menuEntries); E.onMenu = render;
  E.home = { go, cat: () => cat, setCat: k => setCat(k, false), open: src => { const e = entries.find(x => x.src === src); if (e) openSheet(e); return !!e; }, sheet: () => sheet && sheet.dataset.src, close: closeSheet, guide: guideDialog };
  return { paint, icon, art, go, toast, playPack, refreshQuiz: paintQuiz, guide: guideDialog, sheet: openSheet };
})();
