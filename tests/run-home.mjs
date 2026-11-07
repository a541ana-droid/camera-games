// الرئيسية 0.6.1 وحزم الأسئلة: الأقسام من @play، «نلعب الآن؟» يشغّل لعبة فعلًا، الرقائق، الصور المعتمدة فقط، طول صفحة الجوال،
// وعقد api.pack (مجمّد، مخلوط، منظَّف)، وأسئلة العائلة: إنشاء/استيراد/مشاركة (ملف، رابط #quiz=، QR) ذهابًا وإيابًا، ورفض الاستيراد الملغوم.
import { readFileSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const root = new URL('..', import.meta.url).pathname, rd = f => readFileSync(root + f, 'utf8');
const c = await chrome({ size: '1280,900' }); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + (i === undefined ? '' : '  ' + JSON.stringify(i).slice(0, 400))); };
const wait = async (expr, ms = 8000) => { for (let t = 0; t < ms; t += 150) { if (await c.ev(expr)) return true; await sleep(150); } return false; };
const games = rd('games/index.txt').split('\n').map(s => s.trim()).filter(s => /\.js$/.test(s) && !s.startsWith('zz-'));
const endText = async () => { for (let i = 0; i < 40; i++) { const e = await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`); if (e) return JSON.parse(e.text); await sleep(200); } return null; };
try {
  await c.nav(BASE + '/index.html?debug=1&nosw=1', 1500); await c.ev(`localStorage.clear()`); await c.nav(BASE + '/index.html?nosw=1', 2500);
  // (1) الأقسام والبطاقات
  const sh = await c.ev(`(()=>{const o={}; for (const id of ['shCamera','shPads','shDevice','quizGames']) o[id]=[...document.getElementById(id).querySelectorAll('.card')].map(b=>b.dataset.play+'|'+b.dataset.src); return o})()`);
  const all = Object.values(sh).flat();
  ok('every listed game has exactly one card, in #list', all.length === games.length && (await c.ev(`document.querySelectorAll('#list .card').length`)) === games.length, { n: all.length, games: games.length });
  ok('sections follow @play (camera / pads / device), quiz games in «مسابقات»', sh.shCamera.every(x => x.startsWith('camera|')) && sh.shPads.every(x => x.startsWith('pads|')) && sh.shDevice.every(x => x.startsWith('device|')) && sh.shCamera.length >= 5 && sh.shPads.length >= 3, sh);
  ok('cards show players · minutes · age line', await c.ev(`[...document.querySelectorAll('#list .card')].every(b=>b.querySelector('.meta'))`));
  const imgs = await c.ev(`[...document.querySelectorAll('img')].map(i=>new URL(i.src).pathname)`), allowed = ['/icon.svg', ...['color-hunt', 'freeze', 'mole-air', 'multi-lane', 'tilt-balance'].map(n => '/games/' + n + '.cover.jpg')];
  ok('only approved images (5 covers + icon); no series.jpg anywhere', imgs.every(p => allowed.includes(p)) && !rd('series.js').includes('series.jpg') && !rd('sw.js').includes('series.jpg'), imgs);
  const tabs = await c.ev(`['tabHome','serBtn','tabMake','setBtn'].map(id=>{const b=document.getElementById(id), r=b.getBoundingClientRect(); return [id, r.height>=48 && b.offsetParent!==null]})`);
  ok('tabs: home, league, make, settings reachable (≥48px)', tabs.every(t => t[1]), tabs);
  ok('no old «▶ العب» button that only scrolled', !(await c.ev(`!!document.getElementById('playBtn')`)));
  // (2) الرقائق
  const n0 = await c.ev(`document.querySelectorAll('#list .card').length`);
  await c.ev(`document.querySelector('[data-f=short]').click()`); await sleep(100);
  const short = await c.ev(`[...document.querySelectorAll('#list .shrow .card')].map(b=>+b.dataset.minutes)`);
  ok('chip «أقل من 3 د» keeps only short games', short.length > 0 && short.length < n0 && short.every(m => m && m < 3), short);
  await c.ev(`document.querySelector('[data-f=all]').click()`); await sleep(100);
  ok('chip «الكل» restores every card', (await c.ev(`document.querySelectorAll('#list .shrow .card').length`)) === n0);
  // (3) «نلعب الآن؟» يشغّل لعبة مناسبة فعلًا
  await c.ev(`document.querySelectorAll('#now .pc')[0].click()`); await sleep(50); await c.ev(`document.querySelectorAll('#now .hw')[2].click()`); await sleep(50);
  let pick = await c.ev(`__engine.home.now()`);
  ok('«نلعب الآن؟» 1 player + by phone suggests a device game', !!pick.pick && (await c.ev(`__engine.menuGames.find(g=>g.src===${JSON.stringify(pick.pick)}).meta.play`)) === 'device', pick);
  await c.ev(`document.querySelectorAll('#now .pc')[2].click()`); await sleep(50); await c.ev(`document.querySelectorAll('#now .hw')[1].click()`); await sleep(100);
  pick = await c.ev(`__engine.home.now()`); const p1 = pick.pick;
  await c.ev(`document.getElementById('nowAlt').click()`); await sleep(60);
  ok('«غيرها» changes the suggestion', (await c.ev(`__engine.home.now().pick`)) !== p1, [p1]);
  await c.ev(`document.getElementById('nowGo').click()`); await sleep(800);
  ok('«العب الآن» (pads) opens the TV lobby for that game', await c.ev(`!document.getElementById('tv').hidden && Pads.state().game === __engine.home.now().pick`), await c.ev(`Pads.state()&&Pads.state().game`));
  await c.ev(`Pads.close(); __engine.show('menu')`);
  await c.nav(BASE + '/index.html?debug=1&nosw=1', 2000); await c.ev(`document.getElementById('synth').checked=true`);
  await c.ev(`document.querySelectorAll('#now .pc')[1].click()`); await sleep(50); await c.ev(`document.querySelectorAll('#now .hw')[0].click()`); await sleep(100);
  await c.ev(`__engine.events.length=0; document.getElementById('nowGo').click()`);
  ok('«العب الآن» (camera) really starts a game', await wait(`!!(__engine.state()&&__engine.state().ready)`, 10000), await c.ev(`__engine.home.now()`));
  await c.ev(`__engine.stopGame('exit'); __engine.show('menu')`); await sleep(300);
  // (4) المسابقات: بلاطة لكل فئة + أسئلة العائلة
  const idx = JSON.parse(rd('games/quiz/index.json')).packs;
  ok('quiz bank shipped: 16 categories, 291 questions, every file valid', idx.length === 16 && idx.reduce((a, p) => a + p.count, 0) === 291 && (await c.ev(`Promise.all(${JSON.stringify(idx.map(p => p.id))}.map(id=>QuizPacks.official(id).then(p=>p.questions.length)))`)).reduce((a, b) => a + b, 0) === 291);
  ok('«مسابقات»: one tile per category + «أسئلة العائلة»', await wait(`document.querySelectorAll('#quizTiles .qtile[data-pack]').length === ${idx.length} && !!document.getElementById('famTile')`, 4000));
  ok('sw.js caches the quiz files', /games\/quiz\/index\.json/.test(rd('sw.js')) && /games\/quiz\/' \+ id \+ '\.json/.test(rd('sw.js')));
  // (5) عقد api.pack بلعبة فحص
  const run = async (pack) => { await c.ev(`__engine.events.length=0; __engine.launch('tests/games/pack-probe.js', __engine.parseHeader('// @pack quiz\\n// @capabilities hud'), ${pack})`); const r = await endText(); await c.ev(`__engine.stopGame('exit'); __engine.show('menu')`); await sleep(200); return r; };
  const ani = await c.ev(`QuizPacks.official('ani').then(p=>JSON.stringify({id:p.id,title:p.name,questions:p.questions}))`);
  const r1 = await run(ani), r2 = await run(ani);
  ok('api.pack: {id,title,questions[{q,choices,answer,explain?,kid?}]} from the chosen category', r1 && r1.id === 'ani' && r1.title === 'حيوانات' && r1.n === 20 && JSON.stringify(r1.keys) === '["id","questions","title"]' && r1.qkeys.every(k => ['q', 'choices', 'answer', 'explain', 'kid'].includes(k)), r1);
  ok('api.pack is deeply frozen (mutation has no effect)', r1.frozen && r1.first.q !== 'hacked' && r1.n === 20, r1.first);
  ok('questions are shuffled per run', JSON.stringify(r1.order) !== JSON.stringify(r2.order) && [...r1.order].sort().join() === [...r2.order].sort().join());
  const kid = await run(await c.ev(`QuizPacks.official('kid').then(p=>JSON.stringify({id:p.id,title:p.name,questions:p.questions}))`));
  ok('kid flag carried for 4-7 questions', kid && kid.kid === kid.n && kid.n === 20, kid);
  const mix = await run('null');
  ok('a @pack game launched from its card gets the mixed bank («منوّعة», no kid)', mix && mix.id === 'mix' && mix.n === 40 && mix.kid < 40, mix);
  // (6) تحقق صارم: استيراد ملغوم
  const bad = await c.ev(`(()=>{const C=QuizPacks.clean, q=(x)=>({name:'t',questions:[x]}), long='أ'.repeat(141);
    const big={name:'big',questions:Array.from({length:10000},()=>({q:'س',choices:['a','b'],answer:0}))};
    const proto=JSON.parse('{"name":"p","__proto__":{"polluted":1},"constructor":{"prototype":{"polluted":1}},"questions":[{"q":"ok?","choices":["a","b"],"answer":0,"__proto__":{"polluted":1},"extra":"<script>"}]}');
    const r={
      notJson:C('}{ not json').ok, num:C(42).ok, noName:C({questions:[{q:'a',choices:['a','b'],answer:0}]}).ok, noQs:C({name:'x',questions:[]}).ok, tooMany:C(big).ok, huge:C('x'.repeat(1100000)).ok,
      longQ:C(q({q:long,choices:['a','b'],answer:0})).ok, oneChoice:C(q({q:'a',choices:['a'],answer:0})).ok, fiveChoices:C(q({q:'a',choices:['a','b','c','d','e'],answer:0})).ok,
      dupChoices:C(q({q:'a',choices:['a','a'],answer:0})).ok, badAnswer:C(q({q:'a',choices:['a','b'],answer:2})).ok, floatAnswer:C(q({q:'a',choices:['a','b'],answer:0.5})).ok, strAnswer:C(q({q:'a',choices:['a','b'],answer:'0'})).ok,
      objChoice:C(q({q:'a',choices:[{toString(){return 'x'}},'b'],answer:0})).ok, longChoice:C(q({q:'a',choices:['b'.repeat(61),'c'],answer:0})).ok };
    const p=C(proto), bidi=C({name:'\\u202Eabc\\u0007',questions:[{q:'<img src=x onerror=alert(1)>\\u2066',choices:['<b>a</b>','b'],answer:0}]});
    return {r, proto: p.ok && Object.keys(p.pack).join()==='name,questions' && Object.keys(p.pack.questions[0]).join()==='q,choices,answer' && ({}).polluted===undefined && Object.prototype.polluted===undefined,
      bidi: bidi.pack.name==='abc' && bidi.pack.questions[0].q==='<img src=x onerror=alert(1)>', mixed: C({name:'m',questions:[{q:'a',choices:['a','b'],answer:0},{q:'',choices:['a','b'],answer:0}]})}})()`);
  ok('malicious/invalid imports rejected (non-JSON, no name, empty, >200 questions, >1MB, bad lengths/choices/answers)', Object.values(bad.r).every(v => v === false), bad.r);
  ok('import copies whitelisted fields only (__proto__/constructor/extra ignored, no prototype pollution)', bad.proto);
  ok('control and bidi-override characters stripped; HTML kept as plain text', bad.bidi);
  ok('a pack with some bad questions keeps the good ones and reports the rest', bad.mixed.ok && bad.mixed.pack.questions.length === 1 && bad.mixed.warn.length === 1, bad.mixed);
  // (7) أسئلة العائلة: إنشاء من المحرّر
  await c.ev(`QuizPacks.open(); document.getElementById('famNew').click()`); await sleep(200);
  await c.ev(`(()=>{const set=(el,v)=>{el.value=v; el.dispatchEvent(new Event('input'))}; set(document.getElementById('famName'),'<img src=x onerror="window.__xss=1">بيتنا');
    const fs=document.querySelector('#famQs fieldset'); set(fs.querySelector('textarea'),'كم عدد أيام الأسبوع؟'); const ins=fs.querySelectorAll('.fch input.fin'); set(ins[0],'5'); set(ins[1],'7'); })()`);
  await c.ev(`document.getElementById('famSave').click()`); await sleep(100);
  ok('editor validates: missing correct answer is reported, nothing saved', /الإجابة الصحيحة/.test(await c.ev(`document.getElementById('famErr').textContent`)) && (await c.ev(`QuizPacks.list().length`)) === 0);
  await c.ev(`document.querySelectorAll('#famQs fieldset .fch input[type=radio]')[1].click(); document.getElementById('famAddQ').click()`); await sleep(100);
  await c.ev(`(()=>{const set=(el,v)=>{el.value=v; el.dispatchEvent(new Event('input'))}; const fs=document.querySelectorAll('#famQs fieldset')[1]; set(fs.querySelector('textarea'),'ما لون السماء الصافية؟'); const ins=fs.querySelectorAll('.fch input.fin'); set(ins[0],'أخضر'); set(ins[1],'أزرق'); set(ins[2],'أحمر'); fs.querySelectorAll('input[type=radio]')[1].click(); })()`);
  await c.ev(`document.getElementById('famSave').click()`); await sleep(200);
  const saved = await c.ev(`QuizPacks.list()`);
  ok('editor saves the family pack on this device', saved.length === 1 && saved[0].questions.length === 2 && saved[0].questions[0].answer === 1 && saved[0].questions[1].choices.length === 3 && !saved[0].imported, saved);
  ok('pack name with HTML rendered as text (textContent), no injection', (await c.ev(`!window.__xss && !document.querySelector('#famPage img') && document.querySelector('#famList .fpack b').textContent.startsWith('<img')`)));
  await sleep(300); ok('family pack appears as a quiz tile', await c.ev(`!!document.querySelector('#quizTiles .qtile[data-pack=u]')`));
  // (8) مشاركة: ملف ورابط وQR، ذهابًا وإيابًا
  const rt = await c.ev(`(async()=>{const p=QuizPacks.list()[0]; const f=QuizPacks.clean(QuizPacks.exportFile(p)); const code=await QuizPacks.encode(p); const back=QuizPacks.clean(await QuizPacks.decode(code));
    return {file: f.ok && JSON.stringify(f.pack.questions)===JSON.stringify(p.questions) && f.pack.name===p.name, link: back.ok && JSON.stringify(back.pack.questions.map(q=>[q.q,q.choices,q.answer]))===JSON.stringify(p.questions.map(q=>[q.q,q.choices,q.answer])), code: code.slice(0,2), len: code.length}})()`);
  ok('round-trip: exported file and compressed link decode to the same questions', rt.file && rt.link && rt.code === '1.', rt);
  await c.ev(`QuizPacks.share(QuizPacks.list()[0])`); await sleep(1000);
  const sd = await c.ev(`(()=>{const d=document.getElementById('famShare'); return {link: document.getElementById('shLink').value, qr: +d.dataset.qr||0, qrShown: !document.getElementById('shQr').hidden, file: !!document.getElementById('shFile')}})()`);
  ok('share sheet: file button, link with #quiz=, QR drawn for a small pack', sd.file && /#quiz=1\./.test(sd.link) && sd.qr > 0 && sd.qrShown, sd);
  await c.ev(`document.getElementById('famShare').close()`);
  const bigLen = await c.ev(`(async()=>{const qs=Array.from({length:60},(_,i)=>({q:'سؤال طويل نسبيًا رقم '+i+' عن موضوع عائلي مختلف كل مرة '+Math.random().toString(36),choices:['اختيار أول '+Math.random().toString(36),'اختيار ثانٍ '+Math.random().toString(36),'ثالث','رابع'],answer:i%4})); QuizPacks.save({name:'كبيرة',questions:qs}); await QuizPacks.share(QuizPacks.list()[0]); await new Promise(r=>setTimeout(r,800)); const d=document.getElementById('famShare'); const r={len:+d.dataset.len, qr:!document.getElementById('shQr').hidden, note:document.getElementById('shNote').textContent}; d.close(); QuizPacks.remove(QuizPacks.list()[0].id); return r})()`);
  ok('large pack: no QR, user told to use the link or file', !bigLen.qr && /QR|الملف/.test(bigLen.note), bigLen);
  // استيراد بالرابط على جهاز آخر (ملف تعريف نظيف): معاينة أولًا، لا حفظ قبل الموافقة
  await c.ev(`QuizPacks.remove(QuizPacks.list()[0].id)`); // نحاكي جهازًا لا يملك الفئة
  await c.nav(sd.link.replace(/^http:\/\/[^/]+\/index\.html/, BASE + '/index.html?nosw=1'), 2500);
  const pv = await c.ev(`({dlg: !!document.getElementById('famImport'), saved: QuizPacks.list().length, hash: location.hash, txt: (document.getElementById('famImport')||{}).textContent||''})`);
  ok('opening a #quiz= link shows a preview, saves nothing, clears the hash', pv.dlg && pv.saved === 0 && pv.hash === '' && /سؤالًا/.test(pv.txt), pv);
  await c.ev(`document.getElementById('impSave').click()`); await sleep(200);
  const imp = await c.ev(`QuizPacks.list()`);
  ok('«احفظ» stores it marked imported', imp.length === 1 && imp[0].imported && imp[0].questions.length === 2, imp);
  ok('opening the same link again: «already have it», no duplicate save button', await c.ev(`(QuizPacks.preview(QuizPacks.clean(QuizPacks.exportFile(QuizPacks.list()[0])),'x'), !!document.getElementById('impDup') && !document.getElementById('impSave'))`));
  await c.ev(`document.getElementById('impCancel').click()`);
  await c.nav(BASE + '/index.html?nosw=1#quiz=1.AAAA____', 2000);
  ok('broken link: error shown, nothing saved', await c.ev(`!!document.getElementById('impErr') && QuizPacks.list().length===1`));
  // ملف ملغوم عبر الاستيراد بالملف نفسه
  const bomb = await c.ev(`(async()=>{const a=new Uint8Array(3e6); const s=new Blob([a]).stream().pipeThrough(new CompressionStream('deflate-raw')); const u=new Uint8Array(await new Response(s).arrayBuffer()); let b=''; for (const x of u) b+=String.fromCharCode(x); const code='1.'+btoa(b).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''); try { await QuizPacks.decode(code); return 'decoded'; } catch(e) { return 'rejected'; }})()`);
  ok('decompression bomb (3MB of zeros) rejected at the 1MB cap', bomb === 'rejected', bomb);
  // (9) طول صفحة الجوال
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await c.nav(BASE + '/index.html?nosw=1', 2500);
  const ph = await c.ev(`({h: document.getElementById('menu').scrollHeight, hs: document.documentElement.scrollWidth <= 390 && document.getElementById('menu').scrollWidth <= 390, bar: getComputedStyle(document.getElementById('tabs')).position, min: Math.min(...[...document.querySelectorAll('#menu button')].filter(b=>b.offsetWidth&&!b.closest('[hidden]')).map(b=>Math.min(b.getBoundingClientRect().height, b.getBoundingClientRect().width)))})`);
  ok('phone 390: page far shorter than 6695px, no horizontal page scroll, bottom tab bar, targets ≥44px', ph.h < 3200 && ph.hs && ph.bar === 'fixed' && ph.min >= 44, ph);
  // (10) «مسح بياناتي» يمسح أسئلة العائلة
  await c.ev(`__engine.wipeMine()`); ok('«مسح بياناتي» also wipes family packs', (await c.ev(`QuizPacks.list().length`)) === 0);
  ok('no page errors', !c.log.some(l => /exception/i.test(l)), c.log.filter(l => /exception/i.test(l)).slice(0, 3));
} catch (e) { fails++; console.log('FAIL exception', e.message); }
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); c.close(); process.exit(fails ? 1 : 0);
