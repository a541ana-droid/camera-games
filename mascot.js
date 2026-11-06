'use strict';
// الشخصيات الأربع (DESIGN.md §8): قطرة · لهيب · شمسة · ورقة — واحدة لكل لون/شكل لاعب. رسم متجهي مؤقّت خلف دالة واحدة
// CGMascot.draw(ctx, i, x, y, size, {mood, look}, t) فيستطيع المالك لاحقًا استبدال الرسم برسومه دون أن تتغيّر أي لعبة.
// يعمل الملف نفسه في الصفحة (ردهة التلفاز، الذراع، شاشة النتيجة) وداخل Worker اللعبة (api.ui.mascot): أوامر Canvas2D عادية فقط
// (بلا تدرّجات ولا نصوص ولا صور) كي يقبلها مسجّل الأوامر والتحقق في المضيف كما هي.
(function (root) {
  const INFO = Object.freeze([
    Object.freeze({ name: 'قطرة', en: 'drop', color: '#4da3ff', dark: '#1d5fb0', light: '#b9dcff', shape: 'circle' }),
    Object.freeze({ name: 'لهيب', en: 'flame', color: '#ff6b8b', dark: '#b8304f', light: '#ffd0da', shape: 'triangle' }),
    Object.freeze({ name: 'شمسة', en: 'sun', color: '#ffc145', dark: '#b97c00', light: '#fff0c4', shape: 'square' }),
    Object.freeze({ name: 'ورقة', en: 'leaf', color: '#3ddc97', dark: '#16855a', light: '#c4f5df', shape: 'diamond' })
  ]);
  const MOODS = ['happy', 'wow', 'sad', 'cheer'], TAU = Math.PI * 2, INK = '#1a1430', EMPTY = {};
  const idx = i => (((i | 0) % 4) + 4) % 4;
  const fin = (v, d) => (typeof v === 'number' && v - v === 0 ? v : d);

  // جسم كل شخصية حول (0,0) بنصف قطر r (الوجه في المركز تقريبًا)
  function body(c, k, r, t, mood) {
    c.beginPath();
    if (k === 0) { // قطرة: دائرة بذروة ناعمة في الأعلى
      c.moveTo(0, -r * 1.32);
      c.bezierCurveTo(r * 0.35, -r * 0.95, r * 1.02, -r * 0.45, r * 1.02, r * 0.12);
      c.bezierCurveTo(r * 1.02, r * 0.72, r * 0.56, r * 1.02, 0, r * 1.02);
      c.bezierCurveTo(-r * 0.56, r * 1.02, -r * 1.02, r * 0.72, -r * 1.02, r * 0.12);
      c.bezierCurveTo(-r * 1.02, -r * 0.45, -r * 0.35, -r * 0.95, 0, -r * 1.32);
    } else if (k === 1) { // لهيب: مثلث مستدير بلسانين يتراقصان
      const f = Math.sin(t * 7) * 0.12, g = Math.sin(t * 5.3 + 1) * 0.1;
      c.moveTo(0, r * 1.02);
      c.bezierCurveTo(-r * 0.78, r * 1.02, -r * 1.1, r * 0.5, -r * 0.95, -r * 0.05);
      c.bezierCurveTo(-r * 0.85, -r * 0.45, -r * 0.55, -r * 0.6, -r * (0.55 + g), -r * 1.0);
      c.bezierCurveTo(-r * 0.2, -r * 0.8, -r * 0.1, -r * 0.7, r * (0.05 + f), -r * 1.45);
      c.bezierCurveTo(r * 0.45, -r * 1.0, r * 0.95, -r * 0.6, r * 0.98, -r * 0.05);
      c.bezierCurveTo(r * 1.1, r * 0.5, r * 0.78, r * 1.02, 0, r * 1.02);
    } else if (k === 2) { // شمسة: مربّع مستدير
      const a = r * 0.95, q = r * 0.5; // مسار يدوي: roundRect غير موجود قبل iOS 16 في canvas الصفحة
      c.moveTo(-a + q, -a); c.lineTo(a - q, -a); c.quadraticCurveTo(a, -a, a, -a + q); c.lineTo(a, a - q); c.quadraticCurveTo(a, a, a - q, a);
      c.lineTo(-a + q, a); c.quadraticCurveTo(-a, a, -a, a - q); c.lineTo(-a, -a + q); c.quadraticCurveTo(-a, -a, -a + q, -a);
    } else { // ورقة: معيّن بحواف منحنية
      c.moveTo(0, -r * 1.3);
      c.quadraticCurveTo(r * 1.05, -r * 0.55, r * 1.0, 0);
      c.quadraticCurveTo(r * 0.95, r * 0.75, 0, r * 1.15);
      c.quadraticCurveTo(-r * 0.95, r * 0.75, -r * 1.0, 0);
      c.quadraticCurveTo(-r * 1.05, -r * 0.55, 0, -r * 1.3);
    }
    c.closePath();
  }
  function rays(c, r, t, col) { // أشعة شمسة: ثمانية مثلثات مستديرة تدور ببطء
    c.save(); c.rotate(t * 0.6); c.fillStyle = col;
    for (let j = 0; j < 8; j++) {
      c.rotate(TAU / 8); c.beginPath(); c.moveTo(-r * 0.2, -r * 1.08); c.lineTo(0, -r * 1.48); c.lineTo(r * 0.2, -r * 1.08); c.closePath(); c.fill();
    }
    c.restore();
  }
  function draw(c, i, x, y, size, o, t) {
    o = o || EMPTY; const k = idx(i), I = INFO[k], s = Math.max(4, fin(size, 60)), r = s * 0.42; t = fin(t, 0);
    const mood = MOODS.indexOf(o.mood) >= 0 ? o.mood : 'happy', still = !!o.still, T = still ? 0 : t + k * 0.7;
    let lx = 0, ly = 0; const lk = o.look;
    if (lk && typeof lk === 'object') { lx = fin(lk.x, 0); ly = fin(lk.y, 0); } else if (typeof lk === 'number') lx = fin(lk, 0);
    lx = Math.max(-1, Math.min(1, lx)); ly = Math.max(-1, Math.min(1, ly));
    // حركة الجسم: تنفّس هادئ؛ «هتاف» قفز؛ «حزن» انكماش
    const bob = mood === 'cheer' ? -Math.abs(Math.sin(T * 6)) * r * 0.32 : Math.sin(T * 2.4) * r * 0.05;
    const sq = mood === 'cheer' ? 1 + Math.sin(T * 12) * 0.04 : mood === 'sad' ? 0.94 : 1 + Math.sin(T * 2.4) * 0.02;
    c.save(); c.translate(fin(x, 0), fin(y, 0) + bob);
    // ظلّ على الأرض
    c.save(); c.globalAlpha = 0.22; c.fillStyle = '#000000'; c.beginPath(); c.ellipse(0, r * 1.12 - bob, r * 0.82 * (1 + bob / (r * 2)), r * 0.16, 0, 0, TAU); c.fill(); c.restore();
    c.scale(1 / Math.sqrt(sq), sq);
    if (k === 2) rays(c, r, T, I.color);
    body(c, k, r, T, mood); c.fillStyle = I.color; c.fill(); c.lineWidth = Math.max(1.5, r * 0.07); c.lineJoin = 'round'; c.strokeStyle = I.dark; c.stroke();
    // لمعة وزينة لكل شخصية
    c.save(); c.globalAlpha = 0.55; c.fillStyle = I.light;
    if (k === 0) { c.beginPath(); c.ellipse(-r * 0.5, -r * 0.35, r * 0.13, r * 0.26, -0.5, 0, TAU); c.fill(); }
    else if (k === 1) { c.beginPath(); c.ellipse(-r * 0.55, -r * 0.12, r * 0.12, r * 0.24, -0.35, 0, TAU); c.fill(); c.globalAlpha = 0.35; c.beginPath(); c.ellipse(0, r * 0.82, r * 0.4, r * 0.14, 0, 0, TAU); c.fill(); }
    else if (k === 2) { c.beginPath(); c.ellipse(-r * 0.52, -r * 0.55, r * 0.2, r * 0.12, -0.6, 0, TAU); c.fill(); }
    else { c.globalAlpha = 0.6; c.strokeStyle = I.dark; c.lineWidth = Math.max(1, r * 0.05); c.beginPath(); c.moveTo(0, r * 1.12); c.lineTo(0, r * 0.62); c.stroke(); c.globalAlpha = 0.5; c.fillStyle = I.light; c.beginPath(); c.ellipse(-r * 0.45, -r * 0.5, r * 0.12, r * 0.22, -0.7, 0, TAU); c.fill(); }
    c.restore();
    // الوجه
    const fy = k === 0 ? r * 0.12 : k === 1 ? r * 0.22 : k === 3 ? r * 0.05 : 0;
    const blink = !still && (T % 3.7) > 3.55, er = r * (mood === 'wow' ? 0.31 : 0.26), ex = r * 0.36, eh = blink ? 0.12 : mood === 'sad' ? 0.8 : 1;
    c.fillStyle = '#ffffff'; c.strokeStyle = INK; c.lineWidth = Math.max(1, r * 0.035);
    for (let side = -1; side <= 1; side += 2) {
      c.beginPath(); c.ellipse(side * ex, fy - r * 0.08, er * 0.9, er * eh, 0, 0, TAU); c.fill(); c.stroke();
      if (!blink) { c.fillStyle = INK; c.beginPath(); c.arc(side * ex + lx * er * 0.4, fy - r * 0.08 + ly * er * 0.4 * eh, er * 0.5, 0, TAU); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(side * ex + lx * er * 0.4 - er * 0.18, fy - r * 0.08 + ly * er * 0.4 - er * 0.2, er * 0.17, 0, TAU); c.fill(); }
      if (mood === 'sad') { c.beginPath(); c.moveTo(side * (ex + er * 0.9), fy - r * 0.4); c.lineTo(side * (ex - er * 0.7), fy - r * 0.5); c.lineCap = 'round'; c.stroke(); }
    }
    // الخدّان
    c.save(); c.globalAlpha = 0.35; c.fillStyle = '#ff9fb4'; c.beginPath(); c.ellipse(-ex - r * 0.08, fy + r * 0.24, r * 0.15, r * 0.09, 0, 0, TAU); c.ellipse(ex + r * 0.08, fy + r * 0.24, r * 0.15, r * 0.09, 0, 0, TAU); c.fill(); c.restore();
    // الفم بحسب المزاج
    const my = fy + r * 0.3; c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = Math.max(1.5, r * 0.07); c.lineCap = 'round'; c.beginPath();
    if (mood === 'happy') { c.arc(0, my - r * 0.06, r * 0.2, 0.25, Math.PI - 0.25); c.stroke(); }
    else if (mood === 'wow') { c.ellipse(0, my + r * 0.04, r * 0.11, r * 0.14, 0, 0, TAU); c.fill(); }
    else if (mood === 'sad') { c.arc(0, my + r * 0.16, r * 0.17, Math.PI + 0.45, TAU - 0.45); c.stroke(); }
    else { c.moveTo(-r * 0.24, my - r * 0.04); c.quadraticCurveTo(0, my + r * 0.42, r * 0.24, my - r * 0.04); c.closePath(); c.fill(); c.fillStyle = '#ff7a8f'; c.beginPath(); c.ellipse(0, my + r * 0.14, r * 0.1, r * 0.06, 0, 0, TAU); c.fill(); }
    // نجوم الهتاف / دمعة الحزن
    if (mood === 'cheer' && !still) {
      c.fillStyle = '#fff3b0';
      for (let j = 0; j < 3; j++) { const a = T * 2 + j * 2.1, d = r * (1.45 + 0.1 * Math.sin(T * 5 + j)), sx = Math.cos(a) * d, sy = Math.sin(a) * d * 0.8 - r * 0.2, ss = r * 0.12; c.beginPath(); c.moveTo(sx, sy - ss); c.lineTo(sx + ss * 0.3, sy - ss * 0.3); c.lineTo(sx + ss, sy); c.lineTo(sx + ss * 0.3, sy + ss * 0.3); c.lineTo(sx, sy + ss); c.lineTo(sx - ss * 0.3, sy + ss * 0.3); c.lineTo(sx - ss, sy); c.lineTo(sx - ss * 0.3, sy - ss * 0.3); c.closePath(); c.fill(); }
    } else if (mood === 'sad') { c.fillStyle = '#9fd0ff'; c.beginPath(); c.ellipse(ex + er * 0.3, fy + r * 0.12 + (still ? 0 : (T * 0.6 % 1) * r * 0.3), r * 0.06, r * 0.09, 0, 0, TAU); c.fill(); }
    c.restore();
  }
  root.CGMascot = Object.freeze({ info: INFO, moods: Object.freeze(MOODS.slice()), draw });
})(typeof self !== 'undefined' ? self : this);
