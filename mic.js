'use strict';
// الميكروفون (المضيف فقط): getUserMedia + AnalyserNode. لا تسجيل، لا مخزن صوت يُحفظ، لا بايت صوت يصل اللعبة؛ تصلها أرقام (مستوى/ذروة/نغمة).
// سياق صوت مستقل عن سياق الإخراج في engine.js كي لا يتأثر أحدهما بإغلاق الآخر.
window.Mic = (() => {
  let gen = 0, sOpen = false, stream = null, ctx = null, an = null, buf = null, opening = null, synth = null, lvl = 0, avg = 0.01, prev = 0, lastOn = 0, fired = 0;
  const ind = () => document.getElementById('micInd');
  const show = on => { const e = ind(); if (e) e.hidden = !on; };
  const live = () => !!((synth && sOpen) || (stream && stream.getTracks().some(t => t.readyState === 'live')));
  async function open() {
    if (live()) return true; if (opening) return opening;
    return (opening = (async () => {
      const g0 = gen; let st = null;
      try {
        if (synth) { sOpen = true; show(true); return true; }
        const C = window.AudioContext || window.webkitAudioContext;
        st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
        if (g0 !== gen) { st.getTracks().forEach(t => t.stop()); return false; } // أُغلق الميكروفون أثناء انتظار الإذن
        stream = st; ctx = new C(); if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
        an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; buf = new Float32Array(1024); // يُحلَّل فقط، ولا يُوصَل بـdestination (لا صدى)
        ctx.createMediaStreamSource(stream).connect(an); lvl = 0; avg = 0.01; prev = 0; show(true); return true;
      } catch (e) { close(); return false; }
    })()).finally(() => { opening = null; });
  }
  function close() {
    sOpen = false; gen++;
    if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; an = null; buf = null;
    if (ctx) { ctx.close().catch(() => {}); ctx = null; } show(false); lvl = 0;
  }
  // نغمة بالارتباط الذاتي على 1024 عينة؛ تُحسب عند الطلب فقط وحين يكون الصوت مسموعًا
  function pitch(b, sr) {
    const n = b.length, lo = Math.floor(sr / 1000), hi = Math.min(Math.floor(sr / 70), n >> 1); let best = 0, bl = 0; const c0 = new Float32Array(hi + 2);
    for (let l = lo; l <= hi; l++) { let s = 0; for (let i = 0; i + l < n; i++) s += b[i] * b[i + l]; c0[l] = s; }
    let r0 = 0; for (let i = 0; i < n; i++) r0 += b[i] * b[i]; if (r0 < 1e-6) return 0;
    for (let l = lo + 1; l < hi; l++) if (c0[l] > best && c0[l] >= c0[l - 1] && c0[l] >= c0[l + 1]) { best = c0[l]; bl = l; }
    return best / r0 > 0.5 && bl ? Math.round(sr / bl) : 0;
  }
  // عيّنة واحدة: {level 0..1 مُنعَّم, loud, onset (ذروة مفاجئة: تصفيق/صرخة), pitch Hz أو 0}
  function sample(thr, wantPitch) {
    let raw = 0, p = 0;
    if (synth) { raw = Math.max(0, Math.min(1, +synth.level || 0)); p = wantPitch ? Math.max(0, +synth.pitch || 0) : 0; if (synth.fire > fired) { fired = synth.fire; lvl = Math.max(lvl, 0.9); lastOn = performance.now(); return { level: lvl, loud: lvl > thr, onset: true, pitch: p }; } }
    else if (an) {
      an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length); raw = Math.min(1, rms * 3); if (wantPitch && rms > 0.02) p = pitch(buf, ctx.sampleRate);
    } else return { level: 0, loud: false, onset: false, pitch: 0 };
    lvl = raw > lvl ? lvl + (raw - lvl) * 0.6 : lvl + (raw - lvl) * 0.15;
    const now = performance.now(), on = raw > 0.12 && raw > avg * 3 && raw > prev * 1.5 && now - lastOn > 250; if (on) lastOn = now;
    avg += (raw - avg) * 0.05; prev = raw;
    return { level: +lvl.toFixed(3), loud: lvl > thr, onset: on, pitch: p };
  }
  return { open, close, sample, live, useSynth(o) { if (new URLSearchParams(location.search).get('debug') !== '1') return; synth = o || null; if (!o) { show(false); } }, get synth() { return synth; }, get tracksLive() { return stream ? stream.getTracks().filter(t => t.readyState === 'live').length : 0; } };
})();
