// @title ضربة الموجة
// @desc دورك: لوّح بيدك فوق حارتك ست ثوانٍ، وكل موجة نقطة. خصمك يقف ساكنًا.
// @engine 0.2
// @capabilities camera.lanes audio players.local
// @accent #ff7a45

let api, ui, P, W = 0, H = 0;
let state = 'intro';   // intro | count | play | turnEnd | over
const PLAY = 6;        // ثوانٍ لكل دور
const ROUNDS = 3;      // أدوار لكل لاعب
const TOTAL = ROUNDS * 2;
let turn = 0;          // الدور الحالي؛ اللاعب = turn % 2
let turnsDone = 0;
let left = PLAY, waves = 0, lastWaves = 0, cool = 0, prevUp = false;
let scores = [0, 0];

function who() { return turn % 2; }

function startCountdown() {
  state = 'count';
  ui.countdown(3, () => { state = 'play'; left = PLAY; waves = 0; cool = 0; prevUp = false; });
}

function finish() {
  state = 'over';
  api.end({
    score: scores[0] + scores[1],
    text: P.names[0] + ' ' + ui.num(scores[0]) + ' · ' + P.names[1] + ' ' + ui.num(scores[1]),
    scores: [scores[0], scores[1]]
  });
}

function endTurn() {
  lastWaves = waves;
  scores[who()] += waves;
  turnsDone++;
  if (turnsDone >= TOTAL) return finish();
  state = 'turnEnd';
}

defineGame({
  init(a) {
    api = a; ui = a.ui;
    P = api.players.local({ names: ['أ', 'ب'] });
    api.track.lanes({ count: 2, by: 'motion', threshold: 24 }, d => {
      if (state !== 'play') return;
      const L = d.lanes[who()];
      const up = L.present;
      if (up && !prevUp && cool <= 0) {
        waves++;
        cool = 0.35;
        ui.pop(1, L.cx * W, L.cy * H);
        api.audio.beep(660, 80);
      }
      prevUp = up;
    });
  },

  onTap() {
    if (state === 'intro') { turn = 0; turnsDone = 0; scores = [0, 0]; startCountdown(); }
    else if (state === 'turnEnd') { turn = turnsDone; startCountdown(); }
  },

  update(dt) {
    if (cool > 0) cool -= dt;
    if (state !== 'play') return;
    left -= dt;
    if (left <= 0) { left = 0; endTurn(); }
  },

  render(c, w, h) {
    W = w; H = h;
    ui.background(c);

    c.save();
    for (let i = 0; i < 2; i++) {
      c.globalAlpha = who() === i && state !== 'intro' ? 0.9 : 0.4;
      c.fillStyle = ui.theme.surface;
      c.beginPath();
      c.roundRect(8 + i * (w / 2), h * 0.14, w / 2 - 16, h * 0.78, 24);
      c.fill();
    }
    c.restore();

    for (let i = 0; i < 2; i++) {
      const live = state === 'play' && who() === i ? waves : 0;
      ui.playerChip(c, i, w * (i + 0.5) / 2, h * 0.22, {
        label: P.names[i], score: ui.num(scores[i] + live), active: who() === i
      });
    }

    if (state === 'intro') {
      ui.title(c, 'ضربة الموجة', 'دورك: لوّح بيدك فوق حارتك ست ثوانٍ، وكل موجة نقطة. خصمك يقف ساكنًا.');
    } else if (state === 'play') {
      ui.progress(c, left / PLAY);
      ui.bigText(c, ui.num(waves), { y: h * 0.48 });
      ui.text(c, 'لوّح فوق حارتك ' + P.names[who()], w / 2, h * 0.7, 18, ui.theme.fg);
    } else if (state === 'turnEnd') {
      ui.bigText(c, ui.num(lastWaves), { y: h * 0.48 });
      ui.text(c, P.names[who()] + ' سجّل ' + ui.num(lastWaves) + ' موجات', w / 2, h * 0.6, 18, ui.theme.fg);
      ui.text(c, 'المس للدور التالي: ' + P.names[turnsDone % 2], w / 2, h * 0.7, 18, ui.theme.mut);
    }
    ui.draw(c);
  }
});
