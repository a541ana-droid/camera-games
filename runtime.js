// يعمل داخل Web Worker معزول عن DOM والمضيف. المضيف يحقن self.__SPEC قبل هذا الملف، ويمرّر مسار كود اللعبة (blob) في رسالة hello.
// ترتيب التنفيذ: التقاط الأصليات ← تعطيل الشبكة والـglobals الخطرة وتجميد الوسائط ← انتظار hello ← importScripts(اللعبة) ← init.
// كود اللعبة لا يعمل قبل اكتمال التعطيل، ولا يمسك قناة المضيف (MessagePort محبوسة في الإغلاق).
(() => {
  'use strict';
  const G = self, SPEC = G.__SPEC; try { delete G.__SPEC; } catch (e) { /* */ }
  const apply = Reflect.apply, now = performance.now.bind(performance), rawPost = G.postMessage.bind(G), portPost = MessagePort.prototype.postMessage;
  const addL = G.addEventListener.bind(G), rmL = G.removeEventListener.bind(G), loadScript = G.importScripts.bind(G);
  const MAXE = SPEC.maxe, NAMES = SPEC.cmds.map(c => c[0]), OP = {}; NAMES.forEach((k, i) => { OP[k] = i; });
  rawPost({ alive: 1 }); // قبل أي كود للعبة: يخبر الحاضن أن الـWorker بدأ فعلًا

  // ---------- طبقة التعطيل (طبقة ثانية، ليست حدًّا مطلقًا؛ الأولى CSP على المستند) ----------
  const lockdown = () => {
  const KILL = ['fetch', 'XMLHttpRequest', 'XMLHttpRequestEventTarget', 'XMLHttpRequestUpload', 'WebSocket', 'WebSocketStream', 'WebTransport', 'EventSource', 'importScripts', 'Worker', 'SharedWorker', 'ServiceWorker', 'ServiceWorkerContainer', 'ServiceWorkerRegistration',
    'indexedDB', 'IDBFactory', 'IDBDatabase', 'IDBOpenDBRequest', 'IDBRequest', 'caches', 'CacheStorage', 'Cache', 'BroadcastChannel', 'RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'Notification', 'PushManager', 'SyncManager', 'BackgroundFetchManager',
    'StorageBucket', 'StorageBucketManager', 'FileSystemHandle', 'FileSystemFileHandle', 'FileSystemDirectoryHandle', 'webkitRequestFileSystem', 'webkitRequestFileSystemSync', 'openDatabase', 'FileReaderSync', 'close'];
  const NAV_KILL = ['serviceWorker', 'sendBeacon', 'locks', 'storage', 'storageBuckets', 'connection', 'mediaDevices', 'permissions', 'credentials', 'clipboard', 'usb', 'serial', 'hid', 'bluetooth', 'gpu', 'getBattery', 'webkitTemporaryStorage', 'webkitPersistentStorage'];
  const wipe = (o, k) => {
    try { delete o[k]; } catch (e) { /* */ }
    if (Object.prototype.hasOwnProperty.call(o, k)) try { Object.defineProperty(o, k, { value: undefined, writable: false, configurable: false }); } catch (e) { /* */ }
  };
  const denied = name => function () { throw new Error(name + ' غير متاحة للألعاب — استعمل api فقط'); };
  for (let o = G; o; o = Object.getPrototypeOf(o)) {
    for (const k of KILL) wipe(o, k);
    for (const k of ['postMessage', 'onmessage', 'onmessageerror']) if (Object.prototype.hasOwnProperty.call(o, k)) try { Object.defineProperty(o, k, k === 'postMessage' ? { value: denied('postMessage'), writable: false, configurable: false } : { get() { return null; }, set() { /* ممنوع */ }, configurable: false }); } catch (e) { /* */ }
    if (o === Object.prototype) break;
  }
  for (let o = G.navigator; o; o = Object.getPrototypeOf(o)) { for (const k of NAV_KILL) wipe(o, k); if (o === Object.prototype) break; }
  for (const k of ['postMessage', 'onmessage', 'onmessageerror']) if (!Object.prototype.hasOwnProperty.call(G, k)) try { Object.defineProperty(G, k, k === 'postMessage' ? { value: denied('postMessage'), configurable: false } : { get() { return null; }, set() { /* */ }, configurable: false }); } catch (e) { /* */ }
  };
  if (!SPEC.nogate) lockdown(); // nogate للاختبار فقط (?debug=1&nogate=1): يُظهر ما تغطيه طبقة CSP وحدها
  // ---------- عدّاد الذاكرة الكبيرة (Worker بلا performance.memory) ----------
  // كل حجز كبير عبر Array(n) وArrayBuffer والمصفوفات المحدّدة النوع يُحسب، ويُطرح حين يجمعه جامع القمامة (FinalizationRegistry).
  // الحجز الذي يتجاوز الحد يُرفض بـRangeError قبل أن يحدث (كما يرفض المتصفح ما لا يقدر عليه)، ويبلّغ المضيف فيُغلق اللعبة.
  const MEM = { live: 0, over: 0 }, MEMMAX = SPEC.memmax || 192e6, BIG = 262144;
  const memReg = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry(b => { MEM.live -= b; }) : null;
  const memNote = bytes => {
    if (!(bytes >= BIG)) return 0;
    if (MEM.live + bytes > MEMMAX) { MEM.over = MEM.live + bytes; throw new RangeError('اللعبة طلبت ذاكرة أكثر من الحد (' + Math.round(MEMMAX / 1e6) + ' ميغابايت)'); }
    return bytes;
  };
  const memKeep = (o, bytes) => { if (bytes) { MEM.live += bytes; if (memReg) memReg.register(o, bytes); } return o; };
  const memWrap = (C, size) => {
    if (typeof C !== 'function') return C;
    const P = new Proxy(C, {
      construct(t, a, nt) { const b = memNote(size(a)); return memKeep(Reflect.construct(t, a, nt === P ? t : nt), b); },
      apply(t, th, a) { const b = memNote(size(a)); return memKeep(Reflect.apply(t, th, a), b); }
    });
    try { Object.defineProperty(C.prototype, 'constructor', { value: P, writable: true, configurable: true }); } catch (e) { /* */ }
    return P;
  };
  const numLen = a => (a.length === 1 && typeof a[0] === 'number' ? a[0] : 0);
  G.Array = memWrap(G.Array, a => numLen(a) * 8);
  G.ArrayBuffer = memWrap(G.ArrayBuffer, a => numLen(a));
  for (const k of ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array']) {
    const C = G[k]; if (C) G[k] = memWrap(C, a => numLen(a) * C.BYTES_PER_ELEMENT);
  }
  // تجميد الوسائط التي يعتمد عليها المحرك كي لا يعيد كود اللعبة تعريفها قبل/بعد hello
  for (const o of [MessagePort.prototype, EventTarget.prototype, Reflect, Function.prototype]) try { Object.freeze(o); } catch (e) { /* */ }

  // ---------- مخزن الأوامر ----------
  const buf = []; let n = 0, over = false, frameNo = 0, gradN = 0, skipSave = 0; const stack = [], TMP = new Array(9);
  const DEF = SPEC.defaults; let st = Object.assign({}, DEF), dash = [];
  const rec = (op, k, a, b, c, d, e, f, g, h, i9) => {
    if (n + k + 1 > MAXE) { over = true; return; }
    TMP[0] = a; TMP[1] = b; TMP[2] = c; TMP[3] = d; TMP[4] = e; TMP[5] = f; TMP[6] = g; TMP[7] = h; TMP[8] = i9;
    for (let i = 0; i < k; i++) { const v = +TMP[i]; if (v - v !== 0) return; TMP[i] = v; } // كالمتصفح: القيم غير المنتهية تُتجاهل
    buf[n++] = op; for (let i = 0; i < k; i++) buf[n++] = TMP[i];
  };
  const wcache = { n: SPEC.mt.n, b: SPEC.mt.b };
  function textWidth(s, font) {
    const m = /(\d+(?:\.\d+)?)\s*px/.exec(font), size = m ? +m[1] : 10, t = /\b(bold|bolder|[6-9]00)\b/.test(font) ? wcache.b : wcache.n; let w = 0;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); w += c >= 32 && c < 127 ? t.lat[c - 32] : c >= 0x600 && c < 0x700 ? t.ar[c - 0x600] : (c >= 0x200B && c <= 0x200F) || (c >= 0xFE00 && c <= 0xFE0F) ? 0 : 0.6; }
    return w * size;
  }
  class Grad {
    constructor(kind, c) { this.kind = kind; this.c = c; this.stops = []; this.frame = -1; this.id = -1; }
    addColorStop(o, color) { if (this.stops.length < 32) { o = +o; if (o - o === 0) this.stops.push(Math.min(1, Math.max(0, o)), String(color).slice(0, 64)); } }
  }
  class Ctx {
    constructor() { this.canvas = { width: 0, height: 0 }; }
    save() { if (stack.length >= 64) { skipSave++; return; } rec(OP.save, 0); stack.push(Object.assign({}, st)); }
    restore() { if (skipSave) { skipSave--; return; } if (stack.length) { rec(OP.restore, 0); st = stack.pop(); } }
    arc(x, y, r, s, e, ccw) { rec(OP.arc, 6, x, y, r, s, e, ccw ? 1 : 0); }
    ellipse(x, y, rx, ry, rot, s, e, ccw) { rec(OP.ellipse, 8, x, y, rx, ry, rot, s, e, ccw ? 1 : 0); }
    roundRect(x, y, w, h, r) { rec(OP.roundRect, 5, x, y, w, h, Array.isArray(r) ? r[0] : (r && typeof r === 'object' ? 0 : r || 0)); }
    fill() { rec(OP.fill, 0); } stroke() { rec(OP.stroke, 0); } clip() { rec(OP.clip, 0); }
    fillText(s, x, y) { this._t(OP.fillText, s, x, y); } strokeText(s, x, y) { this._t(OP.strokeText, s, x, y); }
    _t(op, s, x, y) { s = String(s); if (s.length > 300) s = s.slice(0, 300); x = +x; y = +y; if (x - x !== 0 || y - y !== 0 || n + 4 > MAXE) { if (n + 4 > MAXE) over = true; return; } buf[n++] = op; buf[n++] = s; buf[n++] = x; buf[n++] = y; }
    setTransform(a, b, c, d, e, f) { if (a && typeof a === 'object') ({ a, b, c, d, e, f } = a); rec(OP.setTransform, 6, a, b, c, d, e, f); }
    resetTransform() { rec(OP.setTransform, 6, 1, 0, 0, 1, 0, 0); }
    setLineDash(arr) { dash = Array.isArray(arr) ? arr.slice(0, 16).map(Number).filter(v => v - v === 0 && v >= 0) : []; if (n + dash.length + 2 > MAXE) { over = true; return; } buf[n++] = OP.setLineDash; buf[n++] = dash.length; for (const v of dash) buf[n++] = v; }
    getLineDash() { return dash.slice(); }
    measureText(s) { return { width: textWidth(String(s), st.font) }; }
    createLinearGradient(a, b, c, d) { return new Grad(0, [a, b, c, d]); }
    createRadialGradient(a, b, c, d, e, f) { return new Grad(1, [a, b, c, d, e, f]); }
    drawImage(im, a, b, c, d, e, f, g, h) {
      if (!im || typeof im.id !== 'number') return; const k = arguments.length;
      if (k >= 9) rec(OP.drawImage9, 9, im.id, a, b, c, d, e, f, g, h); else if (k >= 5) rec(OP.drawImage5, 5, im.id, a, b, c, d); else rec(OP.drawImage3, 3, im.id, a, b);
    }
  }
  // الدوال العادية (كلها وسائط رقمية) تُبنى من الجدول المشترك مع المضيف
  for (const [name, sp] of SPEC.cmds) {
    if (Object.prototype.hasOwnProperty.call(Ctx.prototype, name) || /^(set[A-Z]|grad|drawImage)/.test(name) || /[^n]/.test(sp)) continue;
    const op = OP[name], k = sp.length; Ctx.prototype[name] = function (a, b, c, d, e, f) { rec(op, k, a, b, c, d, e, f); };
  }
  const useGrad = (gr, setOp) => {
    if (gr.frame !== frameNo) {
      if (gradN >= 16 || n + 12 + gr.stops.length * 2 > MAXE) return; const id = gradN++, c = gr.c;
      if (gr.kind === 0) rec(OP.gradLin, 5, id, c[0], c[1], c[2], c[3]); else rec(OP.gradRad, 7, id, c[0], c[1], c[2], c[3], c[4], c[5]);
      for (let i = 0; i < gr.stops.length; i += 2) { buf[n++] = OP.gradStop; buf[n++] = id; buf[n++] = gr.stops[i]; buf[n++] = gr.stops[i + 1]; }
      gr.frame = frameNo; gr.id = id;
    }
    rec(setOp, 1, gr.id);
  };
  for (const k of Object.keys(DEF)) {
    const cap = 'set' + k[0].toUpperCase() + k.slice(1), num = typeof DEF[k] === 'number', bool = typeof DEF[k] === 'boolean', paint = k === 'fillStyle' || k === 'strokeStyle';
    Object.defineProperty(Ctx.prototype, k, { enumerable: true, get() { return st[k]; }, set(v) {
      if (paint && v instanceof Grad) { if (st[k] === v && v.frame === frameNo) return; st[k] = v; useGrad(v, OP[k === 'fillStyle' ? 'setFillGrad' : 'setStrokeGrad']); return; }
      if (num) { v = +v; if (v - v !== 0) return; } else if (bool) v = v ? 1 : 0; else v = String(v).slice(0, 100);
      if (st[k] === v) return; if (n + 2 > MAXE) { over = true; return; } st[k] = v; buf[n++] = OP[cap]; buf[n++] = v;
    } });
  }
  const ctx = new Ctx();
  function beginFrame() { n = 0; over = false; frameNo++; gradN = 0; stack.length = 0; skipSave = 0; st = Object.assign({}, DEF); }

  // ---------- الواجهة ----------
  class EngineError extends Error { constructor(m) { super(m); this.name = 'EngineError'; } }
  let port = null, game = null, caps = new Set(), T0 = 0, T = 0, last = -1, dead = false, W = 0, H = 0, budget = 8, assets = {}, bootErr = null, memAt = 0;
  const hudSt = {}, tracks = new Map(), pend = new Map(); let seq = 0, lowCb = null, micCb = null;
  const send = m => apply(portPost, port, [m]);
  function fatal(e, load) { if (dead) return; dead = true; const m = (e && e.message) ? e.message : String(e); if (port) send({ t: 'err', msg: String(m).slice(0, 300), load: load ? 1 : 0, name: String((e && e.name) || '').slice(0, 30), mem: MEM.over }); }
  const need = (cap, fn) => { if (!caps.has(cap)) throw new EngineError(fn + ' تحتاج القدرة «' + cap + '» — أضفها إلى سطر // @capabilities في رأس الملف'); };
  const planned = fn => () => { throw new EngineError(fn + ' غير متاحة بعد في المحرك (مخطَّط لها). لا تستعملها الآن.'); };
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const trackApi = (kind, cap, fn, wrap) => (opts, cb) => {
    need(cap, fn); const id = 'k' + (++seq), h = { id, last: null, stop() { tracks.delete(id); send({ t: 'track.stop', id }); }, set(o) { send({ t: 'track.start', id, kind, opts: o }); } };
    tracks.set(id, { cb, h, wrap }); send({ t: 'track.start', id, kind, opts }); return h;
  };
  // ---------- عُدّة الواجهة api.ui ----------
  // مبنية على ctx نفسه (أوامر رسم عادية يتحقق منها المضيف كأي لعبة): لا رسائل جديدة ولا قدرة مطلوبة. الصوت يُصدَر فقط إن أعلنت اللعبة `audio`.
  // إحداثيات الدوال بالبكسل (CSS) كما في ctx؛ المقاسات الافتراضية نسبة من الشاشة. كل دالة ترسم داخل save/restore فلا تفسد حالة ctx عند اللعبة.
  let uiStep = null;
  function makeUi() {
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }, lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); // سطوع نسبي (WCAG): فوق ≈0.18 يكون النص الداكن أوضح من الأبيض
    const acc = /^#[0-9a-fA-F]{6}$/.test(SPEC.accent || '') ? SPEC.accent : '#7c6cff', ar = parseInt(acc.slice(1, 3), 16), ag = parseInt(acc.slice(3, 5), 16), ab = parseInt(acc.slice(5, 7), 16);
    const TH = Object.freeze({
      bg: '#0f0d1a', bg2: '#171429', surface: '#1f1b36', surfaceHi: '#2a2547', line: 'rgba(255,255,255,0.1)', fg: '#f4f1ff', mut: '#a9a3c4', brand: '#7c6cff', ok: '#3ddc97', warn: '#ffc145', bad: '#ff5d73',
      accent: acc, onAccent: lum(ar, ag, ab) > 0.179 ? '#0f0d1a' : '#ffffff', font: 'sans-serif',
      players: Object.freeze([['#4da3ff', 'circle', 'أزرق'], ['#ff6b8b', 'triangle', 'وردي'], ['#ffc145', 'square', 'أصفر'], ['#3ddc97', 'diamond', 'أخضر']].map(p => Object.freeze({ color: p[0], shape: p[1], name: p[2] })))
    });
    const OUT = 'rgba(15,13,26,0.75)', GLOW0 = 'rgba(' + ar + ',' + ag + ',' + ab + ',0.24)', GLOW1 = 'rgba(' + ar + ',' + ag + ',' + ab + ',0)', STEP = 0.7, GO = 0.6, POPN = 12, POPT = 0.95, PCOL = TH.players.map(p => p.color), EMPTY = {};
    const fonts = {}, F = (px, bold) => { px = Math.max(8, Math.round(px)); const k = bold ? px + 1000 : px; return fonts[k] || (fonts[k] = (bold ? 'bold ' : '') + px + 'px sans-serif'); };
    const cl01 = v => (v > 0 ? (v < 1 ? v : 1) : 0), clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const AD = '٠١٢٣٤٥٦٧٨٩', ncache = [];
    const anum = v => {
      v = Math.round(+v); if (!isFinite(v)) return '٠'; v = clamp(v, -1e15, 1e15); const small = v >= 0 && v < 1000; if (small && ncache[v]) return ncache[v];
      const s = String(Math.abs(v)); let o = v < 0 ? '‎−' : ''; for (let i = 0; i < s.length; i++) o += AD[s.charCodeAt(i) - 48]; if (small) ncache[v] = o; return o;
    };
    const un = () => Math.min(W, H) / 100, bigPx = () => Math.min(H * 0.08, W * 0.14);
    let tAnim = 0, still = false, gBg = null, gGlow = null, gW = -1, gH = -1;
    const wraps = new Map();
    function lines(c, s, px, bold, maxW) { // التفاف كلمات مخزَّن (النص نفسه لا يُعاد حسابه كل إطار)
      const key = s + '|' + Math.round(px) + '|' + Math.round(maxW) + (bold ? 'b' : ''); let r = wraps.get(key); if (r) return r;
      if (wraps.size > 40) wraps.clear(); r = []; c.font = F(px, bold);
      for (const para of String(s).split('\n')) {
        let cur = ''; for (const wd of para.split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (cur && c.measureText(t).width > maxW) { r.push(cur); cur = wd; } else cur = t; } r.push(cur);
      }
      wraps.set(key, r); return r;
    }
    const fit = (c, s, px, bold, maxW) => { c.font = F(px, bold); const w = c.measureText(s).width; return w > maxW ? Math.max(10, px * maxW / w) : px; };
    function txt(c, s, x, y, px, col, bold, align, outline) {
      c.font = F(px, bold); c.textAlign = align || 'center'; c.textBaseline = 'middle';
      if (outline) { c.lineJoin = 'round'; c.lineWidth = Math.max(2, px * 0.14); c.strokeStyle = OUT; c.strokeText(s, x, y); }
      c.fillStyle = col; c.fillText(s, x, y);
    }
    const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); };
    function shapePath(c, i, x, y, r) {
      c.beginPath();
      if (i === 0) c.arc(x, y, r, 0, 6.2832);
      else if (i === 1) { c.moveTo(x, y - r * 1.1); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath(); }
      else if (i === 2) c.roundRect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, r * 0.25);
      else { c.moveTo(x, y - r * 1.15); c.lineTo(x + r, y); c.lineTo(x, y + r * 1.15); c.lineTo(x - r, y); c.closePath(); }
    }
    const pidx = i => (((i | 0) % 4) + 4) % 4;
    const snd = (f, ms, vol, type) => { if (caps.has('audio')) send({ t: 'audio.tone', f, ms, vol, type: type || 'sine', slide: 0 }); };
    function ensureGrad(c) {
      if (gW === W && gH === H && gBg) return; gW = W; gH = H;
      gBg = c.createLinearGradient(0, 0, 0, H); gBg.addColorStop(0, TH.bg2); gBg.addColorStop(1, TH.bg);
      gGlow = c.createRadialGradient(W / 2, H * 0.12, 0, W / 2, H * 0.12, Math.max(W, H) * 0.75); gGlow.addColorStop(0, GLOW0); gGlow.addColorStop(1, GLOW1);
    }
    function cta(c, s, cx, cy) { // زرّ دعوة نابض (للبدء)
      const u = un(), px = clamp(H * 0.03, 17, 26), h = Math.max(52, u * 13); c.font = F(px, true); const w = Math.min(W * 0.9, c.measureText(s).width + u * 14);
      c.globalAlpha = still ? 1 : 0.82 + 0.18 * Math.sin(tAnim * 4); c.fillStyle = TH.accent; rr(c, cx - w / 2, cy - h / 2, w, h, h / 2); c.fill(); c.globalAlpha = 1; txt(c, s, cx, cy, px, TH.onAccent, true);
    }
    function pill(c, cx, cy, w, h, fill, line) { rr(c, cx - w / 2, cy - h / 2, w, h, h / 2); c.fillStyle = fill; c.fill(); if (line) { c.lineWidth = 2; c.strokeStyle = line; c.stroke(); } }
    // ----- حالة العدّ والنقاط والوميض -----
    let cdState = 0, cdLeft = 0, cdT = 0, cdDone = null, flT = 0, flD = 0.25, flCol = TH.ok, popI = 0;
    const pTxt = new Array(POPN).fill(''), pX = new Float64Array(POPN), pY = new Float64Array(POPN), pAge = new Float64Array(POPN).fill(-1), pCol = new Array(POPN).fill(TH.fg), pLtr = new Array(POPN).fill(false);
    function step(dt) {
      if (!still) tAnim += dt;
      if (flT > 0) flT -= dt;
      for (let i = 0; i < POPN; i++) if (pAge[i] >= 0) { pAge[i] += dt; if (pAge[i] > POPT) pAge[i] = -1; }
      if (cdState === 1) {
        cdT += dt;
        if (cdT >= STEP) { cdT -= STEP; cdLeft--; if (cdLeft <= 0) { cdState = 2; cdT = 0; snd(880, 260, 0.25, 'triangle'); const cb = cdDone; cdDone = null; if (cb) cb(); } else snd(520, 90, 0.2, 'triangle'); }
      } else if (cdState === 2) { cdT += dt; if (cdT >= GO) cdState = 0; }
    }
    uiStep = step;
    const ui = {
      theme: TH,
      safe: Object.freeze({ top: 76, bottom: 64 }), // عناصر المضيف: HUD وشارة الكاميرا أعلى الشاشة (≈76px) وزرّ «خروج» أسفل اليمين (≈64px): لا تضع فيهما محتوى مهمًا
      num: anum,
      hit(r, x, y) { const px = x * W, py = y * H, sx = Math.max(0, (48 - r.w) / 2), sy = Math.max(0, (48 - r.h) / 2); return px >= r.x - sx && px <= r.x + r.w + sx && py >= r.y - sy && py <= r.y + r.h + sy; },
      row(rects, n, y, h, gap, maxW) { // n مستطيلات متجاورة (اليسار ← اليمين) مركزها وسط الشاشة، مصفوفة تُعاد استعمالها
        rects = rects || []; gap = gap == null ? un() * 2.5 : gap; const tot = Math.min(W - un() * 6, maxW || 560), w = (tot - gap * (n - 1)) / n, x0 = (W - tot) / 2;
        for (let i = 0; i < n; i++) { const r = rects[i] || (rects[i] = { x: 0, y: 0, w: 0, h: 0 }); r.x = x0 + i * (w + gap); r.y = y; r.w = w; r.h = h; } rects.length = n; return rects;
      },
      background(c, a) {
        c.save();
        if (a == null || a >= 1) { ensureGrad(c); c.fillStyle = gBg; c.fillRect(0, 0, W, H); c.fillStyle = gGlow; c.fillRect(0, 0, W, H); }
        else { c.globalAlpha = cl01(a); c.fillStyle = TH.bg; c.fillRect(0, 0, W, H); }
        c.restore();
      },
      text(c, s, x, y, px, color, bold, align) { c.save(); c.direction = 'rtl'; txt(c, s, x, y, px, color || TH.fg, bold, align); c.restore(); },
      title(c, text, sub, hint) {
        c.save(); c.direction = 'rtl'; c.globalAlpha = 0.9; c.fillStyle = TH.bg; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
        const u = un(), cx = W / 2, ty = H * 0.34, px = fit(c, text, bigPx(), true, W * 0.88); txt(c, text, cx, ty, px, TH.fg, true);
        const bw = Math.min(W * 0.2, 110), bh = Math.max(4, u), by = ty + px * 0.8; rr(c, cx - bw / 2, by, bw, bh, bh / 2); c.fillStyle = TH.accent; c.fill();
        if (sub) { const sp = clamp(Math.min(H * 0.03, W * 0.045), 14, 24), ls = lines(c, sub, sp, false, W * 0.84); let y = by + bh + u * 5; for (let i = 0; i < ls.length && i < 5; i++, y += sp * 1.6) txt(c, ls[i], cx, y, sp, TH.mut, false); }
        if (hint !== '') cta(c, hint == null ? 'المس الشاشة للبدء' : hint, cx, H * 0.8);
        c.restore();
      },
      bigText(c, text, o) {
        o = o || EMPTY; c.save(); c.direction = 'rtl'; if (o.alpha != null) c.globalAlpha = cl01(o.alpha);
        const y = o.y == null ? H * 0.3 : o.y, px = fit(c, text, o.size || bigPx(), true, W * 0.9), k = o.scale || 1;
        if (k !== 1) { c.translate(W / 2, y); c.scale(k, k); txt(c, text, 0, 0, px, o.color || TH.fg, true, 'center', o.outline !== false); } else txt(c, text, W / 2, y, px, o.color || TH.fg, true, 'center', o.outline !== false);
        c.restore();
      },
      meter(c, v, o) { // يمتلئ من اليمين (اتجاه العربية)؛ الهدف: عبور الخط = نجاح (أخضر). limit:true: عبور الخط = تجاوز (أحمر)
        o = o || EMPTY; const u = un(), w = o.w || Math.min(W * 0.72, 480), h = o.h || Math.max(14, u * 3.2), x = o.x == null ? (W - w) / 2 : o.x, y = o.y == null ? H - Math.max(88, H * 0.11) : o.y, mx = o.max || 1, f = cl01(v / mx), th = o.threshold;
        c.save(); c.direction = 'rtl';
        rr(c, x, y, w, h, h / 2); c.fillStyle = 'rgba(15,13,26,0.78)'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = TH.line; c.stroke();
        if (f > 0) { const fw = Math.max(h, f * w), col = o.color || (th == null ? TH.accent : o.limit ? (v >= th ? TH.bad : TH.ok) : (v >= th ? TH.ok : TH.warn)); rr(c, x + w - fw, y, fw, h, h / 2); c.fillStyle = col; c.fill(); }
        if (th != null) { const tx = x + w - cl01(th / mx) * w; rr(c, tx - 1.5, y - h * 0.3, 3, h * 1.6, 1.5); c.fillStyle = TH.fg; c.fill(); }
        if (o.label) txt(c, o.label, x + w / 2, y - h * 0.95, clamp(h * 1.05, 13, 20), TH.fg, false, 'center', true);
        c.restore();
      },
      progress(c, t01, o) { // شريط رفيع يمتلئ من اليمين؛ افتراضيًا في أعلى الشاشة
        o = o || EMPTY; const h = o.h || Math.max(5, un() * 1.1), y = o.y == null ? 0 : o.y, fw = cl01(t01) * W;
        c.save(); c.globalAlpha = 0.22; c.fillStyle = TH.fg; c.fillRect(0, y, W, h); c.globalAlpha = 1;
        if (fw > 0) { c.fillStyle = o.color || TH.accent; c.fillRect(W - fw, y, fw, h); } c.restore();
      },
      shape(c, i, x, y, r) { c.save(); i = pidx(i); shapePath(c, i, x, y, r); c.fillStyle = PCOL[i]; c.fill(); c.restore(); },
      playerChip(c, i, x, y, o) { // حبّة لاعب: شكله ولونه الثابتان + اسم + نقاط؛ active تبرز حبّة من يلعب الآن
        o = o || EMPTY; i = pidx(i); const h = o.size || Math.max(40, un() * 9.5), px = h * 0.42, label = o.label == null ? anum(i + 1) : String(o.label), sc = o.score == null ? '' : (typeof o.score === 'number' ? anum(o.score) : String(o.score));
        c.save(); c.direction = 'rtl'; c.font = F(px, false); const lw = c.measureText(label).width; c.font = F(px, true); const sw = sc ? c.measureText(sc).width + h * 0.3 : 0, w = h * 1.15 + lw + sw + h * 0.35;
        pill(c, x, y, w, h, o.active ? TH.surfaceHi : 'rgba(31,27,54,0.92)', o.active ? PCOL[i] : TH.line);
        const sx = x + w / 2 - h * 0.55; shapePath(c, i, sx, y, h * 0.27); c.fillStyle = PCOL[i]; c.fill();
        txt(c, label, sx - h * 0.45, y, px, TH.fg, false, 'right'); if (sc) txt(c, sc, x - w / 2 + h * 0.4, y, px, PCOL[i], true, 'left');
        c.restore();
      },
      button(c, r, label, o) { // o: {primary, on, color}. primary = لون اللعبة، on = مختار
        o = o || EMPTY; const rad = Math.min(r.h / 2, 18); c.save(); c.direction = 'rtl'; rr(c, r.x, r.y, r.w, r.h, rad);
        c.fillStyle = o.color || (o.primary ? TH.accent : o.on ? TH.surfaceHi : TH.surface); c.fill();
        if (!o.primary) { c.lineWidth = o.on ? 3 : 1.5; c.strokeStyle = o.on ? TH.accent : TH.line; c.stroke(); }
        txt(c, label, r.x + r.w / 2, r.y + r.h / 2, fit(c, label, clamp(r.h * 0.42, 14, 26), true, r.w * 0.88), o.primary || o.color ? TH.onAccent : TH.fg, true); c.restore();
      },
      results(c, o) { // لوح نتيجة داخل اللعبة (اختياري): {title, score, label, lines:[], players:[{label,score}], winner}
        o = o || EMPTY; const u = un(), pw = Math.min(W * 0.88, 520), ls = o.lines || null, pl = o.players || null, ch = Math.max(40, u * 9.5);
        const tp = clamp(H * 0.034, 18, 28), sp = clamp(H * 0.095, 40, 84), lp = clamp(H * 0.026, 14, 20);
        const ph = u * 6 + tp * 1.6 + (o.score != null ? sp * 1.25 + (o.label ? lp * 1.8 : 0) : 0) + (ls ? Math.min(ls.length, 4) * lp * 1.7 : 0) + (pl ? Math.min(pl.length, 4) * (ch + u * 1.6) : 0) + u * 3, px0 = (W - pw) / 2, py0 = Math.max(u * 3, (H - ph) / 2);
        c.save(); c.direction = 'rtl'; c.globalAlpha = 0.86; c.fillStyle = TH.bg; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
        rr(c, px0, py0, pw, ph, 24); c.fillStyle = TH.surface; c.fill(); c.lineWidth = 3; c.strokeStyle = TH.accent; c.stroke();
        let y = py0 + u * 5 + tp * 0.6; txt(c, o.title || 'انتهت الجولة', W / 2, y, tp, TH.fg, true); y += tp * 1.0;
        if (o.score != null) { y += sp * 0.62; txt(c, typeof o.score === 'number' ? anum(o.score) : String(o.score), W / 2, y, sp, TH.accent, true); y += sp * 0.62; if (o.label) { y += lp * 0.4; txt(c, o.label, W / 2, y, lp, TH.mut, false); y += lp * 1.4; } }
        if (ls) for (let i = 0; i < ls.length && i < 4; i++) { y += lp * 1.7; txt(c, ls[i], W / 2, y - lp * 0.5, lp, TH.mut, false); }
        if (pl) for (let i = 0; i < pl.length && i < 4; i++) { y += ch * 0.5 + u * 0.8; ui.playerChip(c, i, W / 2, y + u * 0.8, { label: pl[i].label, score: pl[i].score, active: o.winner === i, size: ch }); y += ch * 0.5 + u * 0.8; }
        c.restore();
      },
      countdown(n, onDone) { cdLeft = clamp(Math.round(+n) || 3, 1, 9); cdT = 0; cdState = 1; cdDone = typeof onDone === 'function' ? onDone : null; snd(520, 90, 0.2, 'triangle'); },
      pop(v, x, y, color) { // نقاط تطفو؛ v رقم (+١ / −١ بلونَي النجاح والخطأ) أو نص
        const i = popI; popI = (popI + 1) % POPN; const isN = typeof v === 'number';
        pTxt[i] = isN ? (v >= 0 ? '+' : '') + anum(v) : String(v).slice(0, 30); pLtr[i] = isN; pX[i] = x; pY[i] = y; pAge[i] = 0; pCol[i] = color || (isN && v < 0 ? TH.bad : TH.ok);
      },
      flash(color, dur) { flCol = color || TH.ok; flD = dur > 0 ? dur : 0.25; flT = flD; },
      cancel() { cdState = 0; cdDone = null; flT = 0; for (let i = 0; i < POPN; i++) pAge[i] = -1; },
      draw(c) { // مرة واحدة في آخر render: وميض + عدّ تنازلي + نقاط طافية
        if (flT > 0) { c.save(); c.globalAlpha = 0.38 * cl01(flT / flD); c.fillStyle = flCol; c.fillRect(0, 0, W, H); c.restore(); }
        if (cdState) {
          c.save(); c.direction = 'rtl'; const cx = W / 2, cy = H * 0.45;
          if (cdState === 1) {
            const R = Math.min(W, H) * 0.21, k = still ? 1 : 1 + 0.35 * Math.pow(Math.max(0, 1 - cdT / 0.22), 2);
            c.globalAlpha = 0.5; c.fillStyle = TH.bg; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
            c.lineWidth = Math.max(6, R * 0.09); c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,0.14)'; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke();
            c.strokeStyle = TH.accent; c.beginPath(); c.arc(cx, cy, R, -1.5708, -1.5708 + 6.2832 * (1 - cdT / STEP)); c.stroke();
            txt(c, anum(cdLeft), cx, cy, R * 1.45 * k, TH.fg, true, 'center', true);
          } else {
            const g = cdT / GO, k = still ? 1 : 1 + 0.3 * Math.pow(Math.max(0, 1 - cdT / 0.2), 2); c.globalAlpha = g < 0.55 ? 1 : cl01(1 - (g - 0.55) / 0.45);
            txt(c, 'انطلق!', cx, cy, fit(c, 'انطلق!', bigPx() * 1.5 * k, true, W * 0.9), TH.accent, true, 'center', true);
          }
          c.restore();
        }
        for (let i = 0; i < POPN; i++) {
          if (pAge[i] < 0) continue; const k = pAge[i] / POPT, e = 1 - (1 - k) * (1 - k), px = Math.max(20, Math.min(H * 0.055, W * 0.1)) * (still ? 1 : 1 + 0.35 * Math.max(0, 1 - k / 0.18));
          c.save(); c.direction = pLtr[i] ? 'ltr' : 'rtl'; c.globalAlpha = k < 0.55 ? 1 : cl01(1 - (k - 0.55) / 0.45); txt(c, pTxt[i], pX[i], pY[i] - e * H * 0.1, px, pCol[i], true, 'center', true); c.restore();
        }
      }
    };
    Object.defineProperties(ui, {
      still: { get: () => still, set: v => { still = !!v; }, enumerable: true },
      counting: { get: () => cdState === 1, enumerable: true },
      t: { get: () => tAnim, enumerable: true },
      unit: { get: un, enumerable: true }
    });
    return Object.freeze(ui);
  }
  function buildApi() {
    const ask =(t, extra) => new Promise(res => { const id = 'q' + (++seq); pend.set(id, res); send(Object.assign({ t, id }, extra)); });
    return {
      version: SPEC.version, capabilities: Array.from(caps), has: c => caps.has(c),
      time: { now: () => T }, ui: makeUi(),
      view: { size: () => ({ w: W, h: H }), showCamera(on) { need('camera.view', 'api.view.showCamera'); send({ t: 'view.camera', on: !!on }); } },
      track: {
        color: trackApi('color', 'camera.color', 'api.track.color'), motion: trackApi('motion', 'camera.motion', 'api.track.motion'),
        lanes(opts, cb) { need('camera.lanes', 'api.track.lanes'); const c = opts && opts.count; if (!(c >= 2 && c <= 4)) throw new EngineError('api.track.lanes: count يجب أن يكون من 2 إلى 4'); return trackApi('lanes', 'camera.lanes', 'api.track.lanes')(opts, cb); },
        colorPerPlayer(list, cb) { need('camera.playercolors', 'api.track.colorPerPlayer'); if (!Array.isArray(list) || list.length < 1 || list.length > 4) throw new EngineError('api.track.colorPerPlayer: مصفوفة من 1 إلى 4 لاعبين [{id,color}]');
          return trackApi('players', 'camera.playercolors', 'api.track.colorPerPlayer', d => { const by = {}; for (const p of d.players) by[p.id] = p; d.byId = by; return d; })({ list }, cb); }
      },
      sensors: { motion(cb) { return trackApi('devmotion', 'motion.device', 'api.sensors.motion')({}, cb); } }, // عيّنات {x,y,mag,shake} ≤30Hz؛ .stop() يزيل المستمع في المضيف
      camera: { lowres(cb, hz) { need('camera.lowres', 'api.camera.lowres'); lowCb = cb; send({ t: 'lowres.start', hz: num(hz, 5) }); }, stopLowres() { lowCb = null; send({ t: 'lowres.stop' }); } },
      mic: { listen(o, cb) { need('audio.mic', 'api.mic.listen'); o = o || {}; if (typeof cb !== 'function') throw new EngineError('api.mic.listen(opts, cb): cb دالة'); micCb = cb;
        send({ t: 'mic.start', hz: num(o.hz, 30), thr: num(o.threshold, 0.5), pitch: !!o.pitch }); return { stop() { micCb = null; send({ t: 'mic.stop' }); } }; } },
      calibrate: { pickColor() { need('camera.calibrate', 'api.calibrate.pickColor'); return ask('calib'); } },
      assets: { image(name) { const a = assets[name]; if (!a) throw new EngineError('الأصل «' + String(name).slice(0, 30) + '» غير معلن في // @assets'); return a; }, names: () => Object.keys(assets) },
      audio: {
        beep(freq, ms, vol) { need('audio', 'api.audio.beep'); send({ t: 'audio.tone', f: num(freq, 880), ms: num(ms, 120), vol: num(vol, .3), type: 'square' }); },
        tone(o) { need('audio', 'api.audio.tone'); o = o || {}; send({ t: 'audio.tone', f: num(o.freq, 440), ms: num(o.ms, 200), vol: num(o.vol, .3), type: String(o.type || 'sine'), slide: num(o.slide, 0) }); },
        melody(notes) { need('audio', 'api.audio.melody'); send({ t: 'audio.melody', notes: (notes || []).slice(0, 16).map(x => ({ f: num(x.freq, 440), ms: num(x.ms, 150) })) }); }
      },
      hud: { set(o) { need('hud', 'api.hud.set'); o = o || {}; const out = { t: 'hud', score: null, time: null, title: null }; let ch = false;
        for (const k of ['score', 'time', 'title']) if (o[k] != null) { const v = String(o[k]).slice(0, k === 'title' ? 40 : 24); if (hudSt[k] !== v) { hudSt[k] = v; out[k] = v; ch = true; } }
        if (ch) send(out); } },
      haptic(ms) { need('haptic', 'api.haptic'); send({ t: 'haptic', ms: num(ms, 30) }); },
      players: {
        local(o) { need('players.local', 'api.players.local'); const names = (SPEC.players || (o && o.names) || ['١', '٢']).slice(0, 8).map(String); // داخل سلسلة: أسماء السلسلة هي الحاكمة
          return { names, index: 0, scores: names.map(() => 0), get current() { return this.names[this.index]; }, next() { this.index = (this.index + 1) % this.names.length; return this.current; }, add(k) { this.scores[this.index] += k; } }; },
        network: planned('api.players.network')
      },
      qr: { show: planned('api.qr.show') }, hand: { start: planned('api.hand') }, pose: { start: planned('api.pose') },
      end(o) { o = o || {}; const arr = a => Array.isArray(a) ? a.slice(0, 8).map(x => num(x, 0)) : undefined; send({ t: 'end', scores: arr(o.scores), ranks: arr(o.ranks), score: num(o.score, 0), text: o.text == null ? '' : String(o.text).slice(0, SPEC.endmax || 300) }); }
    };
  }
  const guard = f => { try { f(); } catch (x) { fatal(x); } };
  function pointers(p) {
    for (let i = 0; i + 2 < p.length; i += 3) {
      const k = p[i], x = p[i + 1], y = p[i + 2];
      if (k === 0) { if (game.onTap) game.onTap(x, y); if (game.onPointer) game.onPointer('down', x, y); } else if (k === 1) { if (game.onPointer) game.onPointer('move', x, y); } else if (game.onPointer) game.onPointer('up', x, y);
    }
  }
  function tick(m) {
    if (dead) { send({ t: 'frame', b: [], ms: 0 }); return; }
    if (m.w > 0 && (m.w !== W || m.h !== H)) { W = m.w; H = m.h; ctx.canvas.width = W; ctx.canvas.height = H; if (game.onResize && last >= 0) guard(() => game.onResize(W, H)); }
    const dt = last < 0 ? 0 : Math.min(.1, Math.max(0, (m.ts - last) / 1000)); last = m.ts; T += dt;
    const a = now(); beginFrame();
    guard(() => { if (m.p) pointers(m.p); if (uiStep) uiStep(dt); if (game.update) game.update(dt, T); if (game.render && !dead) game.render(ctx, W, H); });
    const ms = now() - a; let mem = 0; if (MEM.over || a - memAt > 500) { memAt = a; mem = Math.max(MEM.over, MEM.live, performance.memory ? performance.memory.usedJSHeapSize : 0); }
    send({ t: 'frame', b: buf.slice(0, n), ms, ov: over ? 1 : 0, mem });
  }
  G.defineGame = g => { if (game) throw new EngineError('defineGame استُدعيت مرتين'); if (!g || typeof g !== 'object') throw new EngineError('defineGame تتوقع كائنًا فيه init/update/render'); game = g; };
  addL('error', e => { if (e.preventDefault) e.preventDefault(); if (port) fatal(e.error || e.message); else bootErr = e.error || e.message; });
  addL('unhandledrejection', e => { if (e.preventDefault) e.preventDefault(); fatal(e.reason); });
  const onHello = e => {
    const d = e.data; if (!d || !d.hello || !e.ports[0] || port) return; // أول رسالة hello فقط
    e.stopImmediatePropagation(); rmL('message', onHello); port = e.ports[0]; caps = new Set(d.caps); budget = d.budget || 8; W = d.w; H = d.h; ctx.canvas.width = W; ctx.canvas.height = H; assets = d.assets || {};
    port.onmessage = ev => {
      const m = ev.data; if (!m || dead) return;
      if (m.t === 'tick') tick(m);
      else if (m.t === 'track') { const k = tracks.get(m.id); if (k) { const dd = k.wrap ? k.wrap(m.d) : m.d; k.h.last = dd; if (k.cb) guard(() => k.cb(dd)); } }
      else if (m.t === 'err2') fatal(new EngineError(String(m.msg)));
      else if (m.t === 'mic') { if (micCb) guard(() => micCb(m.d)); }
      else if (m.t === 'lowres') { if (lowCb) guard(() => lowCb(m.d)); }
      else if (m.t === 'ans') { const r = pend.get(m.id); if (r) { pend.delete(m.id); r(m.v); } }
    };
    try { loadScript(d.game); } catch (x) { return fatal(x, true); } // كود اللعبة الأعلى مستوى يعمل هنا، بعد اكتمال التعطيل
    if (!game) return fatal('الملف لم يستدعِ defineGame({...})');
    T0 = now(); try { if (game.init) game.init(buildApi()); } catch (x) { return fatal(x); }
    send({ t: 'ready' });
  };
  addL('message', onHello);
})();
