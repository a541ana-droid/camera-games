'use strict';
// حسّاسات الجهاز (المضيف فقط): كشف ما يملكه الجهاز بلا فتح أي جهاز ولا طلب إذن، ومستشعر الحركة (motion.device) مُعالَجًا ومحدود المعدّل.
// اللعبة لا ترى أحداث المتصفح الخام أبدًا؛ تصلها عيّنة {x,y,mag,shake} فقط. لا شيء يعمل في القائمة: المستمعون لا يُضافون إلا أثناء لعبة تعلن القدرة، ويُزالون عند الإيقاف.
window.Sensors = (() => {
  const qs = new URLSearchParams(location.search), DEBUG = qs.get('debug') === '1', FORCE = DEBUG ? qs.get('sensors') : null; // ?debug=1&sensors=1|0 يفرض وجود/غياب المستشعر (للاختبار فقط)
  const HZ = 30, SHAKE_MS2 = 15, SHAKE_GAP = 600, TILT_DEG = 45;
  const synth = { on: false, x: 0, y: 0, mag: 0, shake: false }; // مصدر اصطناعي (?debug=1): يضبطه الاختبار؛ shake=true تُرسَل مرة واحدة
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), fin = v => (typeof v === 'number' && isFinite(v) ? v : 0), r3 = v => Math.round(v * 1000) / 1000;
  const useSynth = () => DEBUG && (FORCE === '1' || synth.on);
  const hasMotion = () => FORCE === '0' ? false : FORCE === '1' ? true
    : typeof DeviceMotionEvent !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined' && (typeof DeviceMotionEvent.requestPermission === 'function' || navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches);
  // كشف الأجهزة: enumerateDevices لا يفتح شيئًا ولا يطلب إذنًا. قبل منح الإذن تُخفي المتصفحات نوعًا كاملًا من القائمة (Chrome/WebKit)،
  // فالقائمة لا تُعدّ دليلًا إلا إذا ظهرت أسماء الأجهزة (أي سبق الإذن). غير ذلك = غير معروف فيُعدّ موجودًا (لا نحجب لعبة بالظن).
  async function probe() {
    let cams = null, mics = null;
    try { if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) { const l = await navigator.mediaDevices.enumerateDevices(); if (l.some(d => d.label)) { cams = l.filter(d => d.kind === 'videoinput').length; mics = l.filter(d => d.kind === 'audioinput').length; } } } catch (e) { /* غير معروف */ }
    const canGum = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    return (Sensors.last = { motion: hasMotion(), camera: canGum && (cams === null || cams > 0), mic: canGum && (mics === null || mics > 0), cameras: cams, mics, known: cams !== null });
  }
  // الإذن (iOS 13+): requestPermission يجب أن تُستدعى مباشرةً داخل نقرة المستخدم؛ تُستدعى من بطاقة اللعبة قبل أي await.
  let perm = null;
  function permit() {
    if (perm) return perm;
    if (DEBUG && qs.get('permission') === 'denied') return (perm = Promise.resolve('denied'));
    if (useSynth()) return (perm = Promise.resolve('granted'));
    const ask = C => (typeof C !== 'undefined' && C && typeof C.requestPermission === 'function' ? C.requestPermission() : 'granted');
    try { perm = Promise.all([ask(window.DeviceMotionEvent), ask(window.DeviceOrientationEvent)]).then(r => (r.every(x => x === 'granted') ? 'granted' : 'denied'), () => 'denied'); } catch (e) { perm = Promise.resolve('denied'); }
    perm.then(v => { if (v !== 'granted') perm = null; }); // الرفض لا يُخزَّن: المحاولة التالية تسأل من جديد
    return perm;
  }
  // البدء/الإيقاف: عيّنات ≤30Hz. الميل من deviceorientation (متّسق بين المنصّات) ومقدار التسارع/الهزّ من devicemotion، مع تدوير المحاور بحسب اتجاه الشاشة.
  let cb = null, iv = 0, lastEmit = 0, lastShake = 0, tx = 0, ty = 0, mag = 0, shake = false;
  const emit = () => {
    const t = performance.now(); if (!cb || t - lastEmit < 1000 / HZ - 2) return; lastEmit = t;
    const d = { x: r3(tx), y: r3(ty), mag: r3(mag), shake }; shake = false; cb(d);
  };
  const tilt = (g, b) => { // g=gamma(يمين/يسار) b=beta(أمام/خلف) بالدرجات ⇒ x,y في -1..1 بحسب زاوية الشاشة
    const a = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) % 360, A = a < 0 ? a + 360 : a;
    const [x, y] = A === 90 ? [b, -g] : A === 270 ? [-b, g] : A === 180 ? [-g, -b] : [g, b];
    tx = clamp(fin(x) / TILT_DEG, -1, 1); ty = clamp(fin(y) / TILT_DEG, -1, 1);
  };
  const onOri = e => { tilt(fin(e.gamma), fin(e.beta)); emit(); };
  const onMot = e => {
    const a = e.acceleration, g = e.accelerationIncludingGravity;
    mag = a && a.x !== null ? Math.hypot(fin(a.x), fin(a.y), fin(a.z)) : g && g.x !== null ? Math.abs(Math.hypot(fin(g.x), fin(g.y), fin(g.z)) - 9.81) : 0;
    const t = performance.now(); if (mag > SHAKE_MS2 && t - lastShake > SHAKE_GAP) { lastShake = t; shake = true; }
    emit();
  };
  function stop() {
    if (!cb && !iv) return; cb = null; shake = false; if (iv) { clearInterval(iv); iv = 0; }
    window.removeEventListener('deviceorientation', onOri); window.removeEventListener('devicemotion', onMot);
  }
  function start(fn) {
    if (cb || iv) stop(); cb = fn; tx = ty = mag = 0; lastEmit = 0;
    if (useSynth()) { iv = setInterval(() => { tx = clamp(fin(synth.x), -1, 1); ty = clamp(fin(synth.y), -1, 1); mag = Math.max(0, fin(synth.mag)); if (synth.shake) { synth.shake = false; shake = true; } emit(); }, 1000 / HZ); return; }
    window.addEventListener('deviceorientation', onOri); window.addEventListener('devicemotion', onMot);
  }
  const Sensors = { last: null, probe, permit, start, stop, synth, active: () => !!(cb || iv), forced: () => FORCE };
  return Sensors;
})();
