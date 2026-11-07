// @title مين أسرع؟
// @desc جولات سريعة بزرّين: اضغط حين يظهر لونك، واختر الصندوق الذي فيه نجوم أكثر، وانتظر الضوء الأخضر. الأسرع يأخذ نقاطًا أكثر. وحدك أو بفريقين.
// @howto اضغط حين يصير الضوء أخضر
// @howto-act react
// @accent #4da3ff
// @engine 0.5
// @capabilities players.pads audio hud
// @pads 1-8 free 1v1 2v2 teams
// @series no
// لعبة ردّ فعل وأسئلة: api.pads.controls يغيّر زرّي الجوال في كل جولة، والنقاط لكل جوال (scores بترتيب index) ولكل فريق (teamScores).

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل / 1 عادي (سلوك ما قبلها حرفيًا) / 2 صعب. by3(سهل، عادي، صعب).
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
let ROUNDS = 9, WINDOW = 4, FINE = 1; const KINDS = ['me', 'more', 'green'];
let api, ui, state = 'ready', W = 800, H = 600, readyT = 0, ended = false;
let round = 0, kind = 'me', phase = 'wait', pt = 0, delay = 0, who = 0, left = 0, right = 0, answer = 0, order = [], msgT = 0, msg = '', msgC = '';
const pl = []; // {ready, score, done, mood, moodT}
const dotsL = [], dotsR = []; for (let i = 0; i < 12; i++) { dotsL.push([0, 0]); dotsR.push([0, 0]); }

function q(i) { return pl[i] || (pl[i] = { ready: false, score: 0, done: false, mood: 'happy', moodT: 0 }); }
function scatter(arr, n) { for (let i = 0; i < arr.length; i++) { arr[i][0] = i < n ? 0.15 + Math.random() * 0.7 : -1; arr[i][1] = 0.15 + Math.random() * 0.7; } }
function teamScore(tm) { let s = 0; for (const p of api.pads.list) if (api.teams.of(p.index) === tm) s += q(p.index).score; return s; }
function say(text, col) { msg = text; msgC = col || ui.theme.fg; msgT = 1.6; }
function nextRound() {
  round++; if (round > ROUNDS) return finish();
  kind = KINDS[(round - 1) % 3]; phase = 'wait'; pt = 0; order = []; delay = 1.2 + Math.random() * 2.2;
  for (const p of api.pads.list) q(p.index).done = false;
  const chars = []; for (const p of api.pads.list) if (p.connected && chars.indexOf(p.colorIndex) < 0) chars.push(p.colorIndex);
  if (kind === 'me') { who = chars.length ? chars[(Math.random() * chars.length) | 0] : 0; api.pads.controls({ stick: false, a: 'أنا!' }); api.pads.say(-1, 'اضغط حين يظهر لونك'); }
  if (kind === 'more') { left = 2 + ((Math.random() * 8) | 0); do { right = 2 + ((Math.random() * 8) | 0); } while (right === left); answer = right > left ? 0 : 1; scatter(dotsL, left); scatter(dotsR, right); delay = 0.8; api.pads.controls({ stick: false, a: 'أ', b: 'ب' }); api.pads.say(-1, 'أيّ صندوق فيه نجوم أكثر؟'); }
  if (kind === 'green') { api.pads.controls({ stick: false, a: 'الآن!' }); api.pads.say(-1, 'انتظر الأخضر ثم اضغط'); }
  api.hud.set({ score: ui.num(round) + '/' + ui.num(ROUNDS) });
}
function award(p, ok) {
  const r = q(p.index); r.done = true;
  if (ok) { order.push(p.index); const v = Math.max(1, 4 - order.length); r.score += v; r.mood = 'cheer'; r.moodT = 1; api.audio.beep(660 + order.length * -80 + 300, 80, 0.2); api.pads.vibrate(p.index, 60); api.pads.say(p.index, order.length === 1 ? 'الأسرع! +' + v : '+' + v); }
  else { r.score -= FINE; r.mood = 'sad'; r.moodT = 1; api.audio.tone({ freq: 220, ms: 160, vol: 0.12, slide: -80 }); api.pads.vibrate(p.index, 160); api.pads.say(p.index, FINE ? 'ليس الآن! −1' : 'ليس الآن!'); }
}
function finish() {
  state = 'over'; ended = true; const scores = []; for (let i = 0; i < 8; i++) scores[i] = pl[i] ? pl[i].score : 0;
  const ts = api.teams.on ? [teamScore(0), teamScore(1)] : undefined; let best = null; for (const p of api.pads.list) if (!best || q(p.index).score > q(best.index).score) best = p;
  api.audio.melody([{ freq: 659, ms: 110 }, { freq: 784, ms: 110 }, { freq: 988, ms: 260 }]);
  api.end({ score: best ? q(best.index).score : 0, scores, teamScores: ts, text: ts ? (ts[0] === ts[1] ? 'تعادل الفريقان' : 'فاز ' + api.teams.names[ts[0] > ts[1] ? 0 : 1]) : best ? 'الأسرع: ' + best.name : '' });
}

function tok(c, i, x, y, sz, mood) { // اللاعب = لونه وشكله فقط (DESIGN.md §2)، بلا وجه: cheer نبضة خفيفة، wow حلقة بيضاء
  const r = sz * 0.4 * (mood === 'cheer' && !ui.still ? 1 + 0.08 * Math.sin(ui.t * 10) : 1); ui.shape(c, i, x, y, r);
  if (mood === 'wow') { c.save(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = Math.max(2, r * 0.12); c.beginPath(); c.arc(x, y, r * 1.4, 0, 6.283); c.stroke(); c.restore(); }
}
defineGame({
  init(a) { api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; ROUNDS = Math.max(3, Math.round(9 * RS)); WINDOW = by3(6, 4, 3); FINE = DIFF === 0 ? 0 : 1; const s = api.view.size(); W = s.w; H = s.h; api.pads.controls({ stick: false, a: 'جاهز' }); api.pads.say(-1, 'اضغط «جاهز»'); api.hud.set({ title: 'مين أسرع؟' }); },
  onResize(w, h) { W = w; H = h; },
  update(dt) {
    const list = api.pads.list; msgT = Math.max(0, msgT - dt); for (const r of pl) if (r) r.moodT = Math.max(0, r.moodT - dt);
    if (state === 'ready') {
      let on = 0, rd = 0; for (const p of list) { if (!p.connected) continue; on++; const r = q(p.index); if (api.pads.input(p.index).aDown && !r.ready) { r.ready = true; api.audio.beep(700, 60, 0.2); } if (r.ready) rd++; }
      readyT = rd ? readyT + dt : 0; if (on && (rd === on || readyT > 12)) { state = 'count'; ui.countdown(3, () => { state = 'play'; round = 0; nextRound(); }); } return;
    }
    if (state !== 'play') return;
    pt += dt;
    if (phase === 'wait') {
      for (const p of list) { const s = api.pads.input(p.index), r = q(p.index); if (!r.done && (s.aDown || s.bDown) && p.connected && kind !== 'more') award(p, false); } // ضغطة مبكرة
      if (pt >= delay) { phase = 'go'; pt = 0; if (kind === 'green') api.audio.beep(1046, 90, 0.2); }
    } else if (phase === 'go') {
      for (const p of list) {
        const s = api.pads.input(p.index), r = q(p.index); if (r.done || !p.connected || !(s.aDown || s.bDown)) continue;
        if (kind === 'me') award(p, p.colorIndex === who && s.aDown);
        else if (kind === 'more') award(p, (s.aDown && !s.bDown ? 0 : s.bDown && !s.aDown ? 1 : -1) === answer);
        else award(p, true);
      }
      let need = 0, got = 0; for (const p of list) if (p.connected && (kind !== 'me' || p.colorIndex === who)) { need++; if (q(p.index).done) got++; }
      if (pt > WINDOW || (need && got >= need)) { phase = 'show'; pt = 0; say(kind === 'more' ? (answer ? 'الجواب: ب' : 'الجواب: أ') : order.length ? 'أحسنتم!' : 'لم يضغط أحد', ui.theme.accent); }
    } else if (phase === 'show' && pt > 1.6) nextRound();
    let hs = api.teams.on ? ui.num(teamScore(0)) + ' : ' + ui.num(teamScore(1)) : ui.num(round) + '/' + ui.num(ROUNDS); api.hud.set({ score: hs });
  },
  render(c, w, h) {
    W = w; H = h; const th = ui.theme, T = ui.t, list = api.pads.list, cx = w / 2, cy = h * 0.47, big = Math.min(w, h) * 0.32;
    ui.background(c);
    if (state === 'play') {
      ui.text(c, kind === 'me' ? 'اضغط حين يظهر لونك!' : kind === 'more' ? 'أيّ صندوق فيه نجوم أكثر؟' : 'انتظر الأخضر… ثم اضغط!', cx, ui.safe.top + 34, Math.max(20, Math.min(36, w * 0.028)), th.fg, true);
      if (kind === 'me') {
        if (phase === 'wait') { for (let k = 0; k < 3; k++) { c.globalAlpha = 0.25 + 0.25 * Math.sin(T * 6 + k); c.fillStyle = th.mut; c.beginPath(); c.arc(cx + (k - 1) * 40, cy, 10, 0, 6.283); c.fill(); } c.globalAlpha = 1; }
        else { const k = Math.min(1, pt * 6); c.globalAlpha = 0.25; c.fillStyle = ui.theme.players[who].color; c.beginPath(); c.arc(cx, cy, big * 0.75 * k, 0, 6.283); c.fill(); c.globalAlpha = 1; tok(c, who, cx, cy, big * k, 'wow'); ui.text(c, ui.theme.players[who].name + '!', cx, cy + big * 0.72, Math.max(24, big * 0.16), th.fg, true); }
      } else if (kind === 'more') {
        const bw = Math.min(w * 0.36, h * 0.5), bh = bw * 0.8, gap = w * 0.04;
        for (let s = 0; s < 2; s++) { const x = s ? cx - gap / 2 - bw : cx + gap / 2, y = cy - bh / 2, arr = s ? dotsR : dotsL, isAns = phase === 'show' && answer === s;
          c.fillStyle = th.surface; c.beginPath(); c.roundRect(x, y, bw, bh, 24); c.fill(); c.lineWidth = isAns ? 8 : 3; c.strokeStyle = isAns ? th.ok : th.line; c.stroke();
          ui.text(c, s ? 'ب' : 'أ', x + bw / 2, y - 28, 34, th.accent, true);
          if (phase !== 'wait' || pt > 0.2) for (const d of arr) { if (d[0] < 0) continue; const sx = x + d[0] * bw, sy = y + d[1] * bh, r = bw * 0.045; c.save(); c.translate(sx, sy); c.rotate(T * 0.5); c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r, a = k * 0.6283 - 1.5708; k ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fillStyle = '#ffd34d'; c.fill(); c.restore(); }
          if (phase === 'show') ui.text(c, ui.num(s ? right : left), x + bw / 2, y + bh + 30, 30, th.fg, true); }
      } else {
        const go = phase !== 'wait', r = big * 0.45; c.fillStyle = '#241f3d'; c.beginPath(); c.roundRect(cx - r * 1.4, cy - r * 1.4, r * 2.8, r * 2.8, r * 0.6); c.fill();
        c.globalAlpha = go ? 1 : 0.85; c.fillStyle = go ? th.ok : th.bad; c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.fill(); c.globalAlpha = 0.3; c.beginPath(); c.arc(cx, cy, r * (1.3 + (go ? 0.15 * Math.sin(T * 12) : 0)), 0, 6.283); c.fill(); c.globalAlpha = 1;
        ui.text(c, go ? 'الآن!' : 'انتظر…', cx, cy + r * 1.75, Math.max(24, r * 0.35), go ? th.ok : th.bad, true);
      }
      if (msgT > 0) ui.bigText(c, msg, { y: h * 0.8, color: msgC, alpha: Math.min(1, msgT * 2) });
    }
    // اللاعبون في صفّ أسفل الشاشة
    const n = Math.max(1, list.length), sz = Math.min(Math.max(110, h * 0.14), (w * 0.86) / n / 1.25), y = state === 'ready' ? h * 0.58 : h - Math.max(80, sz * 0.9) - 10;
    list.forEach((p, k) => { const r = q(p.index), x = cx + (k - (n - 1) / 2) * sz * 1.25, tm = api.teams.of(p.index);
      c.globalAlpha = p.connected ? 1 : 0.35;
      if (tm >= 0) { c.fillStyle = api.teams.colors[tm]; c.globalAlpha *= 0.3; c.beginPath(); c.arc(x, y, sz * 0.55, 0, 6.283); c.fill(); c.globalAlpha = p.connected ? 1 : 0.35; }
      tok(c, p.colorIndex, x, y - sz * 0.05, sz * 0.75, state === 'ready' ? (r.ready ? 'cheer' : 'happy') : r.moodT > 0 ? r.mood : 'happy');
      ui.text(c, p.name, x, y + sz * 0.45, Math.max(13, sz * 0.16), th.fg, true);
      ui.text(c, state === 'ready' ? (r.ready ? '✓ جاهز' : '…') : ui.num(r.score), x, y + sz * 0.64, Math.max(13, sz * 0.17), state === 'ready' ? (r.ready ? th.ok : th.mut) : th.accent, true); c.globalAlpha = 1; });
    if (state === 'ready') { ui.bigText(c, 'مين أسرع؟', { y: h * 0.22 }); ui.text(c, 'جولات: لونك — النجوم الأكثر — الضوء الأخضر. اضغط «جاهز» على جوالك.', cx, h * 0.31, Math.max(16, Math.min(26, w * 0.02)), th.mut);
      if (!list.length) ui.text(c, 'بانتظار الجوالات…', cx, h * 0.5, 24, th.mut); if (readyT > 0) ui.text(c, 'نبدأ بعد ' + ui.num(Math.ceil(12 - readyT)) + ' ثانية', cx, h * 0.85, 20, th.warn, true); }
    if (api.teams.on && state !== 'ready') for (let tm = 0; tm < 2; tm++) { const bw = Math.min(220, w * 0.24), x = tm ? 20 : w - 20 - bw; c.fillStyle = api.teams.colors[tm]; c.beginPath(); c.roundRect(x, ui.safe.top + 70, bw, 40, 20); c.fill(); ui.text(c, api.teams.names[tm] + '  ' + ui.num(teamScore(tm)), x + bw / 2, ui.safe.top + 90, 18, th.bg, true); }
    ui.draw(c);
  }
});
