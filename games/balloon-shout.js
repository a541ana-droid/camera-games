// @title بالون الصوت
// @desc اصرخ أو انفخ قرب الميكروفون لتنفخ البالون. اسكت فيتنفّس ويصغر. صفّق لتطلق دفعة. اجعله يصل للنجمة قبل أن ينتهي الوقت. الصوت لا يُسجَّل ولا يغادر الجهاز.
// @accent #ff5d73
// @engine 0.2
// @capabilities audio.mic audio haptic hud

const GOAL = 1, TIME = 25, DECAY = 0.12, GAIN = 0.55;
let api, ui, size = 0.15, level = 0, onset = false, state = 'intro', timeLeft = TIME, hold = 0, msg = '', pops = 0, mic = null, denied = false, W = 400, H = 700, t = 0, burst = 0, bestPitch = 0;
const stars = [];

function startRound() { state = 'count'; size = 0.15; timeLeft = TIME; hold = 0; pops = 0; burst = 0; msg = ''; ui.countdown(3, () => { state = 'play'; msg = 'اصرخ لتنفخ!'; }); }
function hud() { api.hud.set({ title: 'بالون الصوت', time: String(Math.max(0, Math.ceil(timeLeft))), score: Math.round(size * 100) + '٪' }); }
function listen() {
  denied = false;
  mic = api.mic.listen({ hz: 30, threshold: 0.35, pitch: true }, d => {
    if (d.error) { denied = true; return; }
    level = d.level; if (d.onset) onset = true; bestPitch = d.pitch;
  });
}

defineGame({
  init(a) {
    api = a; ui = a.ui; W = api.view.size().w; H = api.view.size().h;
    for (let i = 0; i < 24; i++) stars.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.5 });
    hud();
  },
  onResize(w, h) { W = w; H = h; },
  onTap() {
    if (state === 'intro' || state === 'over') { startRound(); if (!mic) listen(); }
    else if (denied) { listen(); }
  },
  update(dt) {
    t += dt;
    if (state !== 'play') { onset = false; return; }
    timeLeft -= dt;
    // الصوت ينفخ، والسكوت يُفرغ، والتصفيق دفعة
    const push = Math.max(0, level - 0.12), R = Math.min(W, H) * 0.34 * size + 14;
    size += push * GAIN * dt - DECAY * dt * (push > 0 ? 0.3 : 1);
    if (onset) { size += 0.04; burst = 0.25; ui.pop('دفعة!', W / 2, H * 0.72 - R * 2 - 10, ui.theme.warn); api.audio.beep(660 + size * 400, 60, 0.15); onset = false; }
    burst = Math.max(0, burst - dt);
    if (size < 0.05) size = 0.05;
    if (push > 0.05 && Math.floor(t * 8) % 2 === 0) api.audio.tone({ freq: 220 + size * 500, ms: 50, vol: 0.06, type: 'triangle' });
    if (size >= GOAL) { // وصل البالون للنجمة: ثبّته نصف ثانية دون أن ينفجر
      hold += dt;
      if (hold > 0.5) { state = 'over'; api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 200 }]); msg = 'نفخته بالكامل! بقي ' + Math.ceil(timeLeft) + ' ث'; ui.flash(ui.theme.ok);
        api.end({ score: Math.round(100 + timeLeft * 10), text: 'نجحت بنفخ البالون قبل انتهاء الوقت.' }); }
    } else hold = 0;
    if (size > 1.15) { pops++; state = 'over'; msg = 'انفجر البالون!'; ui.flash(ui.theme.bad, 0.4); api.haptic(80); api.audio.tone({ freq: 120, ms: 300, vol: 0.4, type: 'sawtooth', slide: -80 }); api.end({ score: 0, text: 'انفجر البالون! نفخت أكثر من اللازم.' }); }
    else if (timeLeft <= 0) { state = 'over'; api.end({ score: Math.round(size * 100), text: 'انتهى الوقت وبلغ البالون ' + Math.round(size * 100) + '٪.' }); }
    hud();
  },
  render(c, w, h) {
    const th = ui.theme; ui.background(c);
    c.fillStyle = th.fg; c.globalAlpha = 0.5;
    for (const s of stars) { c.beginPath(); c.arc(s.x * w, s.y * h * 0.6, s.r, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
    if (state === 'intro') { ui.title(c, 'بالون الصوت', 'اصرخ أو انفخ قرب الميكروفون لتنفخ البالون وأوصله للنجمة قبل انتهاء الوقت. الصوت يُحلَّل على جهازك فقط ولا يُسجَّل.', 'المس الشاشة ثم اسمح بالميكروفون'); ui.draw(c); return; }
    ui.text(c, '★', w / 2, h * 0.115, 40, th.warn); // نجمة الهدف
    // البالون
    const R = Math.min(w, h) * 0.34 * size + 14, cx = w / 2, cy = h * 0.72 - R;
    const wob = Math.sin(t * 6) * (burst > 0 ? 6 : 1.5);
    const g = c.createRadialGradient(cx - R * 0.3 + wob, cy - R * 0.3, R * 0.1, cx + wob, cy, R * 1.1);
    g.addColorStop(0, th.players[1].color); g.addColorStop(1, size > 1 ? th.bad : '#d03050');
    c.fillStyle = g; c.beginPath(); c.ellipse(cx + wob, cy, R * 0.85, R, 0, 0, 6.3); c.fill();
    c.strokeStyle = th.mut; c.lineWidth = 2; c.beginPath(); c.moveTo(cx + wob, cy + R); c.lineTo(cx, h * 0.82); c.stroke();
    ui.meter(c, level, { threshold: 0.35, label: 'مستوى الصوت' });
    if (state !== 'count') {
      ui.progress(c, timeLeft / TIME);
      if (denied) ui.bigText(c, 'الميكروفون غير متاح — اسمح به ثم المس الشاشة', { y: h * 0.22, size: h * 0.032, color: th.bad });
      else ui.bigText(c, msg, { y: h * 0.2, size: h * 0.05 });
      if (state === 'play' && bestPitch > 0) ui.text(c, 'نغمة ≈ ' + ui.num(bestPitch) + ' هرتز', w / 2, h * 0.27, 14, th.mut);
    }
    ui.draw(c);
  }
});
