// @title لوّح يا بطل
// @desc كل لاعب يلوّح بيده أمام الكاميرا ثماني ثوانٍ، وكل موجة نقطة. من يلوّح أكثر يفوز.
// @engine 0.2
// @capabilities camera.motion audio hud players.local
// @accent #ff8a3d

const TURN = 8;        // ثوانٍ لكل دور
const ROUNDS = 2;      // كل لاعب يلعب دورين
const TH = 0.04;       // عتبة حركة اليد (طاقة الإطار)
const COOL = 0.3;      // أقل فاصل بين موجتين (ثانية)

let api, ui, pl;
let state = 'intro';   // intro | count | handoff | turn | over
let left = TURN, cool = 0, energy = 0, turnNo = 0, total = 0, overT = 0;
let W = 0, H = 0, chipRects = [];

function startCount() {
  state = 'count';
  ui.countdown(3, () => {
    state = 'turn';
    left = TURN;
    cool = 0;
    api.audio.beep(880, 150);
  });
}

function endTurn() {
  turnNo++;
  ui.flash(ui.theme.warn, 0.2);
  if (turnNo >= total) {
    state = 'over';
    overT = 2.5;
  } else {
    pl.next();
    state = 'handoff';
  }
}

function finish() {
  const sc = pl.scores.slice();
  const best = Math.max(...sc);
  const leaders = pl.names.filter((n, i) => sc[i] === best);
  const text = leaders.length === 1
    ? 'الفائز: ' + leaders[0] + ' بـ ' + ui.num(best) + ' موجة'
    : 'تعادل بـ ' + ui.num(best) + ' موجة';
  api.end({ score: best, text, scores: sc });
}

defineGame({
  init(a) {
    api = a;
    ui = a.ui;
    pl = api.players.local({ names: ['الأول', 'الثاني'] });
    total = pl.names.length * ROUNDS;
    api.hud.set({ title: 'لوّح يا بطل' });
    api.track.motion({ grid: [3, 3], threshold: 28 }, d => { energy = d.energy; });
  },

  onTap() {
    if (state === 'intro' || state === 'handoff') startCount();
  },

  update(dt) {
    if (state === 'over') {
      overT -= dt;
      if (overT <= 0) finish();
      return;
    }
    if (state !== 'turn') return;
    cool -= dt;
    if (energy > TH && cool <= 0) {
      cool = COOL;
      pl.add(1);
      api.audio.beep(660, 60);
      ui.pop(1, W * 0.5, H * 0.62);
    }
    left -= dt;
    if (left <= 0) endTurn();
  },

  render(c, w, h) {
    W = w;
    H = h;
    const n = pl.names.length;
    ui.background(c);

    if (state === 'intro') {
      ui.title(c, 'لوّح يا بطل', 'كل لاعب يلوّح بيده أمام الكاميرا ' + ui.num(TURN) + ' ثوانٍ. كل موجة نقطة!');
    } else {
      chipRects = ui.row(chipRects, n, h * 0.2, 70);
      for (let i = 0; i < n; i++) {
        const r = chipRects[i];
        ui.playerChip(c, i, r.x + r.w / 2, r.y + r.h / 2, {
          label: pl.names[i],
          score: pl.scores[i],
          active: state === 'turn' && i === pl.index
        });
      }
    }

    if (state === 'handoff') {
      ui.bigText(c, 'دور: ' + pl.current, { y: h * 0.42 });
      ui.text(c, 'ناوِل الهاتف لصاحب الدور، ثم المس الشاشة', w / 2, h * 0.52, 18, ui.theme.mut);
    } else if (state === 'turn') {
      ui.progress(c, left / TURN);
      ui.bigText(c, 'لوّح!', { y: h * 0.42 });
      ui.text(c, pl.current, w / 2, h * 0.5, 22, ui.theme.fg, true);
      ui.meter(c, energy, { max: 0.2, threshold: TH, label: 'حركتك' });
    } else if (state === 'over') {
      const best = Math.max(...pl.scores);
      ui.results(c, {
        title: 'النتيجة',
        players: pl.names.map((nm, i) => ({ label: nm, score: pl.scores[i] })),
        winner: pl.names.find((nm, i) => pl.scores[i] === best)
      });
    }
    ui.draw(c);
  }
});
