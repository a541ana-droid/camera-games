// @title تفادى!
// @desc لكل لاعب حارته: نيازك تسقط عليك، فتحرّك جسمك أو يدك يمينًا ويسارًا أمام الكاميرا لتتفاداها. لكل لاعب 3 أرواح، ومن يصمد أطول يفوز. ثبّت الجهاز على حامل وقف على بعد مترين أو ثلاثة.
// @howto تحرّك يمينًا ويسارًا لتتفادى
// @howto-act dodge
// @accent #ff8a3d
// @engine 0.2
// @capabilities camera.lanes camera.motion audio haptic hud players.local
// @players 1-4
// @minutes 2
// @age 5
// @play camera
// @style versus
// الإحداثيات: api.track.lanes يعطي لكل حارة مركز الحركة cx (إحداثيات الشاشة كلها) فنحوّله إلى موضع داخل الحارة نفسها.
// عند لاعب واحد تُستعمل api.track.motion على الشاشة كلها. النيازك واحدة لكل الحارات (عدل بين اللاعبين).

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل / 1 عادي (سلوك ما قبلها حرفيًا) / 2 صعب. by3(سهل، عادي، صعب).
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
const TAU = 6.2832; let ROUND = 60, LIVES = 3, OV0 = 0.3, OVK = 0.17, OGAP = 1;
let api, ui, state = 'intro', count = 2, handle = null, lanes = [], t = 0, W = 400, H = 700, endIn = -1, names = [];
const px = [], life = [], alive = [], tDead = [], dodged = [], inv = [], hurt = [], absent = [];
const OB = [], parts = [], PN = 140; let pi = 0, nextSpawn = 0, prevX = 0.5, oid = 0;
const cntR = [], startR = { x: 0, y: 0, w: 200, h: 58 };
for (let i = 0; i < PN; i++) parts.push({ x: 0, y: 0, vx: 0, vy: 0, l: 0, c: '#fff', s: 3 });

function burst(x, y, col, n, spd, size) {
  for (let k = 0; k < n; k++) {
    const p = parts[pi], a = Math.random() * TAU, v = spd * (0.35 + Math.random() * 0.65);
    pi = (pi + 1) % PN; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.l = 0.5 + Math.random() * 0.5; p.c = col; p.s = size * (0.6 + Math.random() * 0.8);
  }
}
function stopTrack() { if (handle) { handle.stop(); handle = null; } }
function geom(w, h) {
  const top = ui.safe.top + 70, bot = h - 14, lw = w / count;
  return { top, bot, run: bot - top, lw, py: top + (bot - top) * 0.8, pr: Math.min(lw * 0.15, (bot - top) * 0.045, 30), rb: Math.min(lw * 0.15, 38) };
}
function layout(w, h) {
  ui.row(cntR, 4, h * 0.46, 54, 8, 420);
  startR.w = Math.min(w * 0.7, 280); startR.x = (w - startR.w) / 2; startR.y = h * 0.62;
}
function start() {
  stopTrack(); OB.length = 0; t = 0; nextSpawn = 0.8; prevX = 0.5; endIn = -1; lanes = [];
  for (let i = 0; i < 4; i++) { px[i] = 0.5; life[i] = LIVES; alive[i] = i < count; tDead[i] = 0; dodged[i] = 0; inv[i] = 0; hurt[i] = 0; absent[i] = 0; lanes.push({ energy: 0, cx: (i + 0.5) / count }); }
  if (count === 1) handle = api.track.motion({ grid: [1, 1], threshold: 24 }, d => { lanes[0] = { energy: d.energy, cx: d.cx, one: true }; });
  else handle = api.track.lanes({ count, by: 'motion', threshold: 24 }, d => { lanes = d.lanes; });
  state = 'count'; api.hud.set({ title: 'تفادى!', time: String(ROUND), score: '' });
  ui.countdown(3, () => { state = 'play'; });
}
function spawn() {
  const w = 0.5, g = geom(W, H), half = g.rb / g.lw; let x = half + Math.random() * (1 - 2 * half);
  if (Math.abs(x - prevX) < 0.18) x = x < 0.5 ? Math.min(1 - half, x + 0.3) : Math.max(half, x - 0.3);
  prevX = x; const k = Math.min(1, t / 45);
  OB.push({ id: oid++, t0: t, x, v: OV0 + OVK * k, hue: Math.random() < 0.5 ? 0 : 1, rot: Math.random() * TAU, done: 0, w });
  nextSpawn = t + (1.3 - 0.4 * k) * OGAP + Math.random() * 0.3;
}
function finish() {
  state = 'over'; stopTrack(); const sc = [], key = [];
  for (let i = 0; i < count; i++) { const s = alive[i] ? t : tDead[i]; key.push(s * 100 + dodged[i]); sc.push(Math.round(s * 10) + dodged[i] * 5); }
  const ranks = key.map(k => 1 + key.filter(o => o > k).length), win = ranks.indexOf(1);
  ui.flash(ui.theme.players[win].color); api.haptic(120); api.audio.melody([{ freq: 523, ms: 110 }, { freq: 659, ms: 110 }, { freq: 784, ms: 220 }]);
  const best = Math.max(...sc);
  api.end({ score: best, scores: sc, ranks, text: count === 1 ? 'صمدتَ ' + ui.num(Math.round(t)) + ' ثانية وتفاديتَ ' + ui.num(dodged[0]) + ' نيازك' : 'الفائز: اللاعب ' + ui.num(win + 1) + ' — صمد ' + ui.num(Math.round(alive[win] ? t : tDead[win])) + ' ثانية' });
}
function hit(i, g, ox, oy) {
  life[i]--; inv[i] = 1.5; hurt[i] = 0.35; const x = i * g.lw + px[i] * g.lw; burst(x, g.py, ui.theme.bad, 18, 220, 5); burst(ox, oy, '#ffd27a', 10, 160, 4);
  api.haptic(60); api.audio.tone({ freq: 160, ms: 200, vol: 0.3, type: 'sawtooth', slide: -90 });
  if (life[i] <= 0) { alive[i] = false; tDead[i] = t; burst(x, g.py, ui.theme.players[i].color, 30, 280, 6); ui.pop('خرج!', x, g.py - 50, ui.theme.bad); }
}

defineGame({
  init(a) { api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; ROUND = Math.round(60 * RS); LIVES = by3(5, 3, 2); OV0 = by3(0.2, 0.3, 0.36); OVK = by3(0.08, 0.17, 0.22); OGAP = by3(1.5, 1, 0.85); const s = api.view.size(); W = s.w; H = s.h; names = api.players.local({ names: ['1', '2'] }).names; count = Math.max(1, Math.min(4, names.length)); layout(W, H); api.hud.set({ title: 'تفادى!' }); },
  onResize(w, h) { W = w; H = h; layout(w, h); },
  onTap(x, y) {
    if (state !== 'intro') return;
    for (let i = 0; i < 4; i++) if (ui.hit(cntR[i], x, y)) { count = i + 1; api.audio.beep(700, 50); }
    if (ui.hit(startR, x, y)) start();
  },
  update(dt) {
    for (let k = 0; k < PN; k++) { const p = parts[k]; if (p.l > 0) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; } }
    if (state !== 'play') return;
    t += dt; const g = geom(W, H);
    if (t >= nextSpawn) spawn();
    let nAlive = 0;
    for (let i = 0; i < count; i++) {
      inv[i] = Math.max(0, inv[i] - dt); hurt[i] = Math.max(0, hurt[i] - dt);
      if (!alive[i]) continue; nAlive++;
      const L = lanes[i];
      if (L && L.energy > (L.one ? 0.012 : 0.025)) { const rel = L.one ? L.cx : (L.cx - i / count) * count; px[i] += (Math.max(0.06, Math.min(0.94, rel)) - px[i]) * Math.min(1, dt * 9); absent[i] = 0; } else absent[i] += dt;
      const x = i * g.lw + px[i] * g.lw;
      if (Math.random() < dt * 20) burst(x, g.py + g.pr, ui.theme.players[i].color, 1, 40, 3);
      for (const o of OB) {
        const oy = g.top - 40 + (t - o.t0) * o.v * g.run, ox = i * g.lw + o.x * g.lw;
        if (!(o.done & (1 << i)) && Math.hypot(ox - x, oy - g.py) < (g.rb + g.pr) * 0.72) { o.done |= 1 << i; if (inv[i] <= 0) hit(i, g, ox, oy); }
        else if (!(o.done & (1 << i)) && oy > g.py + g.pr + g.rb) { o.done |= 1 << i; dodged[i]++; burst(x, g.py, '#ffe9a8', 6, 120, 3); if (dodged[i] % 5 === 0) { ui.pop(5, x, g.py - 40, ui.theme.ok); api.audio.tone({ freq: 700, ms: 90, slide: 300, vol: 0.2 }); } }
      }
    }
    while (OB.length && g.top - 40 + (t - OB[0].t0) * OB[0].v * g.run > g.bot + 80) OB.shift();
    api.hud.set({ time: String(Math.max(0, Math.ceil(ROUND - t))), score: count === 1 ? 'تفاديت ' + ui.num(dodged[0]) : '' });
    if (endIn < 0 && (t >= ROUND || (count > 1 ? nAlive <= 1 : nAlive === 0))) endIn = 0.9;
    if (endIn >= 0) { endIn -= dt; if (endIn <= 0) finish(); }
  },
  render(ctx, w, h) {
    const th = ui.theme; W = w; H = h;
    if (state === 'intro') {
      ui.background(ctx); ui.bigText(ctx, 'تفادى!', { y: h * 0.17 }); ui.text(ctx, 'تحرّك يمينًا ويسارًا لتفادي النيازك في حارتك', w / 2, h * 0.27, Math.min(18, w * 0.05), th.mut);
      ui.text(ctx, 'عدد اللاعبين', w / 2, h * 0.41, 16, th.fg, true);
      for (let i = 0; i < 4; i++) ui.button(ctx, cntR[i], ui.num(i + 1), { on: count === i + 1 });
      ui.button(ctx, startR, 'ابدأ', { primary: true }); ui.text(ctx, 'قف على بعد مترين أو ثلاثة من الجهاز', w / 2, h * 0.76, 14, th.mut); ui.draw(ctx); return;
    }
    ui.background(ctx, 0.5);
    const g = geom(w, h), lw = g.lw, ph = t * 0.35 * g.run;
    for (let i = 0; i < count; i++) {
      const x0 = i * lw, pc = th.players[i].color, cx = x0 + lw / 2, dead = !alive[i];
      ctx.fillStyle = i % 2 ? 'rgba(20,16,44,0.55)' : 'rgba(34,26,70,0.55)'; ctx.fillRect(x0, 0, lw, h);
      ctx.globalAlpha = 0.16; ctx.fillStyle = pc; for (let k = -1; k < 9; k++) { const y = g.top + ((k * g.run / 8 + ph * 0.6) % (g.run + g.run / 8)); ctx.fillRect(x0 + lw * 0.47, y, lw * 0.06, g.run / 24); } ctx.globalAlpha = 1;
      const grd = ctx.createLinearGradient(0, g.py - 30, 0, h); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, pc); ctx.globalAlpha = 0.22; ctx.fillStyle = grd; ctx.fillRect(x0, g.py - 30, lw, h - g.py + 30); ctx.globalAlpha = 1;
      if (i) { ctx.strokeStyle = th.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, g.top - 10); ctx.lineTo(x0, h); ctx.stroke(); }
      if (state !== 'intro') { // أرواح وعدّاد البقاء
        ui.playerChip(ctx, i, cx, ui.safe.top + 28, { label: '', score: dead ? 'خرج' : ui.num(Math.round(alive[i] ? t : tDead[i])) + ' ث', size: Math.min(36, lw * 0.5), active: !dead });
        for (let k = 0; k < LIVES; k++) { const hx = cx + (k - (LIVES - 1) / 2) * Math.min(22, lw * 0.22), hy = ui.safe.top + 58; ctx.beginPath(); ctx.arc(hx, hy, 7, 0, TAU); if (k < life[i]) { ctx.fillStyle = pc; ctx.fill(); } else { ctx.strokeStyle = th.mut; ctx.lineWidth = 2; ctx.stroke(); } }
      }
    }
    for (const o of OB) { // النيازك المشتركة
      const oy = g.top - 40 + (t - o.t0) * o.v * g.run, rot = o.rot + t * 2, core = o.hue ? '#ff6b8b' : '#ffb347';
      for (let i = 0; i < count; i++) {
        const ox = i * lw + o.x * lw, r = g.rb; if (oy < -r * 2 || oy > h + r) continue;
        ctx.globalAlpha = 0.2; ctx.fillStyle = core; ctx.beginPath(); ctx.moveTo(ox - r * 0.8, oy); ctx.lineTo(ox + r * 0.8, oy); ctx.lineTo(ox, oy - r * 3.2); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(ox, oy, r * 1.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#3a2a4a'; ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill();
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(ox - r * 0.12, oy - r * 0.12, r * 0.82, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ox - r * 0.12, oy - r * 0.12, r * 0.42, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; // قلب متوهّج في الوسط فقط: لا نقاط ولا أقواس داخلية (كانت تُقرأ وجهًا)
      }
    }
    for (let i = 0; i < count; i++) { // اللاعبون
      const x0 = i * lw, pc = th.players[i].color, x = x0 + px[i] * lw;
      if (alive[i]) {
        const blink = inv[i] > 0 && Math.floor(inv[i] * 12) % 2 === 0;
        if (!blink) {
          ctx.globalAlpha = 0.25; ctx.fillStyle = pc; ctx.beginPath(); ctx.arc(x, g.py, g.pr * 2.1, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, g.py, g.pr * 1.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
          ui.shape(ctx, i, x, g.py, g.pr * 1.15); // اللاعب: شكله ولونه فقط (بلا عيون)
        }
        if (absent[i] > 1.2 && state === 'play') ui.text(ctx, 'لوّح أو تحرّك!', i * lw + lw / 2, g.py + g.pr * 3, Math.min(15, lw * 0.16), th.fg);
      } else { ctx.globalAlpha = 0.5; ctx.fillStyle = th.bg; ctx.fillRect(x0, g.top - 6, lw, h); ctx.globalAlpha = 1; }
      if (hurt[i] > 0) { ctx.globalAlpha = hurt[i]; ctx.fillStyle = th.bad; ctx.fillRect(x0, g.top - 6, lw, h); ctx.globalAlpha = 1; }
    }
    for (let k = 0; k < PN; k++) { const p = parts[k]; if (p.l <= 0) continue; ctx.globalAlpha = Math.min(1, p.l * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * Math.min(1, p.l * 2 + 0.3), 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
    if (state === 'play') ui.progress(ctx, 1 - t / ROUND);
    ui.draw(ctx);
  }
});
