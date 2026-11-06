// @title probe: 4 lanes + 4 player colors
// @engine 0.2
// @capabilities camera.lanes camera.playercolors hud
let L = [0, 1, 2, 3].map(() => ({ energy: 0 })), P = {}, api;
const r2 = v => v.toFixed(2).replace('0.', '.');
defineGame({
  init(a) {
    api = a; a.track.lanes({ count: 4, by: 'motion', threshold: 24 }, d => { L = d.lanes; });
    a.track.colorPerPlayer([{ id: 'r', color: { name: 'red' } }, { id: 'g', color: { name: 'green' } }, { id: 'b', color: { name: 'blue' } }, { id: 'y', color: { name: 'yellow' } }], d => { P = d.byId; });
  },
  update() { api.hud.set({ title: L.map(l => r2(l.energy)).join(' ') + ' ' + ['r', 'g', 'b', 'y'].map(k => P[k] && P[k].present ? '1' : '0').join('') }); },
  render() {}
});
