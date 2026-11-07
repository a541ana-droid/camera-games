// @title تجمّد!
// @desc تحرّك مع اللحن، وحين يتوقف تجمّد تمامًا. من يتحرك أثناء التجمّد يخسر نقطة. لاعبان بالتناوب. ثبّت الجهاز على حامل.
// @howto ارقص مع اللحن، وتجمّد حين يقف!
// @howto-act freeze
// @accent #4da3ff
// @engine 0.2
// @capabilities camera.motion audio haptic hud players.local
// @players 2-4
// @minutes 3
// @age 4
// @play camera
// @style versus

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل / 1 عادي (سلوك ما قبلها حرفيًا) / 2 صعب. by3(سهل، عادي، صعب).
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
let ROUNDS = 6, FREEZE_S = 2.5, ENERGY_LIMIT = 0.03; const GRACE = 0.7; // الحركة تعني أن أكثر من 3% من البكسلات تغيّرت
const SCALE = [262, 294, 330, 392, 440, 523];
let api, ui, motion, players, state = 'intro', timer = 0, round = 0, energy = 0, beat = 0, caught = false, msg = '', W = 400, H = 700;

function setHud() { api.hud.set({ score: players.names.map((n, i) => n + ' ' + players.scores[i]).join(' · '), title: players.current, time: String(Math.max(0, Math.ceil(timer))) }); }
function startMusic() { state = 'music'; timer = 3 + Math.random() * 3; beat = 0; caught = false; msg = 'تحرّك!'; }

defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; // الصورة لا تُعرض: اللعبة تقيس الحركة فقط ومقياسها على الشاشة يكفي
    ROUNDS = Math.max(2, Math.round(6 * RS)); FREEZE_S = by3(1.5, 2.5, 3.5); ENERGY_LIMIT = by3(0.06, 0.03, 0.02); // سهل: تجمّد أقصر ويُسمح بتمايل أكبر
    players = api.players.local({ names: ['اللاعب 1', 'اللاعب 2'] });
    motion = api.track.motion({ grid: [1, 1], threshold: 28 }, d => { energy = d.energy; });
    setHud();
  },
  onTap() { if (state === 'intro') { round = 0; state = 'count'; ui.countdown(3, startMusic); } },
  update(dt) {
    if (state === 'intro' || state === 'over' || state === 'count') return;
    timer -= dt; setHud();
    if (state === 'music') {
      beat -= dt;
      if (beat <= 0) { beat = 0.28; api.audio.tone({ freq: SCALE[Math.floor(Math.random() * SCALE.length)], ms: 220, vol: 0.25, type: 'triangle' }); }
      if (timer <= 0) { state = 'grace'; timer = GRACE; msg = 'تجمّد!'; api.audio.tone({ freq: 180, ms: 400, vol: 0.4, type: 'sawtooth' }); }
    } else if (state === 'grace') {
      if (timer <= 0) { state = 'freeze'; timer = FREEZE_S; }
    } else if (state === 'freeze') {
      if (energy > ENERGY_LIMIT && !caught) {
        caught = true; players.add(-1); msg = 'تحرّكت!'; ui.pop(-1, W / 2, H * 0.45); ui.flash(ui.theme.bad); api.haptic(150); api.audio.tone({ freq: 200, ms: 350, slide: -120, type: 'square' });
      }
      if (timer <= 0) {
        if (!caught) { players.add(1); msg = 'أحسنت!'; ui.pop(1, W / 2, H * 0.45); ui.flash(ui.theme.ok); api.audio.beep(784, 120); }
        round++; players.next();
        if (round >= ROUNDS) { state = 'over'; const m = Math.max.apply(null, players.scores), w = players.names.filter((n, i) => players.scores[i] === m);
          api.end({ score: m, scores: players.scores.slice(), text: w.length > 1 ? 'تعادل!' : 'الفائز: ' + w[0] }); }
        else startMusic();
      }
    }
  },
  render(ctx, w, h) {
    W = w; H = h; const th = ui.theme;
    ui.background(ctx);
    if (state === 'intro') { ui.title(ctx, 'تجمّد!', 'تحرّك مع اللحن، وحين يتوقف تجمّد تمامًا. من يتحرك أثناء التجمّد يخسر نقطة. ثبّت الجهاز على حامل.'); ui.draw(ctx); return; }
    if (state !== 'count') {
      if (state === 'freeze' || state === 'grace') { ctx.globalAlpha = state === 'freeze' ? 0.2 : 0.1; ctx.fillStyle = th.players[0].color; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
      if (caught && state === 'freeze') { ctx.globalAlpha = 0.28; ctx.fillStyle = th.bad; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
      for (let i = 0; i < players.names.length; i++) ui.playerChip(ctx, i, w * (players.names.length - i) / (players.names.length + 1), ui.safe.top + 24, { label: players.names[i], score: players.scores[i], active: i === players.index });
      ui.bigText(ctx, msg, { y: h * 0.3, color: caught && state === 'freeze' ? th.bad : th.fg });
      if (state === 'freeze') ui.progress(ctx, timer / FREEZE_S, { y: ui.safe.top + 56, color: th.players[0].color });
      ui.meter(ctx, energy, { max: ENERGY_LIMIT * 3, threshold: ENERGY_LIMIT, limit: true, label: 'حركتك' }); // الخط = أقصى حركة مسموحة
    }
    ui.draw(ctx);
  }
});
