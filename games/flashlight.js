// @title المصباح الخفي
// @desc شاشة جوالك مظلمة، وإصبعك مصباح: حرّكه على الشاشة لتجد النجوم الذهبية المخبّأة. الجوال يهتزّ أكثر كلما اقتربت. من يجدها كلها أولًا يأخذ نقاطًا إضافية، وفي آخر الجولة تُكشف الأماكن.
// @howto حرّك إصبعك وابحث عن النجوم
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
// @style versus teams calm
// الجوال يرسم العتمة والضوء والأشكال وحده (api.pads.touch dark) ويُبلغ «وجدت» مرة لكل نجمة (onFind)؛ التلفاز يعرض أين يبحث كلٌّ (fx, fy) وما وجده، ويكشف الأماكن في آخر كل جولة.
// النقاط: نجمة = 1، ومن يجدها كلها أولًا +3 (الثاني +2، الثالث +1). الفريق = متوسط أعضائه.

let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
let ROUNDS = 3, RT = 60, K = 4, D = 8, R = 0.07, LIGHT = 0.17;
const GOLD = '#ffc145', DECOY = ['#4a5a8a', '#6a4a7a', '#3f6a66', '#7a5a46'], SH = ['circle', 'square', 'triangle', 'diamond'];
let api, ui, state = 'ready', W = 1280, H = 720, readyT = 0, ended = false, round = 0, rt = 0, rev = 0, doneOrder = 0;
const pl = []; // لكل مقعد: {ready, score, time, round, sid, items, found:[], done, flash}
const P = i => pl[i] || (pl[i] = { ready: false, score: 0, time: 0, round: -1, sid: 0, items: [], found: [], done: 0, flash: 0, gx: 0, gy: 0 });

function layout() { // K نجوم ذهبية + D أشكال خافتة، متباعدة على لوح طولي (الارتفاع ≈ ضعف العرض)
  const out = [];
  for (let n = 0, tries = 0; n < K + D && tries < 2000; tries++) {
    const x = 0.12 + Math.random() * 0.76, y = 0.08 + Math.random() * 0.84;
    if (out.some(o => Math.hypot(o.x - x, (o.y - y) * 2) < (tries > 1200 ? 0.16 : 0.24))) continue;
    out.push(n < K ? { x, y, r: R, shape: 'star', color: GOLD, goal: true } : { x, y, r: R * (0.8 + Math.random() * 0.4), shape: SH[n % 4], color: DECOY[(n * 3) % 4] }); n++;
  }
  return out;
}
function deal(i) { // جولة جديدة لهذا الجوال
  const r = P(i); r.round = round; r.sid = 2000 + round * 16 + i; r.items = layout(); r.found = []; r.done = 0;
  api.pads.touch(i, { dark: true, light: LIGHT, hint: true, id: r.sid, items: r.items }); api.pads.say(i, 'ابحث عن ' + ui.num(K) + ' نجوم ⭐ — حرّك إصبعك');
}
function teamScore(tm) { let s = 0, n = 0; for (const p of api.pads.list) if (api.teams.of(p.index) === tm) { s += P(p.index).score; n++; } return n ? Math.round(s / n * 10) / 10 : 0; }
function startRound() {
  state = 'count'; ui.countdown(3, () => { state = 'play'; rt = 0; doneOrder = 0; for (const p of api.pads.list) if (p.connected) deal(p.index); api.audio.beep(880, 80, 0.15); });
}
function endRound() {
  state = 'reveal'; rev = 0;
  for (const p of api.pads.list) { const r = P(p.index); if (r.round !== round) continue; if (!r.done) r.time += RT;
    api.pads.touch(p.index, { dark: false, id: r.sid + 1000, items: r.items.map(it => Object.assign({}, it, { goal: false })) }); // الكشف على الجوال أيضًا
    api.pads.say(p.index, r.done ? '🎉 وجدتها كلها!' : 'وجدت ' + ui.num(r.found.length) + ' من ' + ui.num(K) + ' — هنا كانت'); }
  api.audio.melody([{ freq: 659, ms: 100 }, { freq: 784, ms: 100 }, { freq: 988, ms: 220 }]);
}
function finish() {
  state = 'over'; ended = true; const L = api.pads.list, scores = [], ranks = [];
  const ord = L.slice().sort((a, b) => P(b.index).score - P(a.index).score || P(a.index).time - P(b.index).time);
  ord.forEach((p, k) => { const prev = ord[k - 1]; ranks[p.index] = prev && P(prev.index).score === P(p.index).score && P(prev.index).time === P(p.index).time ? ranks[prev.index] : k + 1; });
  for (let i = 0; i < 8; i++) { scores[i] = pl[i] ? pl[i].score : 0; if (ranks[i] == null) ranks[i] = 8; }
  const ts = api.teams.on ? [teamScore(0), teamScore(1)] : undefined;
  const text = ts ? (ts[0] === ts[1] ? 'تعادل الفريقان!' : 'فاز ' + api.teams.names[ts[0] > ts[1] ? 0 : 1]) : ord.length ? 'أكثر من وجد: ' + ord[0].name + ' (' + ui.num(P(ord[0].index).score) + ')' : 'انتهت اللعبة';
  api.pads.touch(-1, null); api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 120 }, { freq: 1046, ms: 260 }]);
  api.end({ score: ord.length ? P(ord[0].index).score : 0, scores, ranks, teamScores: ts, text });
}
function star(c, x, y, r, fill, line) { c.beginPath(); for (let k = 0; k < 10; k++) { const a = -1.5708 + k * 0.6283, q = k % 2 ? r * 0.45 : r; k ? c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) : c.moveTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (line) { c.strokeStyle = line; c.lineWidth = 2; c.stroke(); } }
function deco(c, it, x, y, r) { c.fillStyle = it.color; c.beginPath(); const s = it.shape;
  if (s === 'square') c.rect(x - r * 0.86, y - r * 0.86, r * 1.72, r * 1.72); else if (s === 'triangle') { c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.78); c.lineTo(x - r, y + r * 0.78); c.closePath(); }
  else if (s === 'diamond') { c.moveTo(x, y - r * 1.1); c.lineTo(x + r, y); c.lineTo(x, y + r * 1.1); c.lineTo(x - r, y); c.closePath(); } else c.arc(x, y, r, 0, 6.283); c.fill(); }

defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1;
    ROUNDS = Math.max(1, Math.round(3 * RS)); RT = by3(75, 60, 45); K = by3(3, 4, 5); D = by3(4, 8, 11); R = by3(0.09, 0.07, 0.055); LIGHT = by3(0.26, 0.2, 0.14);
    const s = api.view.size(); W = s.w; H = s.h;
    api.pads.onFind(e => {
      const r = P(e.index); if (state !== 'play' || e.id !== r.sid || r.found.indexOf(e.item) >= 0 || e.item >= K) return;
      r.found.push(e.item); r.score++; r.flash = 0.6; api.audio.beep(988 + r.found.length * 80, 70, 0.16);
      if (r.found.length >= K && !r.done) { r.done = ++doneOrder; const b = Math.max(0, 4 - r.done); r.score += b; r.time += rt;
        api.pads.say(e.index, '🎉 وجدتها كلها!' + (b ? ' +' + b : '')); api.pads.vibrate(e.index, 120); }
      else api.pads.say(e.index, '⭐ ' + ui.num(r.found.length) + ' من ' + ui.num(K));
    });
    api.pads.onJoin(p => { const r = P(p.index); if (state === 'ready') { r.ready = false; api.pads.say(p.index, 'اضغط «جاهز»'); } else if (state === 'play' && r.round !== round) deal(p.index); });
    api.pads.controls({ stick: false, a: 'جاهز', b: '' }); api.pads.say(-1, 'اضغط «جاهز» حين تستعد'); api.hud.set({ title: 'المصباح الخفي' });
  },
  onResize(w, h) { W = w; H = h; },
  update(dt) {
    const L = api.pads.list; for (const p of L) { const r = P(p.index); r.flash = Math.max(0, r.flash - dt); }
    if (state === 'ready') {
      let on = 0, rd = 0; for (const p of L) { if (!p.connected) continue; on++; const r = P(p.index); if (api.pads.input(p.index).aDown && !r.ready) { r.ready = true; api.audio.beep(660 + p.index * 60, 70, 0.2); api.pads.vibrate(p.index, 30); } if (r.ready) rd++; }
      readyT = rd ? readyT + dt : 0; if (on && (rd === on || readyT > 12)) { round = 0; for (const p of L) { const r = P(p.index); r.score = 0; r.time = 0; } api.pads.controls({ stick: false, a: '', b: '' }); startRound(); }
      return;
    }
    if (state === 'play') {
      rt += dt; let left = 0; for (const p of L) if (p.connected && P(p.index).round === round && !P(p.index).done) left++;
      api.hud.set({ time: ui.num(Math.max(0, Math.ceil(RT - rt))), score: api.teams.on ? ui.num(teamScore(0)) + ' : ' + ui.num(teamScore(1)) : 'جولة ' + ui.num(round + 1) + '/' + ui.num(ROUNDS) });
      if (rt >= RT || (left === 0 && rt > 1)) endRound();
    } else if (state === 'reveal' && (rev += dt) >= 4.5 && !ended) { round++; if (round >= ROUNDS) finish(); else startRound(); }
  },
  render(c, w, h) {
    W = w; H = h; const th = ui.theme, L = api.pads.list, cx = w / 2, T = ui.t;
    ui.background(c);
    if (state === 'ready') {
      ui.bigText(c, 'المصباح الخفي', { y: h * 0.18 });
      ui.text(c, 'شاشة جوالك مظلمة: حرّك إصبعك عليها لتجد النجوم الذهبية', cx, h * 0.28, Math.max(16, Math.min(28, w * 0.02)), th.mut);
      for (let k = 0; k < 3; k++) star(c, cx + (k - 1) * 70, h * 0.37, 24, GOLD);
      const n = Math.max(1, L.length), sz = Math.min(150, w * 0.8 / n);
      L.forEach((p, k) => { const r = P(p.index), x = cx + (k - (n - 1) / 2) * sz * 1.15, y = h * 0.6; c.globalAlpha = p.connected ? 1 : 0.35;
        ui.shape(c, p.colorIndex, x, y, sz * 0.3 * (r.ready && !ui.still ? 1 + 0.06 * Math.sin(T * 8) : 1)); ui.text(c, p.name, x, y + sz * 0.5, Math.max(15, sz * 0.15), th.fg, true);
        ui.text(c, !p.connected ? 'انقطع' : r.ready ? '✓ جاهز' : 'اضغط «جاهز»', x, y + sz * 0.7, Math.max(13, sz * 0.12), r.ready ? th.ok : th.mut, r.ready); c.globalAlpha = 1; });
      if (!L.length) ui.text(c, 'بانتظار الجوالات…', cx, h * 0.6, 24, th.mut);
      else if (readyT > 0) ui.text(c, 'نبدأ بعد ' + ui.num(Math.ceil(12 - readyT)) + ' ثانية', cx, h * 0.88, 20, th.warn, true);
      ui.draw(c); return;
    }
    // لوح مظلم لكل لاعب بشكل الجوال: نور إصبعه، وما وجده، والكشف في آخر الجولة
    const n = Math.max(1, L.length), top = ui.safe.top + (api.teams.on ? 60 : 20), avH = h - top - 200, gap = Math.max(12, w * 0.015);
    let pw = Math.min((w * 0.94 - gap * (n - 1)) / n, (avH - 20) * 0.47), ph = pw / 0.47; const x0 = cx - (n * pw + (n - 1) * gap) / 2, y0 = top + 100;
    L.forEach((p, k) => {
      const r = P(p.index), x = x0 + k * (pw + gap), s = api.pads.input(p.index), cur = r.round === round, showAll = state === 'reveal' && cur, d = Math.min(pw, ph), tm = api.teams.of(p.index);
      c.globalAlpha = p.connected ? 1 : 0.35;
      ui.shape(c, p.colorIndex, x + pw - 16, y0 - 40, 14); ui.text(c, p.name, x + pw / 2 - 10, y0 - 40, Math.max(14, Math.min(24, pw * 0.11)), th.fg, true);
      if (tm >= 0) { c.fillStyle = api.teams.colors[tm]; c.fillRect(x, y0 - 18, pw, 5); }
      c.fillStyle = '#05040a'; c.beginPath(); c.roundRect(x, y0, pw, ph, 16); c.fill(); c.lineWidth = r.flash > 0 ? 6 : 3; c.strokeStyle = r.flash > 0 ? GOLD : p.color; c.stroke();
      if (cur && state === 'play' && s.finger) { const lx = x + s.fx * pw, ly = y0 + s.fy * ph, LR = LIGHT * d, g = c.createRadialGradient(lx, ly, LR * 0.2, lx, ly, LR);
        g.addColorStop(0, 'rgba(255,244,214,0.45)'); g.addColorStop(1, 'rgba(255,244,214,0)'); c.fillStyle = g; c.beginPath(); c.arc(lx, ly, LR, 0, 6.283); c.fill();
        c.strokeStyle = p.color; c.lineWidth = 3; c.beginPath(); c.arc(lx, ly, Math.max(6, d * 0.04), 0, 6.283); c.stroke(); }
      if (cur) r.items.forEach((it, j) => { const ix = x + it.x * pw, iy = y0 + it.y * ph, ir = it.r * d, got = r.found.indexOf(j) >= 0;
        if (it.goal && got) { star(c, ix, iy, ir, GOLD, '#ffffff'); }
        else if (showAll) { if (it.goal) { c.globalAlpha = 0.7 + (ui.still ? 0 : 0.3 * Math.sin(T * 6)); star(c, ix, iy, ir, null, GOLD); c.globalAlpha = p.connected ? 1 : 0.35; } else { c.globalAlpha = 0.6; deco(c, it, ix, iy, ir); c.globalAlpha = p.connected ? 1 : 0.35; } } });
      for (let j = 0; j < K; j++) star(c, x + pw / 2 + (j - (K - 1) / 2) * Math.min(30, pw / (K + 1)), y0 + ph + 26, Math.min(12, pw / (K + 2) / 2), cur && j < r.found.length ? GOLD : 'rgba(255,255,255,0.15)');
      ui.text(c, ui.num(r.score) + (r.done ? (r.done === 1 ? '  🏁 الأول' : '  🏁') : ''), x + pw / 2, y0 + ph + 60, Math.max(14, Math.min(24, pw * 0.11)), r.done ? th.warn : th.fg, true);
      c.globalAlpha = 1;
    });
    if (state === 'play') ui.progress(c, Math.max(0, 1 - rt / RT), { y: top + 2, h: 8 });
    if (state === 'reveal') ui.text(c, 'هنا كانت النجوم!', cx, top + 18, Math.max(24, h * 0.034), GOLD, true);
    if (api.teams.on) for (let tm = 0; tm < 2; tm++) { const bw = Math.min(240, w * 0.22), x = tm ? cx - bw - 10 : cx + 10; c.fillStyle = api.teams.colors[tm]; c.beginPath(); c.roundRect(x, ui.safe.top + 4, bw, 40, 20); c.fill(); ui.text(c, api.teams.names[tm] + '  ' + ui.num(teamScore(tm)), x + bw / 2, ui.safe.top + 24, 18, th.bg, true); }
    ui.draw(c);
  }
});
