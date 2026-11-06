// @title موجة الكفّ
// @desc لاعبان بالدور: كل واحد يلوّح بيده أمام الكاميرا ست ثوانٍ، كل موجة نقطة، والأكثر موجات يفوز.
// @engine 0.2
// @capabilities camera.motion audio players.local hud
// @accent #36c2a2

const TURN_SECONDS = 6, TURNS = 6, GAP = 0.25, LEVEL = 0.03;

let api, ui, pl;
let state = 'intro', W = 0, H = 0, cur = 0, turn = 0;
let energy = 0, prevHigh = false, sinceWave = 1, waves = 0;
let turnLeft = 0, waitLeft = 0, totals = [0, 0];

function who() { return turn % 2; }

function roundTitle() {
  return 'الجولة ' + ui.num(Math.floor(turn / 2) + 1) + ' من ' + ui.num(TURNS / 2);
}

function startTurn() {
  cur = who();
  state = 'count';
  api.hud.set({ title: roundTitle() });
  ui.countdown(3, () => {
    state = 'play';
    waves = 0;
    prevHigh = false;
    sinceWave = 1;
    turnLeft = TURN_SECONDS;
    api.audio.beep(880, 150, 0.25);
  });
}

function endTurn() {
  cur = who();
  totals[cur] += waves;
  api.hud.set({ score: ui.num(totals[0]) + ' - ' + ui.num(totals[1]) });
  ui.flash();
  turn++;
  if (turn >= TURNS) return finish();
  state = 'turnEnd';
  waitLeft = 2;
}

function finish() {
  state = 'over';
  const a = totals[0], b = totals[1];
  const verdict = a === b ? 'تعادل' : (a > b ? pl.names[0] : pl.names[1]) + ' يفوز';
  api.end({
    score: a + b,
    text: pl.names[0] + ': ' + ui.num(a) + ' · ' + pl.names[1] + ': ' + ui.num(b) + ' — ' + verdict,
    scores: [a, b]
  });
}

defineGame({
  init(a) {
    api = a;
    ui = a.ui;
    pl = api.players.local({ names: ['اللاعب الأول', 'اللاعب الثاني'] });
    api.hud.set({ title: 'موجة الكفّ' });
    api.track.motion({ grid: [3, 3], threshold: 28 }, d => {
      energy = d.energy;
      const high = energy > LEVEL;
      if (state === 'play' && high && !prevHigh && sinceWave >= GAP) {
        waves++;
        sinceWave = 0;
        api.audio.beep(660 + waves * 30, 60, 0.2);
        ui.pop(1, W * 0.5 + 60, H * 0.36);
      }
      prevHigh = high;
    });
  },

  onTap() {
    if (state === 'intro') startTurn();
    else if (state === 'ready') startTurn();
  },

  update(dt) {
    sinceWave += dt;
    if (state === 'play') {
      turnLeft -= dt;
      if (turnLeft <= 0) endTurn();
    } else if (state === 'turnEnd') {
      waitLeft -= dt;
      if (waitLeft <= 0) {
        state = 'ready';
        cur = who();
      }
    }
  },

  render(c, w, h) {
    W = w;
    H = h;
    ui.background(c);
    if (state === 'intro') {
      ui.title(c, 'موجة الكفّ', 'لاعبان بالدور: لوّح بيدك أمام الكاميرا ست ثوانٍ، وكل موجة نقطة.');
    } else {
      for (let i = 0; i < 2; i++) {
        ui.playerChip(c, i, w * (i ? 0.7 : 0.3), h * 0.2, {
          label: pl.names[i],
          score: ui.num(totals[i]),
          active: cur === i && state !== 'over'
        });
      }
      if (state === 'ready') {
        ui.bigText(c, 'دور ' + pl.names[cur], { y: h * 0.45 });
        ui.text(c, 'المس الشاشة عندما تكون جاهزًا', w / 2, h * 0.55, 18, ui.theme.mut);
      } else if (state === 'play') {
        ui.bigText(c, ui.num(waves), { y: h * 0.42 });
        ui.progress(c, turnLeft / TURN_SECONDS);
        ui.text(c, 'لوّح بيدك!', w / 2, h * 0.55, 18, ui.theme.mut);
        ui.meter(c, energy, { max: 0.15, threshold: LEVEL, label: 'حركتك الآن' });
      } else if (state === 'turnEnd') {
        ui.bigText(c, pl.names[cur] + ': ' + ui.num(waves) + ' موجة', { y: h * 0.45 });
      }
    }
    ui.draw(c);
  }
});
