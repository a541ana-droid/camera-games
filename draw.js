'use strict';
// منفّذ الرسم في المضيف: يحوّل مخزن الأوامر القادم من لعبة (غير موثوقة) إلى رسم على canvas حقيقي.
// المصدر الوحيد لجدول الأوامر هو CMD أدناه: ترتيبه هو رقم الأمر، ويُحقن اسمه ومواصفته في Worker فتبني منه الواجهة.
// مواصفة الوسائط: n رقم منتهٍ، s نص (≤300)، v قائمة أرقام (يسبقها العدد، ≤16).
const Draw = (() => {
  const MAXE = 24000, MAXS = 300, MAXDEPTH = 64, MAXGRAD = 16, LIM = 1e7;
  const OK_COMP = ['source-over', 'source-in', 'source-out', 'source-atop', 'destination-over', 'destination-in', 'destination-out', 'destination-atop', 'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'];
  const ENUM = { lineCap: ['butt', 'round', 'square'], lineJoin: ['miter', 'round', 'bevel'], textAlign: ['start', 'end', 'left', 'right', 'center'], textBaseline: ['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'], direction: ['inherit', 'ltr', 'rtl'], globalCompositeOperation: OK_COMP };
  const SAFE_STR = /^[^;{}\\<>]{1,100}$/;
  let x = null, cv = null, depth = 0, grads = [], images = [], W = 0, H = 0, D = 1, errs = 0;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const setEnum = k => (c, a) => { if (ENUM[k].includes(a[0])) c[k] = a[0]; };
  const setNum = (k, lo, hi) => (c, a) => { c[k] = cl(a[0], lo, hi); };
  const setStr = k => (c, a) => { if (SAFE_STR.test(a[0])) c[k] = a[0]; };
  function rrect(c, px, py, w, h, r) { // roundRect غير متوفر قبل iOS 16: مسار يدوي موحّد
    if (w < 0) { px += w; w = -w; } if (h < 0) { py += h; h = -h; } r = Math.min(Math.max(0, r), w / 2, h / 2);
    c.moveTo(px + r, py); c.arcTo(px + w, py, px + w, py + h, r); c.arcTo(px + w, py + h, px, py + h, r); c.arcTo(px, py + h, px, py, r); c.arcTo(px, py, px + w, py, r); c.closePath();
  }
  const img = i => images[i | 0];
  // الترتيب = رقم الأمر. لا تعدّل الترتيب بلا رفع الإصدار.
  const CMD = {
    fillRect: ['nnnn', (c, a) => c.fillRect(a[0], a[1], a[2], a[3])], strokeRect: ['nnnn', (c, a) => c.strokeRect(a[0], a[1], a[2], a[3])], clearRect: ['nnnn', (c, a) => c.clearRect(a[0], a[1], a[2], a[3])],
    beginPath: ['', c => c.beginPath()], closePath: ['', c => c.closePath()], moveTo: ['nn', (c, a) => c.moveTo(a[0], a[1])], lineTo: ['nn', (c, a) => c.lineTo(a[0], a[1])],
    arc: ['nnnnnn', (c, a) => { if (a[2] >= 0) c.arc(a[0], a[1], a[2], a[3], a[4], !!a[5]); }],
    ellipse: ['nnnnnnnn', (c, a) => { if (a[2] >= 0 && a[3] >= 0) c.ellipse(a[0], a[1], a[2], a[3], a[4], a[5], a[6], !!a[7]); }],
    arcTo: ['nnnnn', (c, a) => { if (a[4] >= 0) c.arcTo(a[0], a[1], a[2], a[3], a[4]); }],
    quadraticCurveTo: ['nnnn', (c, a) => c.quadraticCurveTo(a[0], a[1], a[2], a[3])], bezierCurveTo: ['nnnnnn', (c, a) => c.bezierCurveTo(a[0], a[1], a[2], a[3], a[4], a[5])],
    rect: ['nnnn', (c, a) => c.rect(a[0], a[1], a[2], a[3])], roundRect: ['nnnnn', (c, a) => rrect(c, a[0], a[1], a[2], a[3], a[4])],
    fill: ['', c => c.fill()], stroke: ['', c => c.stroke()], clip: ['', c => c.clip()],
    fillText: ['snn', (c, a) => c.fillText(a[0], a[1], a[2])], strokeText: ['snn', (c, a) => c.strokeText(a[0], a[1], a[2])],
    save: ['', c => { c.save(); depth++; }], restore: ['', c => { if (depth > 0) { c.restore(); depth--; } }],
    translate: ['nn', (c, a) => c.translate(a[0], a[1])], rotate: ['n', (c, a) => c.rotate(a[0])], scale: ['nn', (c, a) => c.scale(a[0], a[1])],
    transform: ['nnnnnn', (c, a) => c.transform(a[0], a[1], a[2], a[3], a[4], a[5])],
    setTransform: ['nnnnnn', (c, a) => c.setTransform(D * a[0], D * a[1], D * a[2], D * a[3], D * a[4], D * a[5])], // نسبة إلى إحداثيات CSS لا البكسلات
    setLineDash: ['v', (c, a) => c.setLineDash(a.slice(1, 1 + a[0]))],
    drawImage3: ['nnn', (c, a) => { const m = img(a[0]); if (m) c.drawImage(m, a[1], a[2]); }],
    drawImage5: ['nnnnn', (c, a) => { const m = img(a[0]); if (m) c.drawImage(m, a[1], a[2], a[3], a[4]); }],
    drawImage9: ['nnnnnnnnn', (c, a) => { const m = img(a[0]); if (m) c.drawImage(m, a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]); }],
    gradLin: ['nnnnn', (c, a) => { if (a[0] === grads.length && a[0] < MAXGRAD) grads.push(c.createLinearGradient(a[1], a[2], a[3], a[4])); }],
    gradRad: ['nnnnnnn', (c, a) => { if (a[0] === grads.length && a[0] < MAXGRAD && a[3] >= 0 && a[6] >= 0) grads.push(c.createRadialGradient(a[1], a[2], a[3], a[4], a[5], a[6])); }],
    gradStop: ['nns', (c, a) => { const g = grads[a[0]]; if (g && SAFE_STR.test(a[2])) try { g.addColorStop(cl(a[1], 0, 1), a[2]); } catch (e) { /* لون غير صالح: يتجاهل كما يفعل المتصفح بالتعيين */ } }],
    setFillStyle: ['s', (c, a) => { if (SAFE_STR.test(a[0])) c.fillStyle = a[0]; }], setStrokeStyle: ['s', (c, a) => { if (SAFE_STR.test(a[0])) c.strokeStyle = a[0]; }],
    setFillGrad: ['n', (c, a) => { if (grads[a[0]]) c.fillStyle = grads[a[0]]; }], setStrokeGrad: ['n', (c, a) => { if (grads[a[0]]) c.strokeStyle = grads[a[0]]; }],
    setGlobalAlpha: ['n', setNum('globalAlpha', 0, 1)], setLineWidth: ['n', setNum('lineWidth', 0, 1000)], setMiterLimit: ['n', setNum('miterLimit', 0, 1000)], setLineDashOffset: ['n', setNum('lineDashOffset', -1e5, 1e5)],
    setShadowBlur: ['n', setNum('shadowBlur', 0, 200)], setShadowOffsetX: ['n', setNum('shadowOffsetX', -1000, 1000)], setShadowOffsetY: ['n', setNum('shadowOffsetY', -1000, 1000)], setShadowColor: ['s', setStr('shadowColor')],
    setFont: ['s', setStr('font')], setLineCap: ['s', setEnum('lineCap')], setLineJoin: ['s', setEnum('lineJoin')], setTextAlign: ['s', setEnum('textAlign')], setTextBaseline: ['s', setEnum('textBaseline')],
    setDirection: ['s', setEnum('direction')], setGlobalCompositeOperation: ['s', setEnum('globalCompositeOperation')], setImageSmoothingEnabled: ['n', (c, a) => { c.imageSmoothingEnabled = !!a[0]; }]
  };
  const NAMES = Object.keys(CMD), SPECS = NAMES.map(k => CMD[k][0]), FNS = NAMES.map(k => CMD[k][1]);
  const DEFAULTS = { globalAlpha: 1, lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10, lineDashOffset: 0, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', direction: 'inherit', globalCompositeOperation: 'source-over', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, shadowColor: 'rgba(0,0,0,0)', fillStyle: '#000000', strokeStyle: '#000000', imageSmoothingEnabled: true };

  function attach(canvas) { cv = canvas; x = cv.getContext('2d'); }
  function resize(w, h, dpr) { W = w; H = h; D = Math.min(2, dpr || 1); cv.width = Math.max(1, Math.round(w * D)); cv.height = Math.max(1, Math.round(h * D)); reset(); }
  function reset() {
    while (depth > 0) { x.restore(); depth--; }
    x.setTransform(D, 0, 0, D, 0, 0); x.setLineDash([]); x.beginPath(); for (const k in DEFAULTS) x[k] = DEFAULTS[k]; grads = [];
  }
  function setImages(list) { images = list || []; }
  // ينفّذ مخزن إطار. يعيد { ok, n } — ok=false: مخزن مشوّه (يُحسب انتهاكًا) وتوقّف التنفيذ عنده.
  const A = [];
  function run(buf) {
    if (!Array.isArray(buf) || buf.length > MAXE) return { ok: false, n: 0 };
    reset(); x.clearRect(0, 0, W, H);
    let i = 0, n = 0, ok = true; const len = buf.length;
    try {
      while (i < len) {
        const op = buf[i++], sp = SPECS[op]; if (sp === undefined || typeof op !== 'number') { ok = false; break; }
        let k = 0;
        for (let j = 0; j < sp.length; j++) {
          const c = sp.charCodeAt(j), v = buf[i++];
          if (c === 110) { if (typeof v !== 'number' || v - v !== 0) { ok = false; break; } A[k++] = v > LIM ? LIM : v < -LIM ? -LIM : v; }
          else if (c === 115) { if (typeof v !== 'string') { ok = false; break; } A[k++] = v.length > MAXS ? v.slice(0, MAXS) : v; }
          else { if (typeof v !== 'number' || !(v >= 0 && v <= 16) || v % 1) { ok = false; break; } A[k++] = v; for (let q = 0; q < v; q++) { const e = buf[i++]; if (typeof e !== 'number' || e - e !== 0) { ok = false; break; } A[k++] = e; } if (!ok) break; }
        }
        if (!ok) break; A.length = k;
        FNS[op](x, A); n++;
        if (depth > MAXDEPTH) { ok = false; break; }
      }
    } catch (e) { errs++; ok = false; }
    reset(); return { ok, n };
  }
  // جدول قياس النص: يقاس مرة واحدة في المضيف لأن Worker في iOS 15 بلا OffscreenCanvas. النتائج تقريبية للعربية (انظر ENGINE.md).
  let MT = null;
  function measureTables() {
    if (MT) return MT; const m = document.createElement('canvas').getContext('2d'); MT = {};
    for (const [key, font] of [['n', '100px sans-serif'], ['b', 'bold 100px sans-serif']]) {
      m.font = font; const lat = [], ar = [], tat = m.measureText('ـ').width;
      for (let c = 32; c < 127; c++) lat.push(+(m.measureText(String.fromCharCode(c)).width / 100).toFixed(4));
      for (let c = 0x600; c < 0x700; c++) {
        const ch = String.fromCharCode(c); let w;
        if ((c >= 0x64B && c <= 0x65F) || c === 0x670 || (c >= 0x610 && c <= 0x61A)) w = 0; // علامات تشكيل
        else if ((c >= 0x621 && c <= 0x64A) || (c >= 0x671 && c <= 0x6D3)) w = m.measureText('ـ' + ch + 'ـ').width - 2 * tat; // الشكل المتّصل (وسطيّ) أقرب لما يظهر في النص
        else w = m.measureText(ch).width;
        ar.push(+(Math.max(0, w) / 100).toFixed(4));
      }
      MT[key] = { lat, ar };
    }
    return MT;
  }
  return { attach, resize, reset, run, setImages, measureTables, MAXE, spec: () => NAMES.map((k, i) => [k, SPECS[i]]), stats: () => ({ errs }), DEFAULTS };
})();
