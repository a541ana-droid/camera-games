'use strict';
// حزم الأسئلة (0.6.1، ENGINE.md §3.6): البنك الرسمي (games/quiz/*.json) و«أسئلة العائلة» التي تُصنع على الجهاز وتُشارك بملف أو رابط أو QR.
// المحتوى بيانات لا شيفرة: JSON.parse فقط، قائمة بيضاء للحقول تُنسخ إلى كائنات جديدة، حدود أطوال، تنظيف محارف التحكم والاتجاه، وعرض بـtextContent وحده.
// لا شبكة: الرابط يحمل الحزمة في الجزء بعد # (لا يصل أي خادم)، والملف والـQR محليان. التخزين localStorage على هذا الجهاز فقط.
window.QuizPacks = (() => {
  const E = window.__engine, $ = id => document.getElementById(id);
  const KEY = 'quizPacks', MAXP = 50, MAXQ = 200, LQ = 140, LC = 60, LE = 200, LN = 30, MAXIN = 1 << 20, LINKMAX = 8000, QRMAX = 1500;
  const CTRL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;
  const h = (tag, p, ...kids) => { const e = document.createElement(tag); if (p) for (const k in p) { if (k === 'style') e.style.cssText = p[k]; else if (k.startsWith('on') || k in e) e[k] = p[k]; else e.setAttribute(k, p[k]); } e.append(...kids.filter(k => k != null && k !== false)); return e; };
  const txt = v => typeof v === 'string' ? v.replace(CTRL, '').replace(/\s+/g, ' ').trim() : null;

  // ---------- التحقق الصارم ----------
  // يقبل: حزمة {name, questions:[{question|q, choices, answer, explanation|explain?}]} أو الصيغة المضغوطة [1, اسم, أيقونة, عمر, [[س, [اختيارات], فهرس, شرح?]…]]
  // يعيد {ok, pack:{name, questions:[{q, choices, answer, explain?, kid?}]}, warn:[…]} أو {ok:false, error}
  function clean(input) {
    let o = input;
    if (typeof o === 'string') { if (o.length > MAXIN) return { ok: false, error: 'الملف أكبر من 1 ميغابايت' }; o = parseLoose(o); if (o === undefined) return { ok: false, error: 'النص ليس JSON صالحًا' }; }
    if (Array.isArray(o)) { if (o[0] !== 1 || !Array.isArray(o[4])) return { ok: false, error: 'صيغة غير معروفة' }; o = { name: o[1], age: o[3], questions: o[4].map(x => Array.isArray(x) ? { q: x[0], choices: x[1], answer: x[2], explain: x[3] } : null) }; }
    if (!o || typeof o !== 'object') return { ok: false, error: 'ليست حزمة أسئلة' };
    const warn = []; let name = txt(o.name);
    if (!name) return { ok: false, error: 'الحزمة بلا اسم' };
    if (name.length > LN) { name = name.slice(0, LN); warn.push('قُصّ الاسم إلى ' + LN + ' حرفًا'); }
    if (!Array.isArray(o.questions) || !o.questions.length) return { ok: false, error: 'لا أسئلة في الحزمة' };
    if (o.questions.length > MAXQ) return { ok: false, error: 'أكثر من ' + MAXQ + ' سؤال' };
    const kidAll = o.age === '4-7', qs = []; let dropped = 0, cut = 0;
    for (const x of o.questions) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) { dropped++; continue; }
      const q = txt(x.q !== undefined ? x.q : x.question), ch = Array.isArray(x.choices) ? x.choices.map(txt) : null, a = x.answer;
      if (!q || q.length > LQ || !ch || ch.length < 2 || ch.length > 4 || ch.some(c => !c || c.length > LC) || new Set(ch).size !== ch.length || !Number.isInteger(a) || a < 0 || a >= ch.length) { dropped++; continue; }
      const out = { q, choices: ch, answer: a }, ex = txt(x.explain !== undefined ? x.explain : x.explanation);
      if (ex) { if (ex.length <= LE) out.explain = ex; else cut++; }
      if (x.kid === true || x.age === '4-7' || kidAll) out.kid = true;
      qs.push(out);
    }
    if (dropped) warn.push(dropped + ' سؤالًا غير صالح حُذف (طول زائد، أو اختيارات ناقصة أو مكرّرة، أو جواب خارج المدى)');
    if (cut) warn.push(cut + ' شرحًا تجاوز ' + LE + ' حرفًا فحُذف');
    if (!qs.length) return { ok: false, error: 'لا سؤال صالحًا في الحزمة' };
    return { ok: true, pack: { name, questions: qs }, warn };
  }
  // يستخرج أول كائن/مصفوفة JSON متوازنة من نص (ردّ مساعد قد يحيطه كلام أو ```)
  function parseLoose(t) {
    try { return JSON.parse(t); } catch (e) { /* */ }
    const i = t.search(/[[{]/); if (i < 0) return undefined; let d = 0, q = false, esc = false;
    for (let j = i; j < t.length; j++) { const c = t[j]; if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') q = false; continue; }
      if (c === '"') q = true; else if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { if (--d === 0) { try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { return undefined; } } } }
    return undefined;
  }

  // ---------- التخزين (هذا الجهاز فقط) ----------
  const list = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(p => p && typeof p.id === 'string' && clean(p).ok) : []; } catch (e) { return []; } };
  const write = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } };
  const sig = p => JSON.stringify([p.name, p.questions]);
  function save(pack, opts = {}) {
    const r = clean(pack); if (!r.ok) return r; const a = list();
    const id = opts.id && /^u-[\w]{4,20}$/.test(opts.id) ? opts.id : 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const rec = { id, name: r.pack.name, questions: r.pack.questions, imported: !!opts.imported, at: Date.now() };
    const i = a.findIndex(x => x.id === id); if (i >= 0) a[i] = rec; else { if (a.length >= MAXP) return { ok: false, error: 'وصلت إلى ' + MAXP + ' فئة؛ احذف واحدة أولًا' }; a.unshift(rec); }
    return write(a) ? { ok: true, pack: rec, warn: r.warn } : { ok: false, error: 'ذاكرة المتصفح ممتلئة' };
  }
  const remove = id => write(list().filter(x => x.id !== id));
  const get = id => list().find(x => x.id === id) || null;

  // ---------- البنك الرسمي ----------
  let idx = null; const cache = {};
  const index = () => idx || (idx = fetch('games/quiz/index.json').then(r => r.ok ? r.json() : Promise.reject(new Error('index'))).then(j => (Array.isArray(j.packs) ? j.packs : []).filter(p => p && /^[a-z]{2,8}$/.test(p.id)).map(p => ({ id: p.id, name: txt(p.name) || p.id, count: Number.isInteger(p.count) ? p.count : 0, kid: p.kid === true }))).catch(e => { idx = null; throw e; }));
  async function official(id) {
    if (!/^[a-z]{2,8}$/.test(id)) throw new Error('id');
    if (!cache[id]) cache[id] = fetch('games/quiz/' + id + '.json').then(r => r.ok ? r.text() : Promise.reject(new Error(id))).then(t => { const r = clean(t); if (!r.ok) throw new Error(r.error); return { id, name: r.pack.name, questions: r.pack.questions }; }).catch(e => { delete cache[id]; throw e; });
    return cache[id];
  }
  async function mix(n = 40) { // «منوّعة»: من كل الفئات الرسمية عدا فئة الصغار
    const ps = await Promise.all((await index()).filter(p => !p.kid).map(p => official(p.id).catch(() => null)));
    const all = [].concat(...ps.filter(Boolean).map(p => p.questions)); for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return { id: 'mix', name: 'منوّعة', questions: all.slice(0, n) };
  }

  // ---------- الترميز للمشاركة: [1,اسم,"",عمر,[[س,[اختيارات],فهرس,شرح?]…]] ← deflate-raw ← base64url ----------
  const compact = (p, withExplain) => [1, p.name, '', p.questions.every(q => q.kid) ? '4-7' : '', p.questions.map(q => withExplain && q.explain ? [q.q, q.choices, q.answer, q.explain] : [q.q, q.choices, q.answer])];
  const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function pipe(u8, T) { const r = new Blob([u8]).stream().pipeThrough(T).getReader(), out = []; let n = 0; for (;;) { const { done, value } = await r.read(); if (done) break; n += value.length; if (n > MAXIN) { r.cancel().catch(() => {}); throw new Error('big'); } out.push(value); } const u = new Uint8Array(n); let o = 0; for (const c of out) { u.set(c, o); o += c.length; } return u; }
  const Z = typeof CompressionStream === 'function';
  async function encode(p, withExplain) { const raw = new TextEncoder().encode(JSON.stringify(compact(p, withExplain))); return Z ? '1.' + b64u(await pipe(raw, new CompressionStream('deflate-raw'))) : '0.' + b64u(raw); }
  async function decode(s) {
    const m = /^([01])\.([\w-]{4,})$/.exec(String(s || '')); if (!m) throw new Error('رابط غير صالح'); if (m[2].length > MAXIN) throw new Error('الرابط أطول من المسموح');
    let u = unb64u(m[2]); if (m[1] === '1') { if (typeof DecompressionStream !== 'function') throw new Error('المتصفح لا يفكّ هذا الرابط'); u = await pipe(u, new DecompressionStream('deflate-raw')); } // سقف 1 ميغابايت بعد الفك (قنبلة الضغط)
    if (u.length > MAXIN) throw new Error('big'); return new TextDecoder().decode(u);
  }
  const linkOf = code => location.origin + location.pathname + '#quiz=' + code;
  const exportFile = p => JSON.stringify({ schema: 'camera-games.quiz-pack/1', name: p.name, language: 'ar', questions: p.questions.map(q => Object.assign({ question: q.q, choices: q.choices, answer: q.answer }, q.explain ? { explanation: q.explain } : {}, q.kid ? { age: '4-7' } : {})) }, null, 1);

  // ---------- واجهة «أسئلة العائلة» ----------
  const ICON = (n, cls) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic' + (cls ? ' ' + cls : '')); s.setAttribute('data-i', n); if (window.CGHome) CGHome.paint(s); return s; };
  const toast = t => window.CGHome ? CGHome.toast(t) : alert(t);
  const page = () => $('famPage');
  function open() { if (window.CGHome) CGHome.go('famPage'); renderList(); }
  function head(title, back) { return h('div', { className: 'subh' }, h('button', { className: 'back', type: 'button', 'aria-label': 'رجوع', onclick: back }, ICON('back')), h('h2', 0, title)); }
  function renderList() {
    const v = page(), a = list(); v.textContent = '';
    v.append(head('أسئلة العائلة', () => CGHome.go('home')),
      h('p', { className: 'sethint', style: 'max-width:820px' }, 'اصنعوا فئة أسئلة خاصة بكم. تُحفظ على هذا الجهاز فقط ولا تُرسل لأي مكان. شاركوها بملف أو رابط أو رمز QR لتبقى عندكم نسخة، لأن بعض المتصفحات تمسح بيانات المواقع غير المستعملة.'),
      h('div', { className: 'fbar' }, h('button', { className: 'pri', type: 'button', id: 'famNew', onclick: () => edit(null) }, ICON('plus'), 'فئة جديدة'),
        h('button', { type: 'button', id: 'famFile', onclick: () => $('famFileIn').click() }, ICON('file'), 'استيراد ملف'),
        h('button', { type: 'button', id: 'famPaste', onclick: pasteBox }, ICON('paste'), 'لصق نص'),
        h('input', { type: 'file', id: 'famFileIn', accept: '.json,.cgquiz,application/json,text/plain', hidden: true, onchange: async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > MAXIN) return toast('الملف أكبر من 1 ميغابايت'); preview(clean(await f.text()), 'ملف'); } })),
      h('div', { id: 'famPasteBox' }));
    const box = h('div', { className: 'flist', id: 'famList' }); v.append(box);
    if (!a.length) box.append(h('p', { className: 'sethint' }, 'لا فئات بعد. ابدؤوا بـ«فئة جديدة»: سؤال، واختياران أو أكثر، وحدّدوا الصحيح.'));
    for (const p of a) box.append(h('div', { className: 'fpack', 'data-id': p.id },
      h('div', { className: 't' }, h('b', 0, p.name), h('small', 0, p.questions.length + ' سؤالًا'), p.imported ? h('span', { className: 'warnchip' }, 'مستوردة — غير مُراجعة') : null),
      h('div', { className: 'acts2' }, h('button', { className: 'pri', type: 'button', onclick: () => play(p) }, ICON('play'), 'العب'),
        h('button', { type: 'button', onclick: () => edit(p) }, ICON('edit'), 'عدّل'),
        h('button', { type: 'button', onclick: () => share(p) }, ICON('share'), 'شارك'),
        h('button', { type: 'button', 'aria-label': 'احذف ' + p.name, onclick: () => { if (confirm('تحذف فئة «' + p.name + '» من هذا الجهاز؟')) { remove(p.id); renderList(); if (window.CGHome) CGHome.refreshQuiz(); } } }, ICON('trash')))));
  }
  function pasteBox() {
    const b = $('famPasteBox'); if (b.firstChild) { b.textContent = ''; return; }
    const t = h('textarea', { className: 'fin', rows: 5, dir: 'auto', placeholder: 'الصق هنا ملف الفئة أو ردّ المساعد (JSON)', 'aria-label': 'نص الفئة' });
    b.append(h('div', { className: 'panel2' }, t, h('div', { className: 'row' }, h('button', { className: 'pri', type: 'button', onclick: () => preview(clean(t.value), 'نص ملصق') }, 'معاينة'))));
    t.focus();
  }
  function play(p) { if (!window.CGHome) return; CGHome.playPack({ id: p.id, name: p.name, questions: p.questions }); }

  // المحرّر: سؤال + 2 إلى 4 اختيارات + الصحيح + شرح اختياري. التحقق نفسه (clean) قبل الحفظ.
  function edit(p) {
    const v = page(); v.textContent = '';
    const st = p ? { id: p.id, imported: p.imported, name: p.name, qs: p.questions.map(q => ({ q: q.q, choices: q.choices.concat(['', '', '', '']).slice(0, 4), answer: q.answer, explain: q.explain || '' })) } : { name: '', qs: [{ q: '', choices: ['', '', '', ''], answer: -1, explain: '' }] };
    const cnt = (el, max) => { const c = h('small', { className: 'cnt' }); const u = () => { c.textContent = el.value.length + '/' + max; }; el.addEventListener('input', u); u(); return c; };
    const nameIn = h('input', { className: 'fin', id: 'famName', maxLength: LN, value: st.name, placeholder: 'مثال: أسئلة بيتنا', 'aria-label': 'اسم الفئة' });
    const qbox = h('div', { id: 'famQs' }), err = h('p', { className: 'ferr', id: 'famErr', role: 'alert' });
    const draw = () => {
      qbox.textContent = '';
      st.qs.forEach((x, qi) => {
        const qt = h('textarea', { className: 'fin', maxLength: LQ, rows: 2, value: x.q, placeholder: 'السؤال', 'aria-label': 'نص السؤال ' + (qi + 1), oninput: e => { x.q = e.target.value; } });
        const fs = h('fieldset', { className: 'fq' }, h('legend', 0, 'سؤال ' + (qi + 1)), qt, cnt(qt, LQ));
        x.choices.forEach((c, ci) => {
          const r = h('input', { type: 'radio', name: 'ans' + qi, checked: x.answer === ci, 'aria-label': 'الاختيار ' + (ci + 1) + ' هو الصحيح', onchange: () => { x.answer = ci; } });
          const ip = h('input', { className: 'fin', maxLength: LC, value: c, placeholder: ci < 2 ? 'اختيار ' + (ci + 1) : 'اختيار ' + (ci + 1) + ' (اختياري)', 'aria-label': 'الاختيار ' + (ci + 1), oninput: e => { x.choices[ci] = e.target.value; } });
          fs.append(h('div', { className: 'fch' }, r, ip));
        });
        const ex = h('input', { className: 'fin', maxLength: LE, value: x.explain, placeholder: 'شرح بعد الإجابة (اختياري)', 'aria-label': 'شرح السؤال ' + (qi + 1), oninput: e => { x.explain = e.target.value; } });
        fs.append(h('small', { className: 'sethint' }, 'حدّدوا الدائرة بجانب الإجابة الصحيحة.'), ex, h('div', { className: 'row' }, st.qs.length > 1 ? h('button', { type: 'button', onclick: () => { st.qs.splice(qi, 1); draw(); } }, ICON('trash'), 'احذف السؤال') : null));
        qbox.append(fs);
      });
    };
    const collect = () => {
      const qs = [], bad = [];
      st.qs.forEach((x, i) => { const ch = [], map = []; x.choices.forEach((c, ci) => { if (c.trim()) { map[ci] = ch.length; ch.push(c); } });
        if (!x.q.trim() && !ch.length) return; // سؤال فارغ تمامًا يُتجاهل
        if (!x.q.trim()) bad.push('سؤال ' + (i + 1) + ': اكتب السؤال'); else if (ch.length < 2) bad.push('سؤال ' + (i + 1) + ': اكتب اختيارين على الأقل');
        else if (new Set(ch.map(c => c.trim())).size !== ch.length) bad.push('سؤال ' + (i + 1) + ': تكرار في الاختيارات'); else if (map[x.answer] === undefined) bad.push('سؤال ' + (i + 1) + ': لم تحدد الإجابة الصحيحة');
        qs.push(Object.assign({ q: x.q, choices: ch, answer: map[x.answer] === undefined ? -1 : map[x.answer] }, x.explain.trim() ? { explain: x.explain } : {})); });
      if (!nameIn.value.trim()) bad.unshift('اكتب اسم الفئة'); if (!qs.length) bad.push('أضف سؤالًا واحدًا على الأقل');
      return { bad, pack: { name: nameIn.value, questions: qs } };
    };
    draw();
    v.append(head(p ? 'تعديل «' + p.name + '»' : 'فئة جديدة', renderList),
      h('div', { className: 'panel2', style: 'max-width:820px' }, h('label', { htmlFor: 'famName' }, 'اسم الفئة'), nameIn, cnt(nameIn, LN)),
      h('div', { style: 'max-width:820px' }, qbox, h('button', { type: 'button', id: 'famAddQ', onclick: () => { if (st.qs.length >= MAXQ) return; st.qs.push({ q: '', choices: ['', '', '', ''], answer: -1, explain: '' }); draw(); qbox.lastChild.querySelector('textarea').focus(); } }, ICON('plus'), 'سؤال جديد'),
        err, h('div', { className: 'row' }, h('button', { className: 'pri big', type: 'button', id: 'famSave', onclick: () => {
          const c = collect(); err.textContent = c.bad.join(' · '); if (c.bad.length) return;
          const r = save(c.pack, { id: st.id, imported: st.imported }); if (!r.ok) { err.textContent = r.error; return; }
          toast('حُفظت «' + r.pack.name + '» (' + r.pack.questions.length + ' سؤالًا)'); if (window.CGHome) CGHome.refreshQuiz(); renderList(); } }, 'احفظ'),
          h('button', { type: 'button', onclick: renderList }, 'إلغاء'))));
    nameIn.focus();
  }

  // ---------- نوافذ: المشاركة والمعاينة ----------
  function dialog(id, ...kids) { const old = $(id); if (old) old.remove(); const box = h('div', 0, ...kids), d = h('div', { className: 'dlg', id, role: 'dialog', 'aria-modal': 'true' }, box); const ret = document.activeElement;
    d.close = () => { d.remove(); if (ret && ret.focus) ret.focus({ preventScroll: true }); }; d.onclick = e => { if (e.target === d) d.close(); }; d.onkeydown = e => { if (e.key === 'Escape') d.close(); }; document.body.append(d); const f = d.querySelector('button'); if (f) f.focus(); return d; }
  async function share(p) {
    const fname = (p.name.replace(/[\\/:*?"<>|#%\s]+/g, '-').slice(0, 30) || 'quiz') + '.quiz.json', body = exportFile(p);
    const link = h('input', { className: 'fin', readOnly: true, dir: 'ltr', id: 'shLink', 'aria-label': 'رابط الفئة' }), qr = h('canvas', { className: 'sqr', width: 600, height: 600, id: 'shQr', 'aria-label': 'رمز QR للفئة' }), note = h('p', { className: 'sethint', id: 'shNote' });
    const d = dialog('famShare', h('h3', 0, 'شارك «' + p.name + '»'), h('p', { className: 'sethint' }, 'الرابط يحمل الأسئلة نفسها بعد علامة # فلا تمرّ على أي خادم. من يفتحه يرى معاينة ثم يقرّر الحفظ.'),
      h('div', { className: 'row' }, h('button', { className: 'pri', type: 'button', id: 'shFile', onclick: async () => {
        const f = new File([body], fname, { type: 'application/json' });
        try { if (navigator.canShare && navigator.canShare({ files: [f] }) && matchMedia('(pointer:coarse)').matches) { await navigator.share({ files: [f], title: p.name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
        const u = URL.createObjectURL(f), a = h('a', { href: u, download: fname }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } }, ICON('file'), 'ملف'),
        h('button', { type: 'button', id: 'shCopy', onclick: async () => { try { await navigator.clipboard.writeText(link.value); toast('نُسخ الرابط'); } catch (e) { link.select(); toast('حدّد الرابط وانسخه'); } } }, ICON('link'), 'انسخ الرابط'),
        h('button', { type: 'button', onclick: () => d.close() }, 'إغلاق')),
      link, qr, note);
    let code = ''; try { code = await encode(p, false); } catch (e) { note.textContent = 'تعذّر تجهيز الرابط على هذا المتصفح؛ استعمل الملف.'; }
    const url = code ? linkOf(code) : ''; d.dataset.len = url.length;
    if (url && url.length <= LINKMAX) link.value = url; else { link.hidden = true; $('shCopy').hidden = true; if (code) note.textContent = 'الفئة كبيرة على الرابط؛ استعمل الملف.'; }
    if (url && url.length <= QRMAX) { try { await loadQR(); const q = qrcode(0, 'L'); q.addData(url); q.make(); paintQR(qr, q); d.dataset.qr = q.getModuleCount(); } catch (e) { qr.hidden = true; note.textContent = 'الفئة كبيرة على QR؛ استعمل الرابط أو الملف.'; } }
    else { qr.hidden = true; if (url && url.length <= LINKMAX) note.textContent = 'الفئة كبيرة على QR؛ استعمل الرابط أو الملف.'; }
  }
  let qrLib = null; const loadQR = () => qrLib || (qrLib = new Promise((ok, no) => { if (typeof qrcode === 'function') return ok(); const s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = ok; s.onerror = () => { qrLib = null; no(new Error('qr')); }; document.head.append(s); }));
  function paintQR(c, q) { const g = c.getContext('2d'), n = q.getModuleCount(), cell = Math.floor(c.width / (n + 4)), off = Math.floor((c.width - cell * n) / 2); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#1a1430'; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect(off + x * cell, off + y * cell, cell, cell); }

  // معاينة قبل الحفظ: لا شيء يُحفظ ولا يبدأ قبل الموافقة
  function preview(r, from) {
    if (!r.ok) { dialog('famImport', h('h3', 0, 'تعذّر الاستيراد'), h('p', { id: 'impErr' }, r.error), h('div', { className: 'row' }, h('button', { type: 'button', onclick: () => $('famImport').close() }, 'حسنًا'))); return false; }
    const p = r.pack, dup = list().find(x => sig(x) === sig(p));
    const ul = h('ul', { className: 'fprev' }, ...p.questions.slice(0, 3).map(q => h('li', 0, q.q, h('small', 0, q.choices.join(' · ')))));
    const keep = (andPlay) => { const s = save(p, { imported: true }); if (!s.ok) return toast(s.error); $('famImport').close(); toast('حُفظت «' + s.pack.name + '»'); if (window.CGHome) CGHome.refreshQuiz(); if (!page().hidden) renderList(); if (andPlay) play(s.pack); };
    dialog('famImport', h('h3', 0, 'فئة جديدة: ' + p.name), h('p', { className: 'sethint' }, p.questions.length + ' سؤالًا · من ' + from + ' · غير مُراجعة: تأكّدوا من الإجابات قبل اللعب مع الصغار'),
      ul, ...r.warn.map(w => h('p', { className: 'ferr' }, w)), dup ? h('p', { className: 'sethint', id: 'impDup' }, 'عندك نسخة من هذه الفئة بالفعل.') : null,
      h('div', { className: 'row' }, dup ? null : h('button', { className: 'pri', type: 'button', id: 'impSave', onclick: () => keep(false) }, 'احفظ'), dup ? null : h('button', { type: 'button', id: 'impPlay', onclick: () => keep(true) }, 'احفظ والعب'),
        h('button', { type: 'button', id: 'impCancel', onclick: () => $('famImport').close() }, 'إلغاء')));
    return true;
  }
  // رابط #quiz=… : يُفكّ ويُعرض للمعاينة فقط، ثم يُمسح من شريط العنوان
  async function fromHash() {
    const m = /^#quiz=(.+)$/.exec(location.hash); if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    let t; try { t = await decode(decodeURIComponent(m[1])); } catch (e) { return preview({ ok: false, error: 'الرابط تالف أو كبير جدًا' }, 'رابط'); }
    preview(clean(t), 'رابط');
  }
  addEventListener('hashchange', fromHash);
  setTimeout(fromHash, 0);
  return { clean, list, save, remove, get, index, official, mix, encode, decode, exportFile, open, edit, share, preview, fromHash, LIMITS: { MAXP, MAXQ, LQ, LC, LE, LN, MAXIN, LINKMAX, QRMAX } };
})();
