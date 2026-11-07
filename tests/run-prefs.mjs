// إعدادات الأسرة (0.5.2): الحفظ، والتطبيق في المضيف (الصوت، الاهتزاز، الحساسية، الوميض، النص)، ووصول api.prefs للعبة للقراءة فقط، ومدة الجولة في الألعاب، و«مسح بياناتي».
import { readFileSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome({ fake: true }); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + (i === undefined ? '' : '  ' + JSON.stringify(i))); };
const wait = async (expr, ms = 8000) => { for (let t = 0; t < ms; t += 150) { if (await c.ev(expr)) return true; await sleep(150); } return false; };
const root = new URL('..', import.meta.url).pathname;
const seg = (p, v) => c.ev(`document.querySelector('.seg[data-p=${p}] [data-v="${v}"]').click()`);
const tog = (id, on) => c.ev(`(()=>{const e=document.getElementById('${id}'); if(e.checked!==${on}) e.click(); return e.checked})()`);
const prefs = () => c.ev(`JSON.parse(localStorage.getItem('engine-prefs')||'null')`);
const INSTR = `(()=>{ if (window.__au) return; window.__au={osc:0,dest:0,maxGain:0}; window.__vib=0; navigator.vibrate=()=>{__vib++;return true};
  const oc=AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator=function(){__au.osc++;return oc.call(this)};
  const cn=AudioNode.prototype.connect; AudioNode.prototype.connect=function(d,...r){ if(d instanceof AudioDestinationNode) __au.dest++; return cn.call(this,d,...r)};
  const lr=AudioParam.prototype.linearRampToValueAtTime; AudioParam.prototype.linearRampToValueAtTime=function(v,t){ if(v<5&&v>__au.maxGain) __au.maxGain=v; return lr.call(this,v,t)}; })()`;
const probe = async () => { // يشغّل لعبة الفحص ويعيد تقريرها + عدّادات الصوت والاهتزاز أثناءها
  await c.ev(INSTR); await c.ev(`__au.osc=0;__au.dest=0;__au.maxGain=0;__vib=0;__engine.events.length=0;__engine.startGame('tests/games/prefs-probe.js')`);
  let end = null; for (let i = 0; i < 40 && !end; i++) { await sleep(250); end = await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`); }
  const au = await c.ev(`({...__au, vib: __vib})`); await c.ev(`__engine.stopGame('exit'); __engine.show('menu')`); await sleep(200);
  return { rep: end ? JSON.parse(end.text) : null, au };
};
try {
  await c.nav(BASE + '/index.html?debug=1', 1800); await c.ev(`localStorage.clear()`); await c.nav(BASE + '/index.html?debug=1', 1800);
  // الورقة: مجموعات بعناوين، وأهداف لمس كبيرة
  await c.ev(`document.getElementById('setBtn').click()`); await sleep(300);
  const ui = await c.ev(`(()=>{const s=document.getElementById('settings'); const hs=[...s.querySelectorAll('h3')].map(h=>h.textContent.trim());
    const small=[...s.querySelectorAll('button,select,input[type=checkbox],a.btn')].filter(e=>e.offsetParent).map(e=>{const r=e.getBoundingClientRect(); return [e.id||e.textContent.trim().slice(0,12), Math.round(r.width), Math.round(r.height)]}).filter(x=>x[2]<32||x[1]<32);
    return {open:!s.hidden, hs, small, ver: document.getElementById('aboutVer').textContent, gh: !!s.querySelector('a[href="https://github.com/a541ana-droid/camera-games"]'), mit: /MIT/.test(s.textContent), priv: /لا تُرسل ولا تُحفظ/.test(s.textContent), visitors: !document.getElementById('stats') && !document.getElementById('statsL') && !/زوّار الموقع/.test(s.textContent), contact: !!s.querySelector('#gContact') && !!s.querySelector('a[href="https://github.com/a541ana-droid/camera-games/issues/new"]') && document.getElementById('mailL').hidden, noMail: !/@|mailto/.test(s.innerHTML)}})()`);
  ok('settings sheet opens with grouped headings (sound, play, camera, view, about, data)', ui.open && ['الصوت', 'اللعب', 'الكاميرا', 'العرض', 'حول', 'تواصل', 'بياناتي'].every(k => ui.hs.some(h => h.includes(k))), ui.hs);
  ok('every control is a big touch target (≥32px; toggles 56×34, buttons ≥48 tall)', !ui.small.length, ui.small);
  ok('«حول»: version, GitHub link, MIT, privacy summary, visitor counter NOT displayed (0.7.0), «تواصل معنا» with GitHub Issues, e-mail line hidden while CONTACT_EMAIL is empty', ui.ver === /VERSION = '([\d.]+)'/.exec(readFileSync(root + 'engine.js', 'utf8'))[1] && ui.gh && ui.mit && ui.priv && ui.visitors && ui.contact && ui.noMail && /CONTACT_EMAIL = '';/.test(readFileSync(root + 'engine.js', 'utf8')), ui);
  const d0 = await c.ev(`__engine.prefs()`);
  ok('defaults: sound on 100%, haptic on, normal round/difficulty/sensitivity, calm follows system, normal text', d0.sound && d0.vol === 1 && d0.haptic && d0.round === 1 && d0.diff === 1 && d0.sens === 1 && d0.calm === null && !d0.big && d0.effective.roundScale === 1 && d0.effective.textScale === 1, d0);
  await c.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})); document.getElementById('settings').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(100);
  ok('Escape closes the sheet', await c.ev(`document.getElementById('settings').hidden`));

  // الافتراضي: الصوت يصل المخرج، والاهتزاز يعمل، واللعبة ترى القيم العادية
  let r = await probe();
  ok('default: audio reaches the destination at the game volume', r.au.osc > 3 && r.au.dest > 3 && Math.abs(r.au.maxGain - 0.4) < 0.01, r.au);
  ok('default: haptic reaches navigator.vibrate', r.au.vib > 3, r.au);
  ok('api.prefs reaches the game: {roundScale:1, difficulty:1, reducedMotion:false, textScale:1}', r.rep && JSON.stringify(r.rep.prefs) === JSON.stringify({ roundScale: 1, difficulty: 1, reducedMotion: false, textScale: 1 }), r.rep);
  ok('api.prefs is read-only: frozen, writes ignored, api.prefs cannot be replaced', r.rep && r.rep.frozen && r.rep.afterMutate && r.rep.sameObj, r.rep);

  // الصوت: النصف ⇒ الكسب نصف؛ صفر أو مطفأ ⇒ لا مذبذب ولا وصلة إلى المخرج
  await c.ev(`(()=>{const v=document.getElementById('pVol'); v.value=50; v.dispatchEvent(new Event('change'))})()`);
  r = await probe(); ok('volume 50% ⇒ gain halved (0.4 → 0.2)', Math.abs(r.au.maxGain - 0.2) < 0.01 && (await prefs()).vol === 0.5, r.au);
  await c.ev(`(()=>{const v=document.getElementById('pVol'); v.value=0; v.dispatchEvent(new Event('change'))})()`);
  r = await probe(); ok('volume 0 ⇒ no oscillator and no connection to the destination', r.au.osc === 0 && r.au.dest === 0, r.au);
  await c.ev(`(()=>{const v=document.getElementById('pVol'); v.value=80; v.dispatchEvent(new Event('change'))})()`); await tog('pSound', false);
  r = await probe(); ok('sound off ⇒ no oscillator and no connection to the destination', r.au.osc === 0 && r.au.dest === 0 && (await prefs()).sound === false, r.au);
  ok('sound off ⇒ volume slider disabled', await c.ev(`document.getElementById('pVol').disabled`));
  await tog('pSound', true);
  // الاهتزاز
  await tog('pHaptic', false); r = await probe(); ok('haptic off ⇒ navigator.vibrate never called', r.au.vib === 0, r.au);
  await tog('pHaptic', true);

  // مدة الجولة والصعوبة والوميض والنص: تصل اللعبة أرقامًا للقراءة فقط
  await seg('round', 2); await seg('diff', 0); await tog('pCalm', true); await tog('pBig', true);
  r = await probe();
  ok('long + easy + calm + big ⇒ api.prefs {1.5, 0, true, 1.2}, ui.still on', r.rep && JSON.stringify(r.rep.prefs) === JSON.stringify({ roundScale: 1.5, difficulty: 0, reducedMotion: true, textScale: 1.2 }) && r.rep.still === true, r.rep);
  ok('game cannot mutate prefs (still read-only with non-default values)', r.rep && r.rep.frozen && r.rep.afterMutate && r.rep.sameObj);
  ok('calm + big applied to the host page (html.calm, html.big)', await c.ev(`document.documentElement.classList.contains('calm') && document.documentElement.classList.contains('big')`));
  ok('segmented control marks the choice (aria-checked)', await c.ev(`document.querySelector('.seg[data-p=round] [data-v="2"]').getAttribute('aria-checked')==='true' && document.querySelector('.seg[data-p=round] [data-v="1"]').getAttribute('aria-checked')==='false'`));
  // الحفظ بعد إعادة التحميل
  await c.nav(BASE + '/index.html?debug=1', 1800);
  const back = await c.ev(`({p: __engine.prefs(), seg: document.querySelector('.seg[data-p=diff] [data-v="0"]').getAttribute('aria-checked'), calm: document.getElementById('pCalm').checked, big: document.getElementById('pBig').checked, vol: document.getElementById('pVol').value})`);
  ok('settings persist across reload (localStorage engine-prefs)', back.p.round === 2 && back.p.diff === 0 && back.p.calm === true && back.p.big === true && back.p.vol === 0.8 && back.seg === 'true' && back.calm && back.big && back.vol === '80', back);
  await tog('pCalm', false); await tog('pBig', false); await seg('diff', 1);

  // حساسية الكاميرا: في محلّل المضيف لا في اللعبة
  const thr = async v => { await seg('sens', v); return c.ev(`[Analyzer.sensitivity(), Analyzer.threshold({thr:24})]`); };
  const tl = await thr(0), th = await thr(2), tn = await thr(1);
  ok('sensitivity low/normal/high ⇒ tracker motion threshold 36 / 24 / 15.6 (game asked 24)', tl[1] === 36 && tn[1] === 24 && Math.abs(th[1] - 15.6) < 1e-9, { tl, tn, th });
  { // أثر فعلي: حركة خفيفة يراها «عالية» ولا تراها «منخفضة»
    await c.ev(`document.getElementById('synth').checked=true; DebugSynth.state.blobs=[{c:'#5a5a5a',x:.5,y:.5,r:.2,ax:.05,ay:.02,hz:2}]`);
    const energy = async v => { await seg('sens', v); await c.ev(`__engine.events.length=0; __engine.startGame('tests/games/cam-motion-probe.js')`); await wait(`!!(__engine.state()&&__engine.state().ready)`, 10000); await sleep(800);
      let e = 0; for (let k = 0; k < 30; k++) { e += await c.ev(`(()=>{const s=__engine.state(); if(!s) return 0; let m=0; for(const [,t] of s.tracks) if(t.last&&typeof t.last.energy==='number') m=Math.max(m,t.last.energy); return m})()`); await sleep(70); } e = +(e / 30).toFixed(4); /* متوسط 30 عيّنة: قياس لحظة واحدة يتذبذب */
      await c.ev(`__engine.stopGame('exit');__engine.show('menu')`); await sleep(200); return e; };
    const eLow = await energy(0), eHigh = await energy(2); await seg('sens', 1);
    ok('same synthetic motion: high sensitivity measures more motion than low', eHigh > eLow, { eLow, eHigh });
  }

  // مدة الجولة في ألعاب حقيقية: الوقت الأول في HUD
  await seg('round', 0);
  for (const [g, want] of [['games/mole-air.js', '18'], ['games/color-hunt.js', '12']]) {
    await c.ev(`__engine.startGame('${g}')`); await wait(`!!(__engine.state()&&__engine.state().ready)`, 10000); await sleep(400);
    const t = await c.ev(`document.getElementById('hTime').textContent`); ok(g + ': «قصيرة» scales the round time (HUD ' + want + ')', t === want, { t }); await c.ev(`__engine.stopGame('exit');__engine.show('menu')`); await sleep(200);
  }
  await seg('round', 1);
  { const miss = readFileSync(root + 'games/index.txt', 'utf8').split('\n').filter(n => n && !n.startsWith('zz-')).filter(n => !/a\.prefs\.roundScale/.test(readFileSync(root + 'games/' + n, 'utf8')) || !/a\.prefs\.difficulty/.test(readFileSync(root + 'games/' + n, 'utf8')));
    ok('all 14 menu games read api.prefs.roundScale and api.prefs.difficulty', !miss.length, miss); }

  // «مسح بياناتي»
  await c.ev(`localStorage.setItem('myGames', JSON.stringify([{id:'x', text:'// @title t\\n// @capabilities hud\\ndefineGame({})'}])); localStorage.setItem('visitDay','2099-01-01'); localStorage.setItem('engine-camview','0')`);
  await c.ev(`window.confirm=()=>false; document.getElementById('pWipe').click()`); await sleep(300);
  ok('wipe asks first; «إلغاء» keeps everything', (await c.ev(`!!localStorage.getItem('myGames') && !!localStorage.getItem('engine-prefs')`)));
  await c.ev(`window.confirm=()=>true; document.getElementById('pWipe').click()`); await sleep(2000);
  const after = await c.ev(`({keys: Object.keys(localStorage), mine: document.querySelectorAll('#mine .card').length, p: __engine.prefs()})`);
  ok('wipe after confirm: my games, settings and every saved item gone (visit day kept), defaults back', after.keys.length === 1 && after.keys[0] === 'visitDay' && after.mine === 0 && after.p.round === 1 && after.p.vol === 1, after);
  ok('no update bar when there is no new version', await c.ev(`document.getElementById('upd').hidden`));
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
