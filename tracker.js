'use strict';
// محلل الإطارات داخل المضيف. لا شيء منه يصل اللعبة إلا أرقامًا مشتقة (أو لقطة 48x36 رمادية بطلب صريح).
// الإحداثيات كلها نسبية للمرئي على الشاشة (بعد القصّ cover وبعد عكس الأمامية)، x,y من 0 إلى 1.
const Analyzer = (() => {
  const PRESETS = {
    red: [[0, 12], [345, 360]], orange: [[16, 38]], yellow: [[45, 65]],
    green: [[90, 150]], blue: [[200, 255]], purple: [[260, 300]]
  };
  const wc = document.createElement('canvas');
  const cx = wc.getContext('2d', { willReadFrequently: true });
  const lc = document.createElement('canvas'); lc.width = 48; lc.height = 36;
  const lx = lc.getContext('2d', { willReadFrequently: true });
  let W = 0, H = 0, px = null, gray = null, prev = null, hsv = null, SENS = 1;
  // حساسية الكاميرا (0.5.2): إعداد المضيف «منخفضة/عادية/عالية» يضرب عتبة فرق البكسل التي طلبتها اللعبة (1.5/1/0.65). «عادية» = 1 = سلوك ما قبلها حرفيًا. اللعبة لا تراه ولا تغيّره.
  const thrOf = sp => SENS === 1 ? sp.thr : Math.min(160, Math.max(3, sp.thr * SENS));

  const clamp = (v, a, b, d) => (typeof v === 'number' && isFinite(v)) ? Math.min(b, Math.max(a, v)) : d;
  function cropRect(video, sw, sh) {
    const vw = video.videoWidth, vh = video.videoHeight, sa = sw / sh, va = vw / vh;
    let x = 0, y = 0, w = vw, h = vh;
    if (va > sa) { w = vh * sa; x = (vw - w) / 2; } else { h = vw / sa; y = (vh - h) / 2; }
    return [x, y, w, h];
  }
  // يلتقط الإطار الحالي بدقة تحليل صغيرة. يعيد false إن لم يجهز الفيديو.
  function capture(video, sw, sh, mirror) {
    if (!video.videoWidth || !sw || !sh) return false;
    const a = sw / sh, nw = a >= 1 ? 96 : Math.max(32, Math.round(96 * a)), nh = a >= 1 ? Math.max(32, Math.round(96 / a)) : 96;
    if (nw !== W || nh !== H) { W = nw; H = nh; wc.width = W; wc.height = H; prev = null; gray = null; }
    const [x, y, w, h] = cropRect(video, sw, sh);
    cx.save(); if (mirror) { cx.translate(W, 0); cx.scale(-1, 1); }
    cx.drawImage(video, x, y, w, h, 0, 0, W, H); cx.restore();
    px = cx.getImageData(0, 0, W, H).data; if (gray) prev = gray; gray = null; hsv = null; // إطار الحركة السابق يُحفظ مرة واحدة فيصلح لعدة متتبعات في الإطار نفسه
    return true;
  }
  function toGray() {
    if (gray) return gray; gray = new Uint8Array(W * H);
    for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (px[i] * 77 + px[i + 1] * 151 + px[i + 2] * 28) >> 8;
    return gray;
  }
  function toHSV() {
    if (hsv) return hsv; const n = W * H; hsv = { h: new Float32Array(n), s: new Float32Array(n), v: new Float32Array(n) };
    for (let j = 0, i = 0; j < n; j++, i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
      hsv.h[j] = h; hsv.s[j] = mx ? d / mx : 0; hsv.v[j] = mx / 255;
    }
    return hsv;
  }
  const pair = (p, lo, hi) => Array.isArray(p) && p.length === 2 ? [clamp(p[0], lo, hi, lo), clamp(p[1], lo, hi, hi)] : [lo, hi];
  // يطبّع مواصفة اللون القادمة من اللعبة (لا يُوثَق بشيء منها). يعيد {error} أو {spec}.
  function normColor(o) {
    if (!o || typeof o !== 'object') return { error: 'مواصفة اللون يجب أن تكون كائنًا' };
    let hr;
    if (typeof o.name === 'string') { hr = PRESETS[o.name]; if (!hr) return { error: 'اسم لون غير معروف: ' + String(o.name).slice(0, 20) + ' (المتاح: ' + Object.keys(PRESETS).join(' ') + ')' }; }
    else if (Array.isArray(o.h) && Array.isArray(o.h[0])) hr = o.h.slice(0, 4).map(p => pair(p, 0, 360));
    else if (Array.isArray(o.h)) { const [a, b] = pair(o.h, 0, 360); hr = a <= b ? [[a, b]] : [[a, 360], [0, b]]; }
    else return { error: 'حدّد name أو h' };
    const z = o.zone || {};
    const zx = clamp(z.x, 0, 1, 0), zy = clamp(z.y, 0, 1, 0);
    return { spec: { hr, s: Array.isArray(o.s) ? pair(o.s, 0, 1) : [0.45, 1], v: Array.isArray(o.v) ? pair(o.v, 0, 1) : [0.3, 1],
      zx, zy, zw: clamp(z.w, 0.01, 1 - zx, 1 - zx), zh: clamp(z.h, 0.01, 1 - zy, 1 - zy), min: clamp(o.minRatio, 0, 1, 0.12) } };
  }
  function color(sp) {
    const { h, s, v } = toHSV();
    const x0 = Math.floor(sp.zx * W), x1 = Math.max(x0 + 1, Math.ceil((sp.zx + sp.zw) * W)), y0 = Math.floor(sp.zy * H), y1 = Math.max(y0 + 1, Math.ceil((sp.zy + sp.zh) * H));
    let hit = 0, tot = 0, sx = 0, sy = 0;
    for (let y = y0; y < Math.min(H, y1); y++) for (let x = x0; x < Math.min(W, x1); x++) {
      const j = y * W + x; tot++;
      if (s[j] >= sp.s[0] && s[j] <= sp.s[1] && v[j] >= sp.v[0] && v[j] <= sp.v[1] && sp.hr.some(r => h[j] >= r[0] && h[j] <= r[1])) { hit++; sx += x; sy += y; }
    }
    const ratio = tot ? hit / tot : 0;
    return { present: ratio >= sp.min, ratio: +ratio.toFixed(3), cx: hit ? +((sx / hit + .5) / W).toFixed(3) : 0.5, cy: hit ? +((sy / hit + .5) / H).toFixed(3) : 0.5, area: +(hit / (W * H)).toFixed(3) };
  }
  function normMotion(o) {
    o = o || {}; const g = Array.isArray(o.grid) ? o.grid : [1, 1];
    return { spec: { cols: clamp(Math.round(g[0]), 1, 16, 1), rows: clamp(Math.round(g[1]), 1, 16, 1), thr: clamp(o.threshold, 4, 120, 28) } };
  }
  function motion(sp) {
    const g = toGray(), cols = sp.cols, rows = sp.rows, cells = new Float32Array(cols * rows), cn = new Uint16Array(cols * rows);
    let mv = 0, sx = 0, sy = 0; const thr = thrOf(sp);
    if (!prev || prev.length !== g.length) return { energy: 0, dx: 0, dy: 0, cx: .5, cy: .5, cells: Array.from(cells) };
    for (let y = 0; y < H; y++) { const cr = Math.min(rows - 1, (y * rows / H) | 0);
      for (let x = 0; x < W; x++) { const j = y * W + x, c = cr * cols + Math.min(cols - 1, (x * cols / W) | 0); cn[c]++;
        if (Math.abs(g[j] - prev[j]) > thr) { cells[c]++; mv++; sx += x; sy += y; } } }
    const ncx = mv ? (sx / mv + .5) / W : .5, ncy = mv ? (sy / mv + .5) / H : .5;
    const pc = sp.pc, dx = pc && mv ? ncx - pc[0] : 0, dy = pc && mv ? ncy - pc[1] : 0; sp.pc = mv ? [ncx, ncy] : null;
    const r = n => +n.toFixed(3);
    return { energy: r(mv / (W * H)), dx: r(dx), dy: r(dy), cx: r(ncx), cy: r(ncy), cells: Array.from(cells, (n, i) => r(cn[i] ? n / cn[i] : 0)) };
  }

  // ---------- حارات اللاعبين: يقسم عرض الشاشة المرئي إلى count عمودًا ويقيس كل عمود على حدة ----------
  // by:'motion' (الافتراضي) أو 'color' (يلزم color). energy وratio متطابقتان: نسبة بكسلات الحارة المتحركة/المطابقة للون (0..1).
  function normLanes(o) {
    o = o || {}; const count = Math.round(clamp(o.count, 2, 4, 2)), by = o.by === 'color' ? 'color' : 'motion';
    const sp = { count, by, thr: clamp(o.threshold, 4, 120, 28), min: clamp(o.minRatio, 0, 1, by === 'color' ? 0.12 : 0.02) };
    if (by === 'color') { const r = normColor(o.color); if (r.error) return r; sp.col = r.spec; }
    return { spec: sp };
  }
  function lanes(sp) {
    const L = sp.count, hit = new Float32Array(L), tot = new Float32Array(L), sx = new Float32Array(L), sy = new Float32Array(L), r3 = v => +v.toFixed(3);
    if (sp.by === 'motion') {
      const g = toGray(), thr = thrOf(sp); if (prev && prev.length === g.length) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const j = y * W + x, l = Math.min(L - 1, (x * L / W) | 0); tot[l]++; if (Math.abs(g[j] - prev[j]) > thr) { hit[l]++; sx[l] += x; sy[l] += y; } }
      else for (let x = 0; x < W; x++) tot[Math.min(L - 1, (x * L / W) | 0)] += H;
    } else {
      const { h, s, v } = toHSV(), c = sp.col;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const j = y * W + x, l = Math.min(L - 1, (x * L / W) | 0); tot[l]++;
        if (s[j] >= c.s[0] && s[j] <= c.s[1] && v[j] >= c.v[0] && v[j] <= c.v[1] && c.hr.some(r => h[j] >= r[0] && h[j] <= r[1])) { hit[l]++; sx[l] += x; sy[l] += y; } }
    }
    const out = []; for (let l = 0; l < L; l++) { const ratio = tot[l] ? hit[l] / tot[l] : 0;
      out.push({ energy: r3(ratio), ratio: r3(ratio), present: ratio >= sp.min, cx: hit[l] ? r3((sx[l] / hit[l] + .5) / W) : r3((l + .5) / L), cy: hit[l] ? r3((sy[l] / hit[l] + .5) / H) : .5 }); }
    return { lanes: out };
  }
  // ---------- لون لكل لاعب: list=[{id,color:{name|h,s,v},zone?,minArea?}] — يعيد لكل لاعب {id,present,cx,cy,area,ratio} ----------
  function normPlayers(o) {
    const list = o && Array.isArray(o.list) ? o.list.slice(0, 4) : []; if (!list.length) return { error: 'colorPerPlayer: قائمة لاعبين فارغة' };
    const ps = []; for (let i = 0; i < list.length; i++) {
      const p = list[i] || {}, id = String(p.id == null ? 'p' + (i + 1) : p.id).slice(0, 12), r = normColor(p.color); if (r.error) return { error: 'اللاعب ' + id + ': ' + r.error };
      ps.push({ id, c: r.spec, min: clamp(p.minArea, 0, 1, 0.004) });
    }
    return { spec: { ps } };
  }
  function players(sp) {
    const { h, s, v } = toHSV(), P = sp.ps, k = P.length, hit = new Float32Array(k), sx = new Float32Array(k), sy = new Float32Array(k), r3 = x => +x.toFixed(3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const j = y * W + x; for (let i = 0; i < k; i++) { const c = P[i].c;
        if (x / W >= c.zx && x / W <= c.zx + c.zw && y / H >= c.zy && y / H <= c.zy + c.zh && s[j] >= c.s[0] && s[j] <= c.s[1] && v[j] >= c.v[0] && v[j] <= c.v[1] && c.hr.some(r => h[j] >= r[0] && h[j] <= r[1])) { hit[i]++; sx[i] += x; sy[i] += y; } } }
    return { players: P.map((p, i) => { const area = hit[i] / (W * H); return { id: p.id, present: area >= p.min, area: r3(area), ratio: r3(area), cx: hit[i] ? r3((sx[i] / hit[i] + .5) / W) : .5, cy: hit[i] ? r3((sy[i] / hit[i] + .5) / H) : .5 }; }) };
  }
  function lowres(video, sw, sh, mirror) {
    const [x, y, w, h] = cropRect(video, sw, sh);
    lx.save(); if (mirror) { lx.translate(48, 0); lx.scale(-1, 1); } lx.drawImage(video, x, y, w, h, 0, 0, 48, 36); lx.restore();
    const d = lx.getImageData(0, 0, 48, 36).data, out = new Uint8Array(48 * 36);
    for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = (d[i] * 77 + d[i + 1] * 151 + d[i + 2] * 28) >> 8;
    return out;
  }
  // متوسط لون 5x5 حول نقطة (نسبية) من الإطار الملتقط حاليًا
  function sample(nx, ny) {
    const { h, s, v } = toHSV(), cxp = Math.min(W - 1, Math.max(0, Math.floor(nx * W))), cyp = Math.min(H - 1, Math.max(0, Math.floor(ny * H)));
    let sv = 0, vv = 0, hx = 0, hy = 0, n = 0;
    for (let y = cyp - 2; y <= cyp + 2; y++) for (let x = cxp - 2; x <= cxp + 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue; const j = y * W + x; n++; sv += s[j]; vv += v[j]; const a = h[j] * Math.PI / 180; hx += Math.cos(a); hy += Math.sin(a);
    }
    let hh = Math.atan2(hy, hx) * 180 / Math.PI; if (hh < 0) hh += 360;
    return { h: Math.round(hh), s: +(sv / n).toFixed(2), v: +(vv / n).toFixed(2) };
  }
  function reset() { px = gray = prev = hsv = null; W = H = 0; }
  function setSensitivity(k) { SENS = typeof k === 'number' && isFinite(k) ? Math.min(2, Math.max(0.4, k)) : 1; }
  const threshold = sp => thrOf(sp);
  return { setSensitivity, threshold, sensitivity: () => SENS, capture, normColor, normMotion, normLanes, normPlayers, color, motion, lanes, players, lowres, sample, reset, PRESETS };
})();
