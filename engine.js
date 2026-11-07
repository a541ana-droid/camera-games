'use strict';
// المضيف: يملك الكاميرا والصوت والحلقة والحارس والرسم. كود اللعبة يعمل في Web Worker قابل للإنهاء (terminate) ولا يعمل أي سطر منه في هذا الخيط. لا ثقة بشيء قادم منه.
(() => {
  const VERSION = '0.5.3', MAJOR = 0, BUDGET_MS = 8, HB_TIMEOUT = 2000, BOOT_TIMEOUT = 4000, ALIVE_TIMEOUT = 2500, MAX_GAME_BYTES = 200000;
  const KNOWN = ['camera.view', 'camera.color', 'camera.motion', 'camera.lowres', 'camera.calibrate', 'audio', 'haptic', 'hud', 'players.local', 'camera.lanes', 'camera.playercolors', 'audio.mic', 'motion.device', 'players.pads'];
  const PLANNED = ['qr', 'players.network', 'hand', 'pose'];
  const MAX_MSG_PER_S = 400, MAX_BYTES = new URLSearchParams(location.search).get('debug') === '1' ? 8192 : 2048, MAX_TRACKS = 4, MEM_LIMIT = 192e6;
  const memDetail = v => 'طلبت نحو ' + Math.round(n(v, 0, 1e12, 0) / 1e6) + ' ميغابايت.';
  const RATE = { 'mic.start': 5, 'audio.tone': 30, 'audio.melody': 10, haptic: 10, hud: 30, 'pads.say': 20, 'pads.vib': 20, 'pads.ctl': 10 };
  const $ = id => document.getElementById(id);
  const vq = u => u + (u.includes('?') ? '&' : '?') + 'v=' + VERSION.replace(/\./g, ''); // ملفات يجلبها المحرك بنفسه تحمل رقم نسخته (كما في index.html) فلا يخدمها مخزن HTTP من نسخة أخرى؛ عامل الخدمة يتجاهل الاستعلام
  const qs = new URLSearchParams(location.search), DEBUG = qs.get('debug') === '1', ENDMAX = DEBUG ? 4000 : 300; // نص نهاية اللعبة: 300 حرفًا (4000 في ?debug=1 كي تحمل الاختبارات نتائجها)
  const DEBUG_NOSW = new URLSearchParams(location.search).get('nosw') === '1';
  const stage = $('stage'), menu = $('menu'), cam = $('cam'), cvs = $('cv'), MODE = qs.get('mode') || 'auto'; // auto | iframe | host
  let fellBack = false; // تعذّر الإطلاق عبر iframe على هذا المتصفح: بقية الجلسة بالمضيف مباشرةً
  let S = null, seq = 0, facing = 'user', stream = null, actx = null, synth = null, runtimeSrc = null, calibDone = null;
  const E = window.__engine = { version: VERSION, events: [], debug: DEBUG };
  Draw.attach(cvs);
  const DIAG = qs.get('diag') === '1', PERF = qs.get('perf') === '1'; // ?diag=1 تشخيص عن بُعد إلى /__log (لا شبكة افتراضيًا)؛ ?perf=1 يُظهر عدّاد الحِمل
  const diag = (n, d) => { if (!DIAG) return; try { fetch('/__log', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ n, d: String(d === undefined ? '' : d).slice(0, 300), at: performance.now() | 0, ua: navigator.userAgent.slice(0, 120), sec: window.isSecureContext }) }).catch(() => {}); } catch (e) {} };
  addEventListener('error', e => diag('window.error', (e.message || '') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  addEventListener('unhandledrejection', e => diag('unhandledrejection', e.reason && (e.reason.name + ': ' + e.reason.message)));
  diag('page-load', 'build=' + VERSION + ' ' + location.search);
  const ev = (n, d) => { if (n !== 'hb') diag('ev:' + n, typeof d === 'object' ? JSON.stringify(d) : d); if (DEBUG) { E.events.push({ n, d, at: performance.now() | 0 }); if (E.on) E.on(n, d); } };

  const msgs = {
    'no-heartbeat': 'اللعبة علقت (إطار لم يكتمل خلال ثانيتين، ربما حلقة لا تنتهي) فأُنهي عاملها فورًا. الصفحة سليمة ولا حاجة لإعادة تحميلها.',
    boot: 'اللعبة لم تبدأ في الوقت المحدد (ربما حلقة لا تنتهي عند التحميل) فأُنهي عاملها فورًا.',
    launch: 'تعذّر تشغيل عامل اللعبة على هذا المتصفح.',
    budget: 'اللعبة تجاوزت ميزانية الإطار (8 مللي ث) مرارًا فأُغلقت.',
    'long-frame': 'إطار واحد في اللعبة استغرق أكثر من ثانيتين.',
    memory: 'اللعبة طلبت ذاكرة أكثر من الحد (192 ميغابايت) فأُغلقت قبل أن تُسقط الصفحة.',
    flood: 'اللعبة أغرقت المحرك برسائل كثيرة.',
    violations: 'اللعبة أرسلت رسائل غير صالحة أو تطلب قدرات لم تُعلنها.',
    navigated: 'اللعبة حاولت تغيير صفحتها.', stray: 'اللعبة حاولت مراسلة المضيف خارج القناة.', error: 'خطأ في كود اللعبة.'
  };

  function parseHeader(text) {
    const h = { title: '', desc: '', engine: '', caps: [], assets: '', series: '', accent: '', pads: '', howto: '', 'howto-act': '' };
    for (const line of text.split('\n', 40)) {
      const m = /^\/\/\s*@([\w-]+)\s*(.*)$/.exec(line.trim()); if (!m) continue;
      if (m[1] === 'capabilities') h.caps = m[2].split(/\s+/).filter(Boolean); else if (m[1] in h) h[m[1]] = m[2].trim();
    }
    return h;
  }
  function checkHeader(h) {
    if (h.engine && +h.engine.split('.')[0] !== MAJOR) return 'اللعبة مكتوبة للمحرك ' + h.engine + ' والمحرك الحالي ' + VERSION;
    const pl = h.caps.filter(c => PLANNED.includes(c) || c.startsWith('qr') || c.startsWith('hand') || c.startsWith('pose'));
    if (pl.length) return 'القدرات التالية غير متاحة بعد: ' + pl.join(' ');
    const un = h.caps.filter(c => !KNOWN.includes(c)); if (un.length) return 'قدرات غير معروفة: ' + un.join(' ') + ' — المعروف: ' + KNOWN.join(' ');
    return '';
  }

  // بصمة اللعبة (// @accent #rrggbb): غير صالحة أو قليلة التباين مع الخلفية الداكنة ⇒ لون المحرك الافتراضي (DESIGN.md §2). تُحسب منها درجتان للغلاف.
  const BRAND = '#7c6cff', hex2 = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), mix = (c, t, k) => '#' + hex2(c).map((v, i) => Math.round(v + (t[i] - v) * k).toString(16).padStart(2, '0')).join('');
  const arn = String; // أرقام 0-9 كبقية الواجهة
  function accentOf(h) {
    const a = h && /^#[0-9a-f]{6}$/i.test(h.accent || '') ? h.accent.toLowerCase() : BRAND, l = hex2(a).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }), L = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    const c = L < 0.12 ? BRAND : a; return { c, hi: mix(c, [255, 255, 255], 0.25), lo: mix(c, [0, 0, 0], 0.45) };
  }
  const CAPI = [['players.pads', '🎮', 'بالجوالات'], ['camera.', '📷', 'كاميرا'], ['audio.mic', '🎤', 'ميكروفون'], ['motion.device', '📱', 'حركة الجوال'], ['players.local', '👥', 'لاعبون'], ['camera.lanes', '👥', 'لاعبون']];
  // أيقونة الغلاف المولَّد (لعبة بلا غلاف): فعل اللعبة من @howto-act، لا وجوه ولا شخصيات
  const ACTICON = { wave: '👋', 'wave-lane': '🏁', freeze: '🧊', 'show-color': '🎨', tilt: '📲', 'hand-zone': '🎯', block: '🧤', dodge: '☄️', pop: '🫧', 'push-up': '🎈', simon: '👑', joystick: '🕹️', 'tap-beat': '🥁', react: '⚡', tap: '👆', voice: '🎤' };
  const capIcons = caps => { const out = []; for (const [k, i, n] of CAPI) if (caps.some(c => c.startsWith(k)) && !out.some(o => o[0] === i)) out.push([i, n]); return out; };

  // ---------- العرض ----------
  function show(which) { for (const v of ['menu', 'stage', 'ser', 'tv', 'pad']) { const el = $(v); if (el) el.hidden = which !== v; } if (which !== 'menu') closeSettings(); Upd.view(); }
  const SER = () => window.Series && Series.active(); // سلسلة ألعاب جارية؟ (المنطق كله في series.js)
  const PADS = () => window.Pads && Pads.playing(); // لعبة جوالات من ردهة التلفاز جارية؟ (tv.js)
  function overlay(text, opts = {}) {
    $('ovT').textContent = text; $('ov').className = opts.err ? 'err' : opts.end ? 'end' : ''; $('ov').hidden = false;
    $('ovI').textContent = opts.err ? '⚠️' : opts.end ? '🏁' : '⏳'; $('ovK').textContent = opts.title || (opts.err ? 'تعذّر المتابعة' : '');
    $('ovA').hidden = !opts.again; $('ovA').onclick = opts.again || null; $('ovB').onclick = () => { stopGame('exit'); if (window.Pads && Pads.active()) Pads.open(); else show('menu'); };
  }
  function hud(o) {
    for (const [k, id] of [['score', 'hScore'], ['title', 'hTitle'], ['time', 'hTime']]) {
      const el = $(id); if (!o) { el.hidden = true; el.textContent = ''; } else if (o[k] !== undefined) { el.textContent = o[k]; el.hidden = o[k] === ''; }
    }
  }

  // ---------- إعدادات الأسرة (0.5.2، ENGINE.md §3.5) ----------
  // يقرؤها المضيف وحده ويطبّقها بنفسه (الصوت، الاهتزاز، حساسية الكاميرا، الوميض، حجم النص). اللعبة لا تكسب قدرة: تصلها نسخة مجمّدة للقراءة فقط في api.prefs.
  const PREFS_KEY = 'engine-prefs', RSCALE = [0.6, 1, 1.5], SENS = [1.5, 1, 0.65], TEXTK = 1.2; // SENS: مضاعف عتبة الحركة (منخفضة ⇒ عتبة أعلى)
  const sysCalm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const pick3 = v => (v === 0 || v === 1 || v === 2) ? v : 1;
  function loadPrefs() {
    let o = null; try { o = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'); } catch (e) { /* */ } if (!o || typeof o !== 'object') o = {};
    return { sound: o.sound !== false, vol: typeof o.vol === 'number' && isFinite(o.vol) ? Math.min(1, Math.max(0, o.vol)) : 1, haptic: o.haptic !== false, round: pick3(o.round), diff: pick3(o.diff), sens: pick3(o.sens), calm: typeof o.calm === 'boolean' ? o.calm : null, big: o.big === true };
  }
  let PR = loadPrefs();
  const calmOn = () => PR.calm === null ? sysCalm() : PR.calm;
  const soundOn = () => PR.sound && PR.vol > 0;
  function applyPrefs() { const r = document.documentElement; r.classList.toggle('calm', calmOn()); r.classList.toggle('big', PR.big); if (typeof Analyzer !== 'undefined') Analyzer.setSensitivity(SENS[PR.sens]); }
  function setPref(k, v) { PR[k] = v; PR = Object.assign(loadPrefs(), PR); try { localStorage.setItem(PREFS_KEY, JSON.stringify(PR)); } catch (e) { /* */ } applyPrefs(); ev('prefs', JSON.stringify(PR)); }
  const gamePrefs = () => ({ roundScale: RSCALE[PR.round], difficulty: PR.diff, reducedMotion: calmOn(), textScale: PR.big ? TEXTK : 1 }); // ما يصل اللعبة (أرقام فقط)
  applyPrefs();

  // ---------- الصوت (WebAudio) ----------
  function audioCtx() { if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); } if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); return actx; }
  function tone(f, ms, vol, type, slide, at) {
    if (!soundOn() || !S) return; vol *= PR.vol; // الصوت مطفأ أو صفر ⇒ لا مذبذب ولا سياق صوت أصلًا
    const a = audioCtx(); if (!a) return; if (S.voices >= 8) return; S.voices++;
    const o = a.createOscillator(), g = a.createGain(), t = (at || a.currentTime), d = ms / 1000;
    o.type = ['sine', 'square', 'triangle', 'sawtooth'].includes(type) ? type : 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.min(8000, Math.max(40, f + slide)), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02);
    const s = S; o.onended = () => { if (s) s.voices = Math.max(0, s.voices - 1); };
  }

  // ---------- الكاميرا ----------
  // المرآة للكاميرا الأمامية الحقيقية فقط؛ المصدر الاصطناعي في التجارب ليس كاميرا فلا يُعكس
  let synthOn = false; const mirrored = () => facing === 'user' && !synthOn;
  // عرض صورة الكاميرا: تفضيل عام للمستخدم (افتراضيه تشغيل)، وطلب اللعبة showCamera(true) يُتجاهل حين يُطفأ. الصورة مخفية دائمًا ما لم تُعرض بالفعل.
  const PREF_KEY = 'engine-camview';
  const camPref = () => { try { return localStorage.getItem(PREF_KEY) !== '0'; } catch (e) { return true; } };
  const setCamPref = on => { try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch (e) { /* */ } };
  // «شرح قصير قبل كل لعبة» (0.5.1، ENGINE.md §3.3): تفضيل للمستخدم، افتراضيه تشغيل. اللعبة لا تراه؛ المحرك وحده يقرّر هل يمرّر @howto إلى الـWorker.
  const HOW_KEY = 'engine-howto';
  const howPref = () => { try { return localStorage.getItem(HOW_KEY) !== '0'; } catch (e) { return true; } };
  const setHowPref = on => { try { localStorage.setItem(HOW_KEY, on ? '1' : '0'); } catch (e) { /* */ } };
  let camShown = false;
  function showCam(on) { camShown = !!on && camPref(); cam.classList.toggle('off', !camShown); indicator(); }
  function indicator() {
    const i = $('camind'); if (!i) return;
    i.hidden = !stream; i.textContent = stream ? (camShown ? 'الكاميرا تعمل · الصورة تُعرض على شاشتك فقط' : 'الكاميرا تعمل · الصورة لا تُعرض ولا تغادر الجهاز') : '';
  }
  async function openCamera() {
    if (stream) return;
    synthOn = !!($('synth').checked && window.DebugSynth);
    if (synthOn) stream = DebugSynth.start();
    else {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error(window.isSecureContext ? 'المتصفح لا يدعم الكاميرا' : 'الكاميرا تحتاج رابط HTTPS (أو localhost)');
      diag('gum-request', facing);
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } }); } catch (e) { diag('gum-fail', e.name + ': ' + e.message); throw e; }
      diag('gum-ok', stream.getVideoTracks().map(t => t.label + ' ' + JSON.stringify(t.getSettings())).join('|'));
    }
    cam.srcObject = stream; cam.style.transform = mirrored() ? 'scaleX(-1)' : '';
    indicator(); // الصورة تبقى مخفية (off) أثناء الفتح؛ لا تُعرض إلا بطلب اللعبة بعد الإقلاع
    // لا ننتظر play() وحدها: سفاري قد يعلّقها؛ يكفي أن تصل أول صورة
    const ready = new Promise((res, rej) => {
      let t = 0; const ok = () => { clearInterval(t); res(); };
      t = setInterval(() => { if (cam.readyState >= 2 && cam.videoWidth > 0) ok(); }, 100);
      cam.addEventListener('playing', ok, { once: true });
      setTimeout(() => { clearInterval(t); cam.videoWidth > 0 ? res() : rej(new Error('الكاميرا لم ترسل صورة — أغلق التطبيقات التي تستعمل الكاميرا وأعد المحاولة')); }, 6000);
    });
    cam.play().catch(e => diag('cam-play-warn', e.name + ': ' + e.message));
    try { await ready; diag('cam-play-ok', cam.videoWidth + 'x' + cam.videoHeight); } catch (e) { diag('cam-play-fail', e.message); throw e; }
  }
  function closeCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; cam.srcObject = null; camShown = false; cam.classList.add('off'); cam.style.transform = ''; indicator();
    if (window.DebugSynth) DebugSynth.stop(); Analyzer.reset();
  }

  // ---------- حلقة المضيف: تحليل الكاميرا (30Hz) + نبضة الإطار إلى Worker ----------
  const wantAnalysis = () => S && !S.paused && (S.tracks.size || S.low || S.calib);
  const analyze = ts => {
    if (!wantAnalysis() || ts - S.lastA < 1000 / S.hz - 3) return; S.lastA = ts;
    const t0 = performance.now(), mirror = mirrored();
    if (!Analyzer.capture(cam, stage.clientWidth, stage.clientHeight, mirror)) return;
    const hold = S.inflight && t0 - S.tickAt > 500; // العامل مشغول: لا نكدّس رسائل (الطابور يبقى محدودًا)
    for (const [id, tr] of S.tracks) { const d = ANALYZE[tr.kind](tr.spec); tr.last = d; if (!hold) S.port.postMessage({ t: 'track', id, d }); }
    if (S.low && ts - S.lowAt >= 1000 / S.low) { S.lowAt = ts; if (!hold) S.port.postMessage({ t: 'lowres', d: Analyzer.lowres(cam, stage.clientWidth, stage.clientHeight, mirror) }); }
    S.analysisMs = performance.now() - t0; S.pm.an += S.analysisMs; S.pm.ac++;
  };
  // ---------- عدّاد الحِمل + خفض التحليل تلقائيًا ----------
  // المعالج على الخيط الرئيسي = تحليل الكاميرا + تنفيذ الرسم، ونسبته من الزمن هي «المشغول». السخونة لا تُقرأ في المتصفح،
  // لكن الجهاز الساخن يُبطئ المعالج فيصير التحليل نفسه أبطأ: إن تجاوز زمن التحليل الواحد ضعفَي أفضل زمن رأيناه، أو تجاوز المشغول 30%، نخفض المعدّل درجة.
  const HZ = [10, 15, 20, 30], PM_WIN = 2000;
  const pmNew = t => ({ t, raf: 0, gap: 0, last: 0, an: 0, ac: 0, dr: 0, wk: 0, fr: 0 });
  function perfTick(ts) {
    const p = S.pm; if (p.last && ts - p.last > 50) p.gap++; p.last = ts; p.raf++;
    const el = ts - p.t; if (el < PM_WIN) return;
    const busy = (p.an + p.dr) / el, per = p.ac ? p.an / p.ac : 0, A = S.perf;
    if (per && (!A.best || per < A.best)) A.best = per;
    const hot = p.ac >= 5 && (busy > 0.30 || per > 2 * Math.max(A.best, 0.5)), i = HZ.indexOf(S.hz);
    if (hot && i > 0) { S.hz = HZ[i - 1]; A.calm = 0; A.downs++; ev('hz', S.hz); }
    else if (!hot && busy < 0.12 && ++A.calm >= 5 && i < HZ.length - 1) { S.hz = HZ[i + 1]; A.calm = 0; ev('hz', S.hz); }
    const r = { fps: +(p.raf * 1000 / el).toFixed(1), busy: +(busy * 100).toFixed(1), an: +per.toFixed(2), dr: p.fr ? +(p.dr / p.fr).toFixed(2) : 0, wk: +(p.wk * 100 / el).toFixed(1), gap: p.gap, hz: S.hz };
    A.n++; A.busy += r.busy; A.fps += r.fps; A.wk += r.wk; A.maxBusy = Math.max(A.maxBusy, r.busy); A.hzT[S.hz] = (A.hzT[S.hz] || 0) + el;
    S.pm = pmNew(ts); E.lastPerf = r; ev('perf', r);
    if (PERF) $('perf').textContent = 'تحليل ' + r.hz + 'Hz · مشغول ' + r.busy + '% · لعبة ' + r.wk + '% · ' + r.fps + ' إطار/ث';
  }
  function perfSummary(s) {
    const A = s.perf; if (!A || !A.n) return null;
    const hz = {}; for (const k in A.hzT) hz[k] = Math.round(A.hzT[k] / 1000);
    return { sec: Math.round((performance.now() - s.tStart) / 1000), busy: +(A.busy / A.n).toFixed(1), maxBusy: A.maxBusy, wk: +(A.wk / A.n).toFixed(1), fps: +(A.fps / A.n).toFixed(1), best: +A.best.toFixed(2), downs: A.downs, hzSec: hz };
  }
  const ANALYZE = { color: s => Analyzer.color(s), motion: s => Analyzer.motion(s), lanes: s => Analyzer.lanes(s), players: s => Analyzer.players(s) };
  function loop(ts) {
    if (!S) return; S.raf = requestAnimationFrame(loop); if (S.paused) return;
    perfTick(ts); analyze(ts);
    if (S.ready && !S.inflight) {
      const w = stage.clientWidth, h = stage.clientHeight, m = { t: 'tick', ts };
      if (w !== S.sw || h !== S.sh) { S.sw = w; S.sh = h; Draw.resize(w, h, window.devicePixelRatio); m.w = w; m.h = h; }
      if (S.pq.length) { m.p = S.pq; S.pq = []; }
      if (S.pads) m.pi = Pads.inputs(); // مدخلات الأذرع: أرقام فقط، مقطوعة الحدود في tv.js (ENGINE.md §3.4)
      S.inflight = true; S.tickAt = performance.now(); S.port.postMessage(m);
    }
  }
  const ensureLoop = () => { if (S && !S.raf) S.raf = requestAnimationFrame(loop); };
  // إطار مرسوم من العامل: يتحقق منه المضيف كاملًا ثم ينفّذه على canvas
  function onFrame(m) {
    if (!S.inflight) return violate('frame-unsolicited');
    S.inflight = false; const now = performance.now(); S.lastHb = now;
    const d0 = performance.now(), r = Draw.run(m.b); S.pm.dr += performance.now() - d0; S.pm.fr++; if (!r.ok) violate('cmd'); S.frames++; S.cmdN = r.n; if (m.ov) ev('cmd-overflow');
    const ms = n(m.ms, 0, 1e7, 0), w = S.win; w.n++; w.sum += ms; if (ms > w.max) w.max = ms; if (ms > BUDGET_MS) w.over++; S.pm.wk += ms;
    if (now - w.t >= 500) {
      S.slow = w.n >= 10 && w.over / w.n > 0.5 ? S.slow + 1 : 0; ev('hb', { n: w.n, avg: w.sum / w.n, max: w.max, over: w.over, cmds: r.n }); S.win = { n: 0, sum: 0, max: 0, over: 0, t: now };
      if (S.slow >= 4) return stopGame('budget', true);
    }
    if (n(m.mem, 0, 1e12, 0) > MEM_LIMIT) return stopGame('memory', true, memDetail(m.mem));
  }

  // ---------- معايرة لون بنقرة ----------
  function pickColor() {
    return new Promise(res => {
      const c = $('calib'); c.hidden = false; S.calib = true; const was = camShown; cam.classList.remove('off'); // المعايرة تحتاج رؤية الصورة لحظة اللمس فقط
      const done = v => { cam.classList.toggle('off', !was); c.hidden = true; c.onpointerdown = null; calibDone = null; if (S) S.calib = false; res(v); };
      calibDone = () => done(null);
      c.onpointerdown = e => { const r = stage.getBoundingClientRect(); if (Analyzer.capture(cam, stage.clientWidth, stage.clientHeight, mirrored())) done(Analyzer.sample((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)); else done(null); };
    });
  }

  // ---------- استقبال رسائل اللعبة (لا ثقة بشيء) ----------
  const n = (v, a, b, d) => (typeof v === 'number' && isFinite(v)) ? Math.min(b, Math.max(a, v)) : d;
  const hasCap = c => S.caps.has(c);
  // نتيجة الفريقين (اختيارية): teamScores = [أ، ب] أرقام منتهية فقط
  const TEAMN = ['الفريق أ', 'الفريق ب'];
  function teamLine(t) { if (!Array.isArray(t) || t.length !== 2) return ''; const a = n(t[0], -1e9, 1e9, NaN), b = n(t[1], -1e9, 1e9, NaN); if (a !== a || b !== b) return ''; return TEAMN[0] + ' ' + arn(a) + ' — ' + TEAMN[1] + ' ' + arn(b) + '\n' + (a === b ? 'تعادل الفريقان' : 'فاز ' + TEAMN[a > b ? 0 : 1]); }
  function violate(why) { ev('violation', why); S.viol++; if (S.viol >= 10) return stopGame('violations', true); }
  function handle(m) {
    if (!S) return;
    const t0 = performance.now(); if (t0 - S.w0 >= 1000) { S.w0 = t0; S.cnt = 0; S.typeCnt = {}; }
    if (++S.cnt > MAX_MSG_PER_S) return stopGame('flood', true);
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return violate('shape');
    if (m.t === 'frame') { if (!S.ready || !Array.isArray(m.b)) return violate('frame-shape'); return onFrame(m); } // الإطار يُتحقق منه بنيويًا في Draw.run لا بـJSON
    let s; try { s = JSON.stringify(m); } catch (e) { return violate('json'); }
    if (s.length > MAX_BYTES) return violate('size');
    const lim = RATE[m.t]; if (lim) { S.typeCnt[m.t] = (S.typeCnt[m.t] || 0) + 1; if (S.typeCnt[m.t] > lim) return; }
    const cap = c => { if (!hasCap(c)) { violate('cap:' + c); return false; } return true; };
    switch (m.t) {
      case 'ready': S.ready = true; S.lastHb = performance.now(); ev('ready'); ensureLoop(); break;
      case 'track.start': {
        if (m.kind === 'devmotion') { // مستشعر حركة الجهاز: لا يمرّ بمحلّل الكاميرا؛ المضيف يملك المستمعين ويمرّر عيّنات معالجة فقط
          if (!/^k\d{1,6}$/.test(m.id || '')) return violate('track'); if (!cap('motion.device')) return;
          const s0 = S, id = m.id; s0.motion = id; Sensors.start(d => { if (S === s0 && s0.motion === id && !s0.paused) s0.port.postMessage({ t: 'track', id, d }); }); break;
        }
        const CAPK = { color: 'camera.color', motion: 'camera.motion', lanes: 'camera.lanes', players: 'camera.playercolors' }, NORM = { color: 'normColor', motion: 'normMotion', lanes: 'normLanes', players: 'normPlayers' };
        if (!/^k\d{1,6}$/.test(m.id || '') || !Object.prototype.hasOwnProperty.call(CAPK, m.kind)) return violate('track');
        if (!cap(CAPK[m.kind])) return;
        if (!S.tracks.has(m.id) && S.tracks.size >= MAX_TRACKS) return violate('too-many-tracks');
        const r = Analyzer[NORM[m.kind]](m.opts);
        if (r.error) { S.port.postMessage({ t: 'err2', msg: r.error }); return; }
        S.tracks.set(m.id, { kind: m.kind, spec: r.spec, last: null }); ensureLoop(); break;
      }
      case 'track.stop': S.tracks.delete(String(m.id)); if (S.motion === m.id) { S.motion = null; Sensors.stop(); } break;
      case 'lowres.start': if (!cap('camera.lowres')) return; S.low = n(m.hz, 1, 10, 5); S.lowAt = 0; ensureLoop(); break;
      case 'lowres.stop': S.low = 0; break;
      case 'calib': if (!cap('camera.calibrate')) return; if (S.calib || typeof m.id !== 'string') return violate('calib');
        { const s0 = S, id = m.id; pickColor().then(v => { if (S === s0) s0.port.postMessage({ t: 'ans', id, v }); }); } break;
      case 'mic.start': { if (!cap('audio.mic')) return; if (S.micT) clearInterval(S.micT); const s0 = S, hz = n(m.hz, 5, 30, 30), thr = n(m.thr, 0.05, 0.95, 0.5), wp = !!m.pitch; s0.micWant = 1;
        const go = s0.micGo = () => { if (S !== s0 || !s0.micWant || s0.micT) return; s0.micT = setInterval(() => { if (S !== s0 || !Mic.live()) return; s0.port.postMessage({ t: 'mic', d: Mic.sample(thr, wp) }); }, 1000 / hz); };
        Mic.open().then(ok => { if (S !== s0 || !s0.micWant) { if (!S) Mic.close(); return; } if (!ok) { s0.micWant = 0; ev('mic-denied'); s0.port.postMessage({ t: 'mic', d: { level: 0, loud: false, onset: false, pitch: 0, error: 'denied' } }); } else { ev('mic-open'); if (!document.hidden) go(); } }); break; }
      case 'mic.stop': S.micWant = 0; clearInterval(S.micT); S.micT = 0; Mic.close(); break;
      case 'view.camera': if (!cap('camera.view')) return; showCam(!!m.on); break;
      case 'audio.tone': if (!cap('audio')) return; tone(n(m.f, 40, 8000, 440), n(m.ms, 10, 2000, 150), n(m.vol, 0, 0.5, 0.3), m.type, n(m.slide, -4000, 4000, 0)); break;
      case 'audio.melody': { if (!cap('audio')) return; if (!Array.isArray(m.notes)) return violate('melody'); if (!soundOn()) break; const a = audioCtx(); let at = a ? a.currentTime : 0;
        for (const x of m.notes.slice(0, 16)) { const ms = n(x && x.ms, 10, 1000, 150); tone(n(x && x.f, 40, 8000, 440), ms, 0.25, 'triangle', 0, at); at += ms / 1000; } break; }
      case 'hud': if (!cap('hud')) return; hud({ score: m.score == null ? undefined : String(m.score).slice(0, 24), time: m.time == null ? undefined : String(m.time).slice(0, 12), title: m.title == null ? undefined : String(m.title).slice(0, 40) }); break;
      case 'haptic': if (!cap('haptic')) return; if (PR.haptic && navigator.vibrate) navigator.vibrate(n(m.ms, 1, 200, 30)); break;
      case 'pads.say': case 'pads.vib': case 'pads.ctl': { if (!cap('players.pads')) return; const i = n(m.i, -1, 7, -2); if (i === -2 || (i | 0) !== i) return violate('pad-index'); if (!window.Pads) return;
        if (m.t === 'pads.say') Pads.say(i, String(m.text == null ? '' : m.text).slice(0, 60)); else if (m.t === 'pads.vib') { if (PR.haptic) Pads.vibrate(i, n(m.ms, 1, 300, 40)); } else Pads.controls(i, { stick: m.stick !== false, a: String(m.a == null ? '' : m.a).slice(0, 12), b: String(m.b == null ? '' : m.b).slice(0, 12), tilt: !!m.tilt }); break; }
      case 'end': ev('end', { score: n(m.score, -1e9, 1e9, 0), text: String(m.text || '').slice(0, ENDMAX), scores: m.scores, ranks: m.ranks, teamScores: m.teamScores });
        { const sc = n(m.score, -1e9, 1e9, 0), tx = String(m.text || '').slice(0, 300), src = S.src, ttl = S.head && S.head.title || '', pads = S.pads && PADS(); stopGame('end', false);
          if (SER()) { Series.result(m); break; }
          if (pads) { Pads.ended(m); break; } // ردهة التلفاز تعرض النتيجة بألوان اللاعبين وأشكالهم وتبلغ كل جوال
          const ts = teamLine(m.teamScores); overlay((tx ? tx + '\n' : '') + (ts || 'النتيجة: ' + arn(sc)), { again: () => startGame(src), end: true, title: ttl }); } break;
      case 'err':
        // فشل تحميل كود اللعبة نفسه بسبب الشبكة/الأمان (لا خطأ في كود اللعبة) داخل iframe ⇒ جرّب Worker مباشرًا من المضيف مرة واحدة
        if (m.load && !S.ready && S.mode === 'iframe' && MODE === 'auto' && (m.name === 'NetworkError' || m.name === 'SecurityError')) return fallback('load:' + m.name);
        if (n(m.mem, 0, 1e12, 0) > MEM_LIMIT) return stopGame('memory', true, memDetail(m.mem));
        ev('game-error', String(m.msg).slice(0, 300)); stopGame('error', true, String(m.msg).slice(0, 300)); break;
      default: violate('unknown:' + m.t.slice(0, 20));
    }
  }

  // ---------- دورة الحياة ----------
  async function loadRuntime() { if (!runtimeSrc) { const r = await fetch(vq('runtime.js')); if (!r.ok) throw new Error('تعذّر تحميل runtime.js'); runtimeSrc = await r.text(); } return runtimeSrc; }
  async function getText(src) {
    if (typeof src !== 'string') return src.text;
    const r = await fetch(vq(src)); if (!r.ok) throw new Error('تعذّر تحميل ' + src); const t = await r.text(); return t;
  }
  // أصول الصور (// @assets اسم=مسار.png): من مجلدات اللعبة نفسها فقط، ≤8 ملفات و≤512KB لكل منها، تُفكّ في المضيف وتصل اللعبة مقبضًا {id,w,h}
  async function loadAssets(head, src) {
    Draw.setImages([]); const out = {}, imgs = [];
    if (typeof src !== 'string' || !head.assets) return out;
    for (const it of head.assets.split(/\s+/).filter(Boolean).slice(0, 8)) {
      const m = /^([\w-]{1,24})=((?!\/)[\w./-]+\.(?:png|jpe?g|gif|webp))$/i.exec(it); if (!m || m[2].includes('..')) throw new Error('أصل غير صالح في @assets: ' + it.slice(0, 60));
      const r = await fetch(m[2]); if (!r.ok) throw new Error('تعذّر تحميل الأصل ' + m[2]); const b = await r.blob(); if (b.size > 524288) throw new Error('الأصل ' + m[1] + ' أكبر من 512KB');
      const im = new Image(), u = URL.createObjectURL(b); im.src = u; try { await im.decode(); } finally { URL.revokeObjectURL(u); }
      out[m[1]] = { id: imgs.length, w: im.naturalWidth, h: im.naturalHeight }; imgs.push(im);
    }
    Draw.setImages(imgs); return out;
  }
  // الحاضن (launcher.js) مثبَّت بالتجزئة: نفس القيمة في CSP المضيف (index.html). tools/launcher-hash.mjs --write يحدّثها.
  const LAUNCHER_HASH = 'sha256-kWk1SupbNVOkZQkpxg0qyy1daQSU6A19cie5HQ2d1zY=';
  const launcherDoc = js => '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'' + LAUNCHER_HASH + '\' blob:; worker-src blob:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'"><script>' + js + '<\/script>';
  let launcherSrc = null;
  async function loadLauncher() { if (launcherSrc === null) launcherSrc = await (await fetch(vq('launcher.js'))).text(); return launcherSrc; }
  function launch(s, mode) {
    const ch = new MessageChannel(); if (s.port) try { s.port.onmessage = null; s.port.close(); } catch (e) { /* */ }
    s.port = ch.port1; s.mode = mode; s.alive = false; s.t0 = s.tLaunch = performance.now(); s.ready = false; s.inflight = false; s.loads = 0;
    s.port.onmessage = e => { if (S === s) handle(e.data); };
    const hello = { hello: 1, caps: Array.from(s.caps), budget: BUDGET_MS, w: s.sw, h: s.sh, assets: s.assetInfo };
    const wsrc = s.wsrc, gsrc = s.gsrc;
    if (s.onWin) window.removeEventListener('message', s.onWin);
    if (mode === 'iframe') {
      const f = document.createElement('iframe'); f.id = 'launcher'; f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('title', 'launcher'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
      f.srcdoc = DEBUG && qs.get('breaklauncher') === '1' ? '<!doctype html><p>launcher disabled for fallback test' : launcherDoc(launcherSrc); s.iframe = f; // breaklauncher: اختبار التراجع فقط
      f.addEventListener('load', () => {
        if (!S || S.iframe !== f) return; if (++S.loads > 1) return stopGame('navigated', true);
        f.contentWindow.postMessage({ hello, wsrc, gsrc }, '*', [ch.port2]);
      });
      s.onWin = e => { if (!S || !S.iframe || e.source !== S.iframe.contentWindow || !e.data || typeof e.data.launch !== 'string') return; onLaunch(e.data); };
      window.addEventListener('message', s.onWin); stage.insertBefore(f, $('hud'));
      s.kill = () => { try { f.contentWindow.postMessage({ kill: 1 }, '*'); } catch (e) { /* */ } f.srcdoc = ''; f.remove(); };
    } else {
      let wu, gu, w;
      try { wu = URL.createObjectURL(new Blob([wsrc], { type: 'text/javascript' })); gu = URL.createObjectURL(new Blob([gsrc], { type: 'text/javascript' })); w = new Worker(wu); } catch (e) { return stopGame('launch', true, String(e && e.message)); }
      s.worker = w; hello.game = gu;
      w.onmessage = e => { if (S !== s) return; if (e.data && e.data.alive) { s.alive = true; ev('alive', 'host'); } else if (++s.strays > 20) stopGame('stray', true); };
      w.onerror = e => { if (e.preventDefault) e.preventDefault(); if (S === s) onLaunch({ launch: 'error', msg: String(e.message || '').slice(0, 200) }); };
      w.postMessage(hello, [ch.port2]);
      s.kill = () => { try { w.terminate(); } catch (e) { /* */ } URL.revokeObjectURL(wu); URL.revokeObjectURL(gu); s.worker = null; };
    }
    ev('launch', mode);
  }
  // حالة الحاضن: alive = بدأ الـWorker فعلًا. فشل قبل alive في وضع iframe ⇒ التراجع إلى Worker مباشر من المضيف.
  function onLaunch(d) {
    if (!S) return;
    if (d.launch === 'alive') { S.alive = true; ev('alive', S.mode); return; }
    if (!S.alive && S.mode === 'iframe' && MODE === 'auto') return fallback(d.msg || d.launch);
    stopGame(S.alive ? 'error' : 'launch', true, d.msg);
  }
  function fallback(why) {
    ev('fallback', String(why).slice(0, 100)); fellBack = true; const s = S; s.kill(); if (s.iframe) { s.iframe = null; }
    launch(s, 'host');
  }
  // الفرق كما تراها اللعبة (api.teams): من ردهة التلفاز للجوالات، أو من الدوري للاعبين المحليين؛ وإلا لا فرق
  function teamSpec(head) {
    if (head.caps.includes('players.pads') && window.Pads && Pads.active()) { const md = Pads.mode(); return { mode: md, of: md === 'free' ? null : Pads.snapshot().map(p => [p.index, p.team]) }; }
    if (SER() && Series.teams()) return { mode: 'teams', of: Series.teams().map((t, i) => [i, t]) };
    return { mode: 'free', of: null };
  }
  async function startGame(src) {
    stopGame('replace'); hud(null); $('ov').hidden = true; show('stage');
    const id = ++seq; overlay('جارٍ التحميل…', {}); $('ovA').hidden = true;
    let text;
    try {
      text = await getText(src); if (text.length > MAX_GAME_BYTES) throw new Error('ملف اللعبة أكبر من ' + MAX_GAME_BYTES + ' بايت');
      // import() هو الطريق الوحيد الباقي لطلب شبكة (وضع host) أو لتنفيذ كود من نص (import(blob:)) ولا يمكن حذفه لأنه صيغة لغوية؛
      // والكلمة المحجوزة لا تُبنى من نص (eval ممنوع بـCSP)، فرفض الكلمة نفسها في الملف يغلق الطريقين في كل الأوضاع.
      if (/\bimport\b/.test(text)) throw new Error('ملف اللعبة يحتوي الكلمة import، وهي ممنوعة في الألعاب (لا استيراد ولا تحميل كود)');
      const head = parseHeader(text), bad = checkHeader(head); if (bad) throw new Error(bad);
      stage.style.setProperty('--ac', accentOf(head).c);
      if (head.caps.includes('motion.device')) { // الإذن يُطلب من نقرة البطاقة؛ هنا نتحقق فقط
        if (!Sensors.last) await Sensors.probe(); if (!Sensors.last.motion) throw new Error(NEED.motion);
        if (await Sensors.permit() !== 'granted') throw new Error('رُفض إذن مستشعرات الحركة. اسمح به من إعدادات المتصفح ثم أعد المحاولة.'); }
      S = { id, src, head, caps: new Set(head.caps), tracks: new Map(), voices: 0, w0: 0, cnt: 0, typeCnt: {}, viol: 0, slow: 0, ready: false, strays: 0, paused: false, lastA: 0, raf: 0, loads: 0, t0: performance.now(), lastHb: performance.now(),
        inflight: false, tickAt: 0, pq: [], sw: 0, sh: 0, frames: 0, cmdN: 0, win: { n: 0, sum: 0, max: 0, over: 0, t: performance.now() }, wdLast: performance.now(),
        hz: 30, pm: pmNew(performance.now()), tStart: performance.now(), perf: { n: 0, busy: 0, fps: 0, wk: 0, maxBusy: 0, best: 0, downs: 0, calm: 0, hzT: {} }, pads: head.caps.includes('players.pads') && !!window.Pads };
      if (head.caps.some(c => c.startsWith('camera.'))) { overlay('جارٍ فتح الكاميرا…', {}); $('ovA').hidden = true; await openCamera(); if (!S || S.id !== id) return closeCameraIfIdle(); }
      if (S.caps.has('audio') && soundOn()) audioCtx();
      const rt = await loadRuntime(); await loadLauncher(); if (!S || S.id !== id) return;
      S.assetInfo = await loadAssets(head, src); if (!S || S.id !== id) return;
      applyPrefs(); const spec = { prefs: gamePrefs(), accent: head.accent ? accentOf(head).c : '', howto: howPref() && head.howto ? { text: head.howto.slice(0, 60), act: String(head['howto-act'] || '').slice(0, 20) } : null, memmax: MEM_LIMIT, players: SER() ? Series.names() : null, teams: teamSpec(head), pads: head.caps.includes('players.pads') && window.Pads ? Pads.snapshot() : null, endmax: ENDMAX, nogate: DEBUG && qs.get('nogate') === '1', version: VERSION, maxe: Draw.MAXE, cmds: Draw.spec(), defaults: Draw.DEFAULTS, mt: Draw.measureTables() };
      S.wsrc = 'self.__SPEC=' + JSON.stringify(spec) + ';\n' + rt; S.gsrc = ';(function(){\n' + text + '\n})();';
      showCam(false); $('ov').hidden = true;
      S.sw = stage.clientWidth; S.sh = stage.clientHeight; Draw.resize(S.sw, S.sh, window.devicePixelRatio);
      S.wd = setInterval(() => {
        if (!S) return; const t = performance.now(), late = t - S.wdLast - 250; S.wdLast = t;
        if (S.paused) { S.tickAt = t; return; }
        if (late > 400) { S.t0 += late; S.tickAt += late; S.tLaunch += late; } // المضيف نفسه تأخر (لا اللعبة): لا نحاسبها على ذلك
        if (!S.ready) {
          if (S.mode === 'iframe' && !S.alive && MODE === 'auto' && t - S.tLaunch > ALIVE_TIMEOUT) fallback('alive-timeout');
          else if (t - S.t0 > BOOT_TIMEOUT) stopGame('boot', true);
        } else if (S.inflight && t - S.tickAt > HB_TIMEOUT) stopGame('no-heartbeat', true);
      }, 250);
      runMark(head.title || (typeof src === 'string' ? src : 'ملف من الجهاز'));
      launch(S, MODE === 'host' || (MODE === 'auto' && fellBack) ? 'host' : 'iframe'); ev('start', head.title);
    } catch (e) { if (S && S.id === id) stopGame('load', false); else closeCameraIfIdle(); if (SER()) Series.stopped('تعذّر تشغيل اللعبة: ' + (e.message || e.name)); else overlay('تعذّر تشغيل اللعبة\n' + (e.message || e.name), { err: true }); ev('load-error', String(e.message)); }
  }
  const closeCameraIfIdle = () => { if (!S) closeCamera(); };
  function stopGame(reason, showErr, detail) {
    ev('stop', reason);
    if (!S) { if (reason === 'exit') { closeCamera(); } Mic.close(); Sensors.stop(); return; }
    const s = S; S = null; seq++; runMark(null); Sensors.stop();
    const sum = perfSummary(s); if (sum) { E.lastSummary = sum; ev('perf-sum', sum); }
    if (PERF) $('perf').textContent = '';
    clearInterval(s.wd); if (s.raf) cancelAnimationFrame(s.raf); window.removeEventListener('message', s.onWin);
    if (s.kill) s.kill(); // terminate() فوري: يعمل حتى لو كان الـWorker في حلقة لا تنتهي
    try { s.port.onmessage = null; s.port.close(); } catch (e) { /* */ }
    if (calibDone) calibDone(); $('calib').hidden = true;
    clearInterval(s.micT); s.micWant = 0; Mic.close(); closeCamera(); hud(null); Draw.setImages([]);
    if (actx) { actx.close().catch(() => {}); actx = null; }
    const why = (msgs[reason] || 'أُغلقت اللعبة') + (detail ? '\n' + detail : '');
    if (showErr) { if (SER()) Series.stopped(why); else if (s.pads && window.Pads && Pads.playing()) Pads.stopped(why); else overlay(why, { err: true, again: () => startGame(s.src) }); }
  }
  document.addEventListener('visibilitychange', () => {
    if (S && S.micWant) { if (document.hidden) { clearInterval(S.micT); S.micT = 0; Mic.close(); } else if (!S.micT) { const s0 = S; Mic.open().then(ok => { if (ok && S === s0) s0.micGo(); else if (!S) Mic.close(); }); } } else if (document.hidden) Mic.close();
    if (!S || !S.ready) return; S.paused = document.hidden; if (!document.hidden) { S.lastHb = S.tickAt = S.wdLast = performance.now(); S.win.t = performance.now(); S.pm = pmNew(performance.now()); }
  });
  // المؤشر: يُجمَّع في المضيف ويُرسل مع النبضة التالية (≤48 حدثًا). القيم 0..1 نسبة إلى المرئي.
  const ptr = (k, e) => { if (!S || !S.ready || S.pq.length >= 48) return; const r = cvs.getBoundingClientRect(); if (k !== 1 || e.buttons) S.pq.push(k, +((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)); };
  cvs.addEventListener('pointerdown', e => { e.preventDefault(); ptr(0, e); }); cvs.addEventListener('pointermove', e => ptr(1, e)); cvs.addEventListener('pointerup', e => ptr(2, e)); cvs.addEventListener('pointercancel', e => ptr(2, e));
  addEventListener('pagehide', () => stopGame('exit'));
  $('exit').onclick = () => { const pads = PADS(); stopGame('exit'); if (SER()) Series.stopped('خرجتَ من اللعبة قبل نهايتها.'); else if (pads) Pads.stopped('exit'); else show('menu'); };

  // ---------- شبكة أمان أخيرة: لعبة أسقطت الصفحة كلها (نفاد ذاكرة لم يلتقطه العدّاد) ----------
  // علامة في sessionStorage أثناء اللعب تُمسح عند كل إغلاق نظامي (وعند pagehide). إن وُجدت عند التحميل فقد سقطت الصفحة أثناء اللعبة.
  const RUN_KEY = 'engine-running';
  const runMark = t => { try { if (t) sessionStorage.setItem(RUN_KEY, JSON.stringify({ t: String(t).slice(0, 80), at: Date.now() })); else sessionStorage.removeItem(RUN_KEY); } catch (e) { /* */ } };
  const crashed = (() => { try { const v = JSON.parse(sessionStorage.getItem(RUN_KEY) || 'null'); sessionStorage.removeItem(RUN_KEY); return v; } catch (e) { return null; } })();
  // ---------- القائمة ----------
  const NEED = { motion: 'يحتاج مستشعر حركة — غير موجود في هذا الجهاز', camera: 'يحتاج كاميرا — غير موجودة في هذا الجهاز' }, cards = [];
  const reasonFor = h => { const p = Sensors.last; if (!p) return ''; if (h.caps.includes('motion.device') && !p.motion) return NEED.motion; if (h.caps.some(c => c.startsWith('camera.')) && !p.camera && !($('synth').checked && window.DebugSynth)) return NEED.camera; return ''; };
  function applyAvail() { for (const c of cards) { const r = reasonFor(c.h); c.b.disabled = !!r; c.n.textContent = r; c.n.hidden = !r; } E.devices = Sensors.last; }
  async function buildMenu() {
    $('ver').textContent = 'المحرك ' + VERSION; $('facing').onchange = e => { facing = e.target.value; };
    if (DEBUG) $('synthL').hidden = false;
    $('camview').checked = camPref(); $('camview').onchange = e => { setCamPref(e.target.checked); if (!e.target.checked) showCam(false); };
    $('howto').checked = howPref(); $('howto').onchange = e => setHowPref(e.target.checked);
    settingsUi();
    const list = $('list'); list.textContent = '';
    if (crashed) { const w = document.createElement('p'); w.className = 'warn'; w.textContent = 'أُعيد تحميل الصفحة أثناء لعبة «' + crashed.t + '» — غالبًا استهلكت ذاكرة الجهاز. لم تُشغَّل تلقائيًا؛ اخترها من جديد إن أردت.'; list.before(w); diag('crash-recovered', crashed.t); }
    try {
      const names = (await (await fetch(vq('games/index.txt'))).text()).split('\n').map(s => s.trim()).filter(s => /^[\w.-]+\.js$/.test(s) && (DEBUG || !s.startsWith('zz-'))); // zz-* ألعاب اختبار للمطوّر: تظهر في ?debug=1 فقط
      // تُجلب رؤوس الألعاب معًا لا واحدة بعد الأخرى (على شبكة بطيئة كانت 6 ألعاب × ~3ث قبل ظهور القائمة)؛ لعبة تعذّر جلبها تُتخطّى ولا تُسقط القائمة كلها
      const texts = await Promise.all(names.map(nm => fetch(vq('games/' + nm)).then(r => r.ok ? r.text() : null, () => null)));
      for (let gi = 0; gi < names.length; gi++) {
        const nm = names[gi]; if (texts[gi] == null) continue;
        const h = parseHeader(texts[gi]), b = document.createElement('button'), ac = accentOf(h), mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
        b.className = 'card'; b.style.setProperty('--ac', ac.c); b.style.setProperty('--ac-hi', ac.hi); b.style.setProperty('--ac-lo', ac.lo);
        const cover = mk('span', 'cover'), ic = capIcons(h.caps), art = mk('span', 'art', ACTICON[h['howto-act']] || (ic.length ? ic[0][0] : '🎮')); art.setAttribute('aria-hidden', 'true');
        const img = new Image(); img.alt = ''; img.decoding = 'async'; img.className = 'pic'; img.onload = () => cover.classList.add('has'); img.onerror = () => img.remove(); img.src = 'games/' + nm.replace(/\.js$/, '') + '.cover.jpg'; cover.append(art, img);
        const body = mk('span', 'body'), t = mk('b', '', h.title || nm), d = mk('small', '', h.desc), caps = mk('span', 'caps'), nt = mk('em'); nt.hidden = true;
        for (const [i, n] of ic) { const c = mk('span', 'cap', i); c.title = n; c.setAttribute('role', 'img'); c.setAttribute('aria-label', n); caps.append(c); }
        if (h.caps.includes('players.pads')) caps.append(mk('span', 'badge', '📱 كل لاعب بجواله')); body.append(t, d, caps); if (h.caps.includes('camera.view')) caps.append(mk('span', 'badge', '📷 تعرض صورتك على شاشتك')); body.append(nt); b.append(cover, body); cards.push({ b, h, n: nt });
        b.onclick = () => { if (h.caps.includes('players.pads') && window.Pads) return Pads.open('games/' + nm); if (h.caps.includes('motion.device')) Sensors.permit(); startGame('games/' + nm); }; list.append(b);
      }
    } catch (e) { list.textContent = 'تعذّر تحميل قائمة الألعاب'; }
    await Sensors.probe(); applyAvail(); $('synth').addEventListener('change', applyAvail);
    $('pick').onclick = () => $('file').click();
    $('setBtn').onclick = () => openSettings();
    $('playBtn').onclick = () => { const c = cards.find(x => !x.b.disabled); list.scrollIntoView({ block: 'start' }); if (c) c.b.focus({ preventScroll: true }); };
    $('file').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) { $('code').value = await f.text(); $('mkRun').click(); } };
    maker();
  }
  // ---------- ورقة الإعدادات (0.5.2) ----------
  let setReturn = null;
  function openSettings() { const st = $('settings'); if (!st.hidden) return; st.hidden = false; $('setBtn').setAttribute('aria-expanded', 'true'); setReturn = document.activeElement; st.scrollTop = 0; $('setClose').focus({ preventScroll: true }); }
  function closeSettings() { const st = $('settings'); if (!st || st.hidden) return; st.hidden = true; $('setBtn').setAttribute('aria-expanded', 'false'); if (setReturn && setReturn.focus) setReturn.focus({ preventScroll: true }); setReturn = null; }
  function settingsUi() {
    const st = $('settings'), vol = $('pVol'), volV = $('pVolV');
    const paint = () => {
      $('pSound').checked = PR.sound; vol.value = Math.round(PR.vol * 100); vol.disabled = !PR.sound; volV.textContent = Math.round(PR.vol * 100) + '%';
      $('pHaptic').checked = PR.haptic; $('pCalm').checked = calmOn(); $('pBig').checked = PR.big;
      for (const g of st.querySelectorAll('.seg')) for (const b of g.querySelectorAll('button')) { const on = +b.dataset.v === PR[g.dataset.p]; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }
    };
    $('pSound').onchange = e => { setPref('sound', e.target.checked); if (e.target.checked && PR.vol === 0) setPref('vol', 0.5); paint(); };
    vol.oninput = () => { volV.textContent = vol.value + '%'; }; vol.onchange = () => { setPref('vol', Math.min(1, Math.max(0, +vol.value / 100))); paint(); };
    $('pHaptic').onchange = e => { setPref('haptic', e.target.checked); if (e.target.checked && navigator.vibrate) try { navigator.vibrate(40); } catch (x) { /* */ } };
    $('pCalm').onchange = e => setPref('calm', e.target.checked); $('pBig').onchange = e => setPref('big', e.target.checked);
    for (const g of st.querySelectorAll('.seg')) {
      g.onclick = e => { const b = e.target.closest('button'); if (!b) return; setPref(g.dataset.p, pick3(+b.dataset.v)); paint(); };
      g.onkeydown = e => { const k = { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -1, ArrowDown: 1 }[e.key]; if (!k) return; e.preventDefault(); const v = Math.min(2, Math.max(0, PR[g.dataset.p] + k)); setPref(g.dataset.p, v); paint(); g.querySelector('[data-v="' + v + '"]').focus(); }; // اتجاه العربية: السهم الأيسر = التالي
    }
    $('aboutVer').textContent = VERSION; $('setClose').onclick = closeSettings;
    st.onclick = e => { if (e.target === st) closeSettings(); };
    st.onkeydown = e => { if (e.key === 'Escape') closeSettings(); };
    $('pWipe').onclick = () => {
      if (!confirm('تمسح «ألعابي» وإعداداتك وكل ما حفظه التطبيق على هذا الجهاز؟\nلا يمكن التراجع عن هذا.')) return;
      wipeMine(); location.reload();
    };
    paint();
  }
  // «مسح بياناتي»: كل ما حفظه التطبيق في هذا المتصفح (ألعابي، الإعدادات، ملف الجوال ذراعًا، وأي سجلّ). يبقى فقط يوم عدّاد الزوّار كي لا يُعدّ الجهاز مرتين في اليوم نفسه.
  function wipeMine() {
    let day = null; try { day = localStorage.getItem('visitDay'); localStorage.clear(); if (day) localStorage.setItem('visitDay', day); } catch (e) { /* */ }
    try { sessionStorage.clear(); } catch (e) { /* */ } PR = loadPrefs(); ev('wiped');
  }
  E.prefs = () => Object.assign({ effective: gamePrefs() }, PR); E.openSettings = () => openSettings(); E.wipeMine = wipeMine;

  // ---------- إشعار النسخة الجديدة (0.5.2) ----------
  // sw.js لا يتولّى الصفحات المفتوحة بنفسه: النسخة الجديدة تنتظر (waiting) والنسخة القديمة تخدم ملفاتها كاملة فلا تختلط ملفات نسختين.
  // نعرض شريطًا في القائمة فقط؛ الضغط يطلب من العامل الجديد التولّي ثم نعيد التحميل. لا إعادة تحميل تلقائية أبدًا: لا أثناء لعبة ولا في ردهة التلفاز ولا في الجوال ذراعًا.
  const Upd = (() => {
    let reg = null, wait = null, asked = false, hidden = false, stale = false, lastCheck = 0;
    const idle = () => !$('menu').hidden && !S && !SER() && !(window.Pads && Pads.active());
    const view = () => { if (stale && !asked && idle()) { asked = true; return location.reload(); } const b = $('upd'); if (!b) return; const on = !!wait && !hidden && idle(); b.hidden = !on; if (!$('menu').hidden && reg && performance.now() - lastCheck > 3e5) { lastCheck = performance.now(); reg.update().catch(() => {}); } };
    const offer = w => { if (!w || !navigator.serviceWorker.controller) return; wait = w; ev('update-ready'); view(); };
    function watch(r) {
      reg = r; lastCheck = performance.now(); if (r.waiting) offer(r.waiting);
      r.addEventListener('updatefound', () => { const w = r.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
      let had = !!navigator.serviceWorker.controller; // أول تولٍّ في أول زيارة (clients.claim) ليس تحديثًا: لا شريط
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (asked) return location.reload(); if (!had) { had = true; return; } stale = true; wait = wait || {}; view(); }); // 0.5.3: نسخة جديدة تولّت ⇒ إعادة تحميل تلقائية حالًا إن كنا في القائمة، وإلا عند العودة إليها (لا أثناء لعبة ولا ردهة)
    }
    function go() { if (!wait || !idle()) return; asked = true; $('upd').hidden = true; if (stale || !wait.postMessage) return location.reload(); wait.postMessage({ t: 'skip' }); setTimeout(() => { if (asked) location.reload(); }, 4000); } // احتياط: إن لم يصل controllerchange
    return { watch, view, go, later() { hidden = true; view(); }, state: () => ({ waiting: !!wait, shown: !$('upd').hidden, asked }) };
  })();
  $('updGo').onclick = () => Upd.go(); $('updNo').onclick = () => Upd.later(); E.update = Upd;

  // «ألعابي» + صانع الألعاب: أي نموذج ذكاء اصطناعي، بلا مفتاح ولا خادم — ننسخ له الطلب كاملًا (القواعد + العقد) ويلصق المستخدم ردّه هنا.
  // الكود يعمل في الصندوق المعزول نفسه الذي تعمل فيه ألعاب القائمة، ويُحفظ في هذا المتصفح فقط.
  const MINE = 'myGames';
  const mineGet = () => { try { const a = JSON.parse(localStorage.getItem(MINE) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const mineSet = a => { try { localStorage.setItem(MINE, JSON.stringify(a)); return true; } catch (e) { return false; } };
  function renderMine() {
    const box = $('mine'), a = mineGet(); box.textContent = ''; $('myH').hidden = !a.length;
    for (const g of a) {
      const h = parseHeader(g.text), ac = accentOf(h), b = document.createElement('div'), go = document.createElement('button'), del = document.createElement('button');
      b.className = 'card'; b.style.setProperty('--ac', ac.c); b.style.borderInlineStart = '6px solid ' + ac.c;
      go.className = 'card'; go.style.margin = '0'; go.style.border = '0'; const t = document.createElement('b'), d = document.createElement('small');
      t.textContent = h.title || 'لعبة بلا اسم'; d.textContent = h.desc || ''; d.style.display = 'block'; d.style.color = 'var(--mut)'; go.append(t, d);
      go.onclick = () => { if (h.caps.includes('motion.device')) Sensors.permit(); startGame({ text: g.text }); };
      del.className = 'del'; del.textContent = '✕'; del.setAttribute('aria-label', 'احذف ' + (h.title || 'اللعبة'));
      del.onclick = () => { if (confirm('تحذف «' + (h.title || 'اللعبة') + '» من ألعابي؟')) { mineSet(mineGet().filter(x => x.id !== g.id)); renderMine(); } };
      b.append(go, del); box.append(b);
    }
  }
  const extractCode = t => { const m = [...t.matchAll(/```[a-zA-Z]*\s*\n([\s\S]*?)```/g)].map(x => x[1]); return (m.length ? m.sort((a, b) => b.length - a.length)[0] : t).trim(); };
  async function buildPrompt(idea) {
    const [p, eng, des] = await Promise.all(['PROMPT-FOR-MODELS.md', 'ENGINE.md', 'DESIGN.md'].map(f => fetch(f).then(r => { if (!r.ok) throw 0; return r.text(); })));
    const parts = p.split(/\n---\n/), rules = (parts[1] || p).replace('(ثم الصق ENGINE.md)', '').replace(/فكرة اللعبة: ‹اكتب هنا›/, 'فكرة اللعبة: ' + idea).trim();
    return rules + '\n\nملاحظة: سيلصق المستخدم ردّك كما هو في تطبيق «ألعاب الكاميرا» ليعمل فورًا، فاكتب الملف كاملًا في كتلة كود واحدة. إن أرسل لك رسالة خطأ من التطبيق فأعد الملف كاملًا مصحّحًا.\n\n===== ENGINE.md =====\n' + eng + '\n\n===== DESIGN.md =====\n' + des;
  }
  function maker() {
    renderMine(); const msg = $('mkMsg');
    $('mkCopy').onclick = async () => {
      const idea = $('idea').value.trim(); if (!idea) { msg.textContent = 'اكتب فكرتك أولًا في الخانة 1.'; $('idea').focus(); return; }
      msg.textContent = 'جارٍ التجهيز…';
      try { const pt = buildPrompt(idea); let t; // سفاري يشترط بدء النسخ داخل اللمسة نفسها: ClipboardItem بوعد يحلّ ذلك
        if (window.ClipboardItem && navigator.clipboard.write) { await navigator.clipboard.write([new ClipboardItem({ 'text/plain': pt.then(x => new Blob([x], { type: 'text/plain' })) })]); t = await pt; } else { t = await pt; await navigator.clipboard.writeText(t); }
        msg.textContent = '✓ نُسخ الطلب (' + Math.round(t.length / 1000) + ' ألف حرف). افتح النموذج والصق فيه، ثم انسخ ردّه كاملًا.'; }
      catch (e) { // النسخ الآلي ممنوع في بعض المتصفحات: نعرض الطلب محدَّدًا لينسخه المستخدم بيده
        let t = null; try { t = await buildPrompt(idea); } catch (e2) { /* */ }
        if (!t) { msg.textContent = 'تعذّر تجهيز الطلب (يحتاج إنترنت أول مرة). جرّب مرة أخرى.'; return; }
        const o = $('mkOut'); o.hidden = false; o.value = t; o.focus(); o.select(); msg.textContent = 'لم يسمح المتصفح بالنسخ الآلي: النص محدَّد في الخانة أدناه، انسخه (نسخ) ثم الصقه في النموذج.'; }
    };
    $('mkRun').onclick = () => {
      const text = extractCode($('code').value); if (!text) { $('code').focus(); return; }
      const h = parseHeader(text), bad = checkHeader(h); if (bad) { msg.textContent = ''; alert('الردّ لا يبدو ملف لعبة صحيحًا:\n' + bad + '\n\nانسخ ردّ النموذج كاملًا، أو أرسل له هذه الرسالة ليصلحه.'); return; }
      const a = mineGet().filter(x => parseHeader(x.text).title !== h.title); a.unshift({ id: Date.now().toString(36), text }); while (a.length > 30) a.pop();
      if (!mineSet(a)) alert('ذاكرة المتصفح ممتلئة؛ احذف لعبة من «ألعابي».'); $('code').value = ''; renderMine(); startGame({ text });
    };
  }
  if (window.Pads !== undefined) { /* tv.js يُحمَّل بعد المحرك */ }
  const padsChanged = () => { if (S && S.ready && S.pads) S.port.postMessage({ t: 'pads', list: Pads.snapshot() }); };
  E.padsChanged = padsChanged; E.ev = ev;
  E.mode = () => S && S.mode; E.fellBack = () => fellBack; E.startGame = startGame; E.show = show; E.stopGame = stopGame; E.state = () => S; E.parseHeader = parseHeader; E.accentOf = accentOf; E.audio = () => actx; E.cameraOpen = () => !!stream; E.camShown = () => camShown && !cam.classList.contains('off'); E.setFacing = f => { facing = f; }; E.sensors = Sensors;
  // تثبيت التطبيق: أندرويد/كروم يعطي حدث beforeinstallprompt فنثبّت بضغطة؛ آيفون لا يسمح بذلك فنشرح الخطوتين. يختفي داخل التطبيق المثبّت وبعد «لاحقًا».
  (() => {
    const box = $('inst'), msg = $('instMsg'), go = $('instGo'); let ev = null;
    const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
    const later = () => { try { return +localStorage.getItem('instLater') > Date.now(); } catch (e) { return false; } };
    if (standalone || later() || !window.isSecureContext) return;
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) { msg.textContent = 'اضغط زرّ المشاركة ⎙ أسفل سفاري، ثم «إضافة إلى الشاشة الرئيسية». تعمل بعدها بلا إنترنت.'; go.hidden = true; box.hidden = false; }
    addEventListener('beforeinstallprompt', e => { if (ios) return; e.preventDefault(); ev = e; go.hidden = false; box.hidden = false; });
    addEventListener('appinstalled', () => { box.hidden = true; });
    go.onclick = async () => { if (!ev) return; ev.prompt(); const r = await ev.userChoice.catch(() => null); ev = null; if (r && r.outcome === 'accepted') box.hidden = true; };
    $('instNo').onclick = () => { box.hidden = true; try { localStorage.setItem('instLater', Date.now() + 7 * 864e5); } catch (e) { /* */ } };
  })();
  // عدّاد الزوّار: خدمة مجانية بلا حساب ولا كوكيز (abacus)؛ كل جهاز يُحسب مرة في اليوم، ولا يُرسل شيء غير «زيارة». لا يعمل في الاختبار المحلي.
  (() => {
    const out = $('stats'), B = 'https://abacus.jasoncameron.dev/', K = 'a541ana-camera-games/visits';
    if (!out || DEBUG || !/github\.io$/.test(location.hostname)) return;
    let day = ''; try { day = localStorage.getItem('visitDay') || ''; } catch (e) { /* */ }
    const today = new Date().toISOString().slice(0, 10), op = day === today ? 'get/' : 'hit/';
    fetch(B + op + K, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }).then(r => r.json()).then(j => {
      if (typeof j.value === 'number') { out.textContent = j.value.toLocaleString('en-US'); if (op === 'hit/') try { localStorage.setItem('visitDay', today); } catch (e) { /* */ } }
    }).catch(() => {});
  })();
  if ('serviceWorker' in navigator && window.isSecureContext && !DEBUG_NOSW) navigator.serviceWorker.register('sw.js').then(r => Upd.watch(r)).catch(() => {});
  // الجوال كذراع (#pad=رمز): pad.js يتولّى الصفحة ولا تُبنى القائمة (أخفّ على الجوال)؛ تُبنى إن عاد إليها
  let built = false; const buildOnce = E.buildMenuOnce = () => { if (!built) { built = true; buildMenu(); } };
  if (/^#pad/.test(location.hash)) show('pad'); else { show('menu'); buildOnce(); }
  const g = qs.get('game');
  if (g && /^[\w./-]+\.js$/.test(g) && !g.includes('..')) { if (DEBUG) { $('synth').checked = qs.get('synth') === '1'; const s = document.createElement('script'); s.src = 'debug.js'; s.onload = () => { if (qs.get('auto') === '1') startGame(g); }; document.head.append(s); } }
  else if (DEBUG) { const s = document.createElement('script'); s.src = 'debug.js'; document.head.append(s); }
})();
