// @title سباق الحل
// @desc كلٌّ يحلّ مسائل الحساب على جواله، وكل جواب صحيح يقدّم شكله خطوة على الحلبة. أول من يصل خط النهاية يفوز. كل لاعب يختار عمره فتأتيه مسائل تناسبه: الصغار يعدّون التفاح، والكبار يضربون ويقسمون.
// @howto حلّ المسألة في جوالك لتتقدّم
// @howto-act tap
// @accent #ffc145
// @engine 0.6
// @capabilities players.pads audio hud
// @pads 1-8 free 1v1 2v2 teams
// @series no
// @players 1-8
// @minutes 3
// @age 4
// @play pads
// @style versus teams
// لكل لاعب مستوى بعمره (يختاره من جواله): 4-6 جمع حتى 10 بأشياء تُعدّ (3 أزرار)، 7-9 جمع وطرح وضرب حتى 100، 10+ العمليات الأربع (القسمة بلا كسور).
// المسائل على الجوال (api.pads.choices لكل جوال وحده)، والتلفاز يعرض الحلبة. الخطأ تأخير قصير لا خصم.

let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
let GOAL = 10, TMAX = 180, GRACE = 20, WAIT = 1.2;
const AGE = 900, AGE_SPEC = { prompt: 'كم عمرك؟', id: AGE, items: [{ text: '4-6', color: '#3ddc97' }, { text: '7-9', color: '#4da3ff' }, { text: '10+', color: '#a37bff' }] };
const LVL = ['4-6', '7-9', '10 فأكثر'], THINGS = ['🍎', '⭐', '🎈', '🍊', '🌸', '⚽'];
let api, ui, state = 'ready', W = 1280, H = 720, readyT = 0, ended = false, t = 0, firstT = -1, firstName = '', sid = 1000, order = 0, tokens = 20;
const pl = []; // لكل مقعد: {lvl, steps, prob, sid, wait, fin, ok, bad, glow, x}
const queue = []; // مقاعد تنتظر مسألة جديدة (حدّ المحرك 30 شاشة/ث، نرسل ≤20/ث)
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const P = i => pl[i] || (pl[i] = { lvl: -1, steps: 0, prob: null, sid: 0, wait: 0, fin: 0, ok: 0, bad: 0, glow: 0, shake: 0, x: 0, y: 0 });

function gen(lvl) { // مسألة {prompt, items, ans}
  let a, b, v, op, txt;
  if (lvl === 0) { // جمع حتى 10 بأشياء تُعدّ
    a = rnd(1, by3(3, 5, 5)); b = rnd(1, Math.min(5, 10 - a)); v = a + b; const o = THINGS[rnd(0, THINGS.length - 1)];
    txt = o.repeat(a) + ' + ' + o.repeat(b) + ' = ؟';
  } else {
    const ops = lvl === 1 ? ['+', '−', '×'] : ['+', '−', '×', '÷']; op = ops[rnd(0, ops.length - 1)];
    const big = lvl === 1 ? by3(30, 100, 100) : by3(100, 500, 999), tb = lvl === 1 ? by3(5, 10, 10) : by3(10, 12, 15);
    if (op === '+') { a = rnd(2, Math.floor(big * 0.7)); b = rnd(1, big - a); v = a + b; }
    else if (op === '−') { a = rnd(5, big); b = rnd(1, a); v = a - b; }
    else if (op === '×') { a = rnd(2, tb); b = rnd(2, tb); v = a * b; }
    else { b = rnd(2, tb); v = rnd(2, tb); a = b * v; } // قسمة بلا كسور: a = b × v
    txt = a + ' ' + op + ' ' + b + ' = ؟';
  }
  const n = lvl === 0 ? 3 : 4, set = [v], cand = [v + 1, v - 1, v + 2, v - 2, v + 10, v - 10, v + 3, v + 5];
  if (op === '×') cand.unshift(v + a, v - a, v + b); if (op === '÷') cand.unshift(v + 1, b, v * 2);
  for (const c of cand.sort(() => Math.random() - 0.5)) if (set.length < n && c >= 0 && set.indexOf(c) < 0 && (lvl > 0 || c <= 10)) set.push(c);
  while (set.length < n) { const c = v + set.length * 3; if (set.indexOf(c) < 0) set.push(c); }
  set.sort(() => Math.random() - 0.5);
  return { prompt: txt, ans: set.indexOf(v), v, items: set.map((x, k) => ({ text: String(x), color: ui.theme.players[k].color })) }; // ألوان بلا أشكال: الرقم وحده هو الجواب
}
function ask(i) { const r = P(i); r.prob = gen(r.lvl); r.sid = ++sid; if (queue.indexOf(i) < 0) queue.push(i); }
function teamScore(tm) { let s = 0, n = 0; for (const p of api.pads.list) if (api.teams.of(p.index) === tm) { s += P(p.index).steps; n++; } return n ? Math.round(s / n * 10) / 10 : 0; }
function begin() {
  state = 'count'; t = 0; firstT = -1; order = 0;
  for (const p of api.pads.list) { const r = P(p.index); r.steps = 0; r.fin = 0; r.ok = 0; r.bad = 0; r.x = 0; if (r.lvl < 0 && p.connected) r.lvl = 1; }
  api.pads.choices(-1, null); api.pads.controls({ stick: false, a: '', b: '' }); api.pads.say(-1, 'حلّ المسألة لتتقدّم!');
  ui.countdown(3, () => { state = 'play'; for (const p of api.pads.list) if (p.connected) ask(p.index); });
}
function finish() {
  state = 'over'; ended = true; const L = api.pads.list, scores = [], ranks = [];
  const ord = L.slice().sort((a, b) => { const x = P(a.index), y = P(b.index); return (x.fin ? x.fin : 99) - (y.fin ? y.fin : 99) || y.steps - x.steps; });
  ord.forEach((p, k) => { const r = P(p.index), prev = ord[k - 1] && P(ord[k - 1].index); ranks[p.index] = prev && !r.fin && !prev.fin && prev.steps === r.steps ? ranks[ord[k - 1].index] : k + 1; });
  for (let i = 0; i < 8; i++) { scores[i] = pl[i] ? pl[i].steps : 0; if (ranks[i] == null) ranks[i] = 8; }
  const ts = api.teams.on ? [teamScore(0), teamScore(1)] : undefined;
  const text = ts ? (ts[0] === ts[1] ? 'تعادل الفريقان!' : 'فاز ' + api.teams.names[ts[0] > ts[1] ? 0 : 1]) : ord.length ? (P(ord[0].index).fin ? 'وصل أولًا: ' : 'الأبعد: ') + ord[0].name : 'انتهى السباق';
  api.pads.choices(-1, null); api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 120 }, { freq: 1046, ms: 260 }]);
  api.end({ score: ord.length ? P(ord[0].index).steps : 0, scores, ranks, teamScores: ts, text });
}
function flag(c, x, y0, y1, sq) { for (let y = y0, r = 0; y < y1; y += sq, r++) for (let q = 0; q < 2; q++) { c.fillStyle = (q + r) % 2 ? '#ffffff' : '#141024'; c.fillRect(x + q * sq, y, sq, Math.min(sq, y1 - y)); } }

defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1;
    GOAL = Math.max(5, Math.round(10 * RS)); TMAX = Math.round(180 * RS); WAIT = by3(0.6, 1.2, 2); const s = api.view.size(); W = s.w; H = s.h;
    api.pads.onChoice(e => {
      const r = P(e.index);
      if (e.id === AGE) { if (r.lvl < 0) { r.lvl = e.choice; api.audio.beep(660 + e.index * 60, 70, 0.2); api.pads.say(e.index, '✓ جاهز'); if (state === 'play') ask(e.index); } return; }
      if (state !== 'play' || e.id !== r.sid || r.fin || !r.prob) return;
      r.sid = 0; const x = r.x, y = r.y;
      if (e.choice === r.prob.ans) {
        r.steps++; r.ok++; r.glow = 0.5; api.pads.vibrate(e.index, 50); api.audio.beep(700 + r.steps * 30, 60, 0.16); ui.pop(1, x, y - 30, ui.theme.ok);
        if (r.steps >= GOAL) { r.fin = ++order; api.pads.say(e.index, order === 1 ? '🏁 وصلت أولًا!' : '🏁 وصلت!'); api.audio.melody([{ freq: 784, ms: 90 }, { freq: 1046, ms: 200 }]);
          if (firstT < 0) { firstT = t; firstName = api.pads.list.find(p => p.index === e.index).name; for (const p of api.pads.list) if (!P(p.index).fin) api.pads.say(p.index, 'أسرِع! بقي ' + ui.num(GRACE) + ' ثانية'); } }
        else { api.pads.say(e.index, '✓ صح!'); ask(e.index); }
      } else { r.bad++; r.wait = WAIT; r.shake = 0.4; api.pads.vibrate(e.index, 150); api.audio.tone({ freq: 220, ms: 140, vol: 0.1, slide: -60 }); api.pads.say(e.index, '✗ الجواب ' + r.prob.v); }
    });
    api.pads.onJoin(p => { const r = P(p.index); if (r.lvl < 0) api.pads.choices(p.index, AGE_SPEC); else if (state === 'play' && !r.fin) ask(p.index); });
    api.pads.choices(-1, AGE_SPEC); api.pads.say(-1, 'اختر عمرك لتبدأ'); api.hud.set({ title: 'سباق الحل' });
  },
  onResize(w, h) { W = w; H = h; },
  update(dt) {
    const L = api.pads.list; tokens = Math.min(20, tokens + dt * 20);
    while (queue.length && tokens >= 1) { const i = queue.shift(), r = P(i); if (!r.prob || r.fin) continue; tokens--; api.pads.choices(i, { prompt: r.prob.prompt, items: r.prob.items, id: r.sid }); }
    for (const p of L) { const r = P(p.index); r.glow = Math.max(0, r.glow - dt); r.shake = Math.max(0, r.shake - dt); }
    if (state === 'ready') {
      let on = 0, rd = 0; for (const p of L) if (p.connected) { on++; if (P(p.index).lvl >= 0) rd++; }
      readyT = rd ? readyT + dt : 0; if (on && (rd === on || readyT > 15)) begin(); return;
    }
    if (state !== 'play') return;
    t += dt;
    for (const p of L) { const r = P(p.index); if (r.wait > 0 && (r.wait -= dt) <= 0 && !r.fin) ask(p.index); }
    let left = 0; for (const p of L) if (p.connected && !P(p.index).fin) left++;
    api.hud.set({ time: firstT >= 0 ? ui.num(Math.max(0, Math.ceil(GRACE - (t - firstT)))) : ui.num(Math.max(0, Math.ceil(TMAX - t))), score: api.teams.on ? ui.num(teamScore(0)) + ' : ' + ui.num(teamScore(1)) : '' });
    if (!ended && (left === 0 && L.length || (firstT >= 0 && t - firstT >= GRACE) || t >= TMAX)) finish();
  },
  render(c, w, h) {
    W = w; H = h; const th = ui.theme, L = api.pads.list, cx = w / 2, u = Math.min(w, h) / 100, T = ui.t;
    ui.background(c);
    if (state === 'ready') {
      ui.bigText(c, 'سباق الحل', { y: h * 0.2 });
      ui.text(c, 'اختر عمرك على جوالك، ثم حلّ المسائل لتتقدّم على الحلبة', cx, h * 0.3, Math.max(16, Math.min(28, w * 0.02)), th.mut);
      const n = Math.max(1, L.length), sz = Math.min(150, w * 0.8 / n);
      L.forEach((p, k) => { const r = P(p.index), x = cx + (k - (n - 1) / 2) * sz * 1.15, y = h * 0.55; c.globalAlpha = p.connected ? 1 : 0.35;
        ui.shape(c, p.colorIndex, x, y, sz * 0.3); ui.text(c, p.name, x, y + sz * 0.5, Math.max(15, sz * 0.15), th.fg, true);
        ui.text(c, !p.connected ? 'انقطع' : r.lvl < 0 ? '…' : '✓ ' + LVL[r.lvl], x, y + sz * 0.7, Math.max(13, sz * 0.14), r.lvl < 0 ? th.mut : th.ok, true); c.globalAlpha = 1; });
      if (!L.length) ui.text(c, 'بانتظار الجوالات…', cx, h * 0.55, 24, th.mut);
      else if (readyT > 0) ui.text(c, 'نبدأ بعد ' + ui.num(Math.ceil(15 - readyT)) + ' ثانية', cx, h * 0.86, 20, th.warn, true);
      ui.draw(c); return;
    }
    // الحلبة: حارة لكل لاعب، البداية يمينًا والنهاية يسارًا (اتجاه العربية)
    const top = ui.safe.top + (api.teams.on ? 56 : 16), bot = h - 70, n = Math.max(1, L.length), lh = Math.min(170, (bot - top) / n), y0 = top + ((bot - top) - lh * n) / 2;
    const xs = w * 0.84, xe = w * 0.08, sq = Math.max(8, lh * 0.14);
    flag(c, xe - sq, y0, y0 + lh * n, sq);
    L.forEach((p, k) => {
      const r = P(p.index), y = y0 + k * lh + lh / 2, tm = api.teams.of(p.index), rr = Math.min(lh * 0.32, 40);
      c.fillStyle = k % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'; c.fillRect(xe, y - lh / 2 + 2, xs - xe + rr * 1.5, lh - 4);
      if (tm >= 0) { c.fillStyle = api.teams.colors[tm]; c.fillRect(xs + rr * 1.5 - 6, y - lh / 2 + 2, 6, lh - 4); }
      for (let s = 1; s < GOAL; s++) { const x = xs - (xs - xe) * s / GOAL; c.fillStyle = s <= r.steps ? p.color : 'rgba(255,255,255,0.18)'; c.globalAlpha = s <= r.steps ? 0.5 : 1; c.beginPath(); c.arc(x, y, Math.max(3, lh * 0.04), 0, 6.283); c.fill(); c.globalAlpha = 1; }
      const tx = xs - (xs - xe) * Math.min(1, r.steps / GOAL); if (!r.x) r.x = tx; r.x += (tx - r.x) * 0.2; r.y = y;
      c.globalAlpha = p.connected ? 1 : 0.35;
      if (r.glow > 0) { c.strokeStyle = '#ffffff'; c.globalAlpha = r.glow * 1.6; c.lineWidth = 3; c.beginPath(); c.arc(r.x, y, rr * (1.3 + (0.5 - r.glow)), 0, 6.283); c.stroke(); c.globalAlpha = p.connected ? 1 : 0.35; }
      ui.shape(c, p.colorIndex, r.x + (r.shake > 0 && !ui.still ? Math.sin(T * 60) * 4 : 0), y, rr * (r.fin === 1 && !ui.still ? 1 + 0.08 * Math.sin(T * 8) : 1));
      ui.text(c, p.name, w * 0.92, y - lh * 0.12, Math.max(14, Math.min(26, lh * 0.22)), th.fg, true);
      ui.text(c, r.lvl >= 0 ? LVL[r.lvl] + ' · ' + ui.num(r.steps) + '/' + ui.num(GOAL) : '…', w * 0.92, y + lh * 0.18, Math.max(12, Math.min(20, lh * 0.17)), th.mut, true);
      if (r.fin) ui.text(c, r.fin === 1 ? '🏁 الأول' : '🏁 ' + ui.num(r.fin), r.x, y - rr - 14, Math.max(14, lh * 0.18), th.warn, true);
      c.globalAlpha = 1;
    });
    if (firstT >= 0 && state === 'play') ui.text(c, 'وصل ' + firstName + '! بقي ' + ui.num(Math.max(0, Math.ceil(GRACE - (t - firstT)))) + ' ثانية', cx, h - 40, Math.max(18, u * 3), th.warn, true);
    if (api.teams.on) for (let tm = 0; tm < 2; tm++) { const bw = Math.min(240, w * 0.22), x = tm ? cx - bw - 10 : cx + 10; c.fillStyle = api.teams.colors[tm]; c.beginPath(); c.roundRect(x, ui.safe.top + 4, bw, 40, 20); c.fill(); ui.text(c, api.teams.names[tm] + '  ' + ui.num(teamScore(tm)), x + bw / 2, ui.safe.top + 24, 18, th.bg, true); }
    ui.draw(c);
  }
});
