// @title مطرقة الهواء
// @desc تظهر أهداف في شبكة 3×3. اضربها بيدك في الهواء أمام الكاميرا (حركة في الخلية). 30 ثانية.
// @howto اضرب النجمة بيدك في الهواء
// @howto-act hand-zone
// @accent #ff6b8b
// @engine 0.2
// @capabilities camera.view camera.motion audio haptic hud

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل / 1 عادي (سلوك ما قبلها حرفيًا) / 2 صعب. by3(سهل، عادي، صعب).
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
const COLS = 3, ROWS = 3; let GAME_S = 30, CELL_LIMIT = 0.18, LIFE0 = 1.6, LIFEMIN = 0.8, LIFEDEC = 0.04; // الخلية "مضروبة" إذا تحرك أكثر من 18% من بكسلاتها
let api, ui, motion, state = 'intro', cells = [], target = -1, life = 0, score = 0, left = GAME_S, burst = 0, lastHit = -1, grace = 0, W = 400, H = 700;

function nextTarget() {
  let c; do { c = Math.floor(Math.random() * COLS * ROWS); } while (c === target);
  target = c; life = Math.max(LIFEMIN, LIFE0 - score * LIFEDEC); grace = 0.25; // مهلة قصيرة كي لا تُحسب حركة الظهور
}

defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; api.view.showCamera(true);
    GAME_S = Math.round(30 * RS); left = GAME_S; CELL_LIMIT = by3(0.12, 0.18, 0.22); LIFE0 = by3(2.8, 1.6, 1.3); LIFEMIN = by3(2, 0.8, 0.6); LIFEDEC = by3(0.02, 0.04, 0.05); // سهل: الهدف يبقى نحو 3 ثوانٍ
    motion = api.track.motion({ grid: [COLS, ROWS], threshold: 26 }, d => { cells = d.cells; });
    api.hud.set({ score: '0', time: String(GAME_S) });
  },
  onTap() { if (state === 'intro') { state = 'count'; score = 0; left = GAME_S; ui.countdown(3, () => { state = 'play'; nextTarget(); }); } },
  update(dt) {
    if (state !== 'play') return;
    left -= dt; life -= dt; grace -= dt; burst -= dt;
    api.hud.set({ time: String(Math.max(0, Math.ceil(left))) });
    if (grace <= 0 && (cells[target] || 0) > CELL_LIMIT) {
      score++; lastHit = target; burst = 0.3; api.hud.set({ score: String(score) }); api.haptic(40); api.audio.tone({ freq: 600, ms: 110, slide: 500 });
      ui.pop(1, ((target % COLS) + 0.5) * W / COLS, (Math.floor(target / COLS) + 0.3) * H / ROWS); nextTarget();
    } else if (life <= 0) { api.audio.tone({ freq: 200, ms: 120, vol: 0.2 }); nextTarget(); }
    if (left <= 0) { state = 'over'; motion.stop(); api.end({ score, text: 'انتهى الوقت' }); }
  },
  render(ctx, w, h) {
    W = w; H = h; const th = ui.theme;
    ui.background(ctx, 0.4); // شفافة جزئيًا: الكاميرا (إن أظهرها المستخدم) تبقى مرئية خلفها
    if (state === 'intro') { ui.title(ctx, 'مطرقة الهواء', 'اضرب الهدف بيدك في الهواء أمام الكاميرا قبل أن ينكمش. ثبّت الجهاز على حامل.'); ui.draw(ctx); return; }
    if (state === 'play') {
      const cw = w / COLS, ch = h / ROWS;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c, x = c * cw, y = r * ch, act = cells[i] || 0;
        ctx.strokeStyle = th.line; ctx.lineWidth = 1; ctx.strokeRect(x, y, cw, ch);
        if (act > 0.04) { ctx.globalAlpha = Math.min(0.3, act); ctx.fillStyle = th.fg; ctx.fillRect(x, y, cw, ch); ctx.globalAlpha = 1; }
        if (i === target) { // الهدف: دائرة بنجمة (بلا وجه) تنكمش مع انقضاء مهلتها، وحلقة تفرغ مع الوقت
          const k = 0.6 + 0.4 * Math.min(1, life / (LIFE0 * 0.75)), rad = Math.min(cw, ch) * 0.34 * k, cx = x + cw / 2, cy = y + ch / 2;
          ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
          ctx.fillStyle = th.onAccent; ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -1.5708 + k * 0.62832, q = k & 1 ? rad * 0.24 : rad * 0.56; ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } ctx.closePath(); ctx.fill();
          ctx.strokeStyle = th.fg; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, rad + 8, -1.5708, -1.5708 + 6.2832 * Math.max(0, life) / LIFE0); ctx.stroke(); ctx.lineCap = 'butt';
        }
        if (burst > 0 && i === lastHit) { ctx.globalAlpha = burst; ctx.fillStyle = th.ok; ctx.fillRect(x, y, cw, ch); ctx.globalAlpha = 1; }
      }
      ui.progress(ctx, left / GAME_S);
    }
    ui.draw(ctx);
  }
});
