// @title probe: lanes + colorPerPlayer (2 lanes)
// @engine 0.2
// @capabilities camera.lanes camera.playercolors hud
// يعرض في HUD قياسات اللعبة نفسها (بعد مرورها عبر Worker): طاقة الحارتين، ومواضع الأحمر والأزرق.
let L = [{ energy: 0 }, { energy: 0 }], P = { red: { cx: 0, present: false }, blue: { cx: 0, present: false } }, C = [{ ratio: 0 }, { ratio: 0 }], api;
const r2 = v => v.toFixed(2).replace('0.', '.');
defineGame({
  init(a) {
    api = a;
    a.track.lanes({ count: 2, by: 'motion', threshold: 24 }, d => { L = d.lanes; });
    a.track.lanes({ count: 2, by: 'color', color: { name: 'red' } }, d => { C = d.lanes; });
    a.track.colorPerPlayer([{ id: 'red', color: { name: 'red' } }, { id: 'blue', color: { name: 'blue' } }], d => { P = d.byId; });
  },
  update() { api.hud.set({ title: 'E' + r2(L[0].energy) + ' ' + r2(L[1].energy) + ' R' + (P.red.present ? r2(P.red.cx) : '-') + ' B' + (P.blue.present ? r2(P.blue.cx) : '-') + ' C' + r2(C[0].ratio) + ' ' + r2(C[1].ratio) }); },
  render() {}
});
