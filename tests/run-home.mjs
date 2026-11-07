// الرئيسية 0.7.0 وحزم الأسئلة: بطاقات مربّعة بلون اللعبة، صف فئات واحد من @play، ورقة تفاصيل «العب» تشغّل فعلًا، رجوع ظاهر في كل صفحة فرعية، صفحة «على التلفاز»، لا عدّاد زوّار، «تواصل معنا»، الصور المعتمدة فقط،
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
  await c.nav(BASE + '/index.html?debug=1&nosw=1', 1500); await c.ev(`localStorage.clear()`); await c.nav(BASE + '/index.html?nosw=1&net=bc', 2500); // net=bc: ردهة التلفاز بلا مرحّلات خارجية في الاختبار
  // (1) البطاقات: بطاقة واحدة لكل لعبة في #list، بلونها واسمها وسطرها القصير وشارة اللاعبين
  const cards = await c.ev(`[...document.querySelectorAll('#list .card')].map(b=>({src:b.dataset.src, play:b.dataset.play, ac:b.style.getPropertyValue('--ac'), bg:getComputedStyle(b).backgroundImage, name:(b.querySelector('b')||{}).textContent||'', d:(b.querySelector('small.d')||{}).textContent||'', pb:!!b.querySelector('.pb'), players:b.dataset.players}))`);
  ok('every listed game has exactly one card, in #list', cards.length === games.length && new Set(cards.map(x => x.src)).size === games.length, { n: cards.length, games: games.length });
  ok('each card: accent color + gradient background + name + short line (+ players badge when known)', cards.every(x => /^#[0-9a-f]{6}$/.test(x.ac) && /gradient/.test(x.bg) && x.name.trim() && x.d.trim() && (!x.players || x.pb)), cards.filter(x => !(x.ac && x.name && x.d)));
  ok('short line is clamped (≤2 lines) and shorter than the full @desc', await c.ev(`[...document.querySelectorAll('#list .card small.d')].every(s=>getComputedStyle(s).webkitLineClamp==='2')`));
  const imgs = await c.ev(`[...document.querySelectorAll('img')].map(i=>new URL(i.src).pathname)`), allowed = ['/icon.svg', '/art/league.cover.jpg', ...(await c.ev(`__engine.covers()`)).map(n => '/games/' + n + '.cover.jpg')];
  ok('only approved images (COVERS + league + icon), every listed game has an approved cover; no series.jpg anywhere', imgs.every(p => allowed.includes(p)) && !rd('series.js').includes('series.jpg') && !rd('sw.js').includes('series.jpg') && games.every(g => allowed.includes('/games/' + g.replace(/\.js$/, '.cover.jpg'))), imgs);
  const tabs = await c.ev(`['tabHome','serBtn','tabMake','setBtn','tvGuideBtn'].map(id=>{const b=document.getElementById(id), r=b.getBoundingClientRect(); return [id, r.height>=44 && b.offsetParent!==null]})`);
  ok('nav: home, league, make, settings + «على التلفاز» reachable (≥44px)', tabs.every(t => t[1]), tabs);
  ok('no «نلعب الآن؟» wizard, no filter-chip row, no shelves', await c.ev(`!document.getElementById('now') && !document.getElementById('chips') && !document.querySelector('.shelf,.fchip,#nowGo')`));
  // (2) صف الفئات الواحد
  const cats = await c.ev(`[...document.querySelectorAll('#cats [role=tab]')].map(b=>b.dataset.cat+':'+b.textContent.trim())`);
  ok('one row of 5 category tabs: الكل · أمام الكاميرا · الجوالات أذرع · بيد الجوال · مسابقات', cats.join('|') === 'all:الكل|camera:أمام الكاميرا|pads:الجوالات أذرع|device:بيد الجوال|quiz:مسابقات', cats);
  const vis = () => c.ev(`[...document.querySelectorAll('#list .card')].filter(b=>!b.hidden&&b.offsetParent).map(b=>b.dataset.play+'|'+b.dataset.src)`);
  const quizSrcs = await c.ev(`__engine.menuEntries.filter(e=>e.quiz).map(e=>e.src)`);
  const byCat = {};
  for (const k of ['camera', 'pads', 'device', 'quiz']) { await c.ev(`document.getElementById('cat-${k}').click()`); await sleep(120); byCat[k] = { v: await vis(), sel: await c.ev(`document.getElementById('cat-${k}').getAttribute('aria-selected')`), quizBox: await c.ev(`!document.getElementById('quizBox').hidden`) }; }
  ok('«أمام الكاميرا» / «الجوالات أذرع» / «بيد الجوال» show only their @play games (quiz games excluded)', ['camera', 'pads', 'device'].every(k => byCat[k].v.length && byCat[k].v.every(x => x.startsWith(k + '|') && !quizSrcs.includes(x.split('|')[1])) && byCat[k].sel === 'true' && !byCat[k].quizBox) && byCat.camera.v.length >= 5 && byCat.pads.v.length >= 3, Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v.v.length])));
  ok('«مسابقات»: quiz games + category tiles', byCat.quiz.v.length === quizSrcs.length && byCat.quiz.quizBox, byCat.quiz);
  await c.ev(`document.getElementById('cat-all').click()`); await sleep(120);
  ok('«الكل» shows every card again', (await vis()).length === games.length);
  // (3) ورقة التفاصيل: الشرح كاملًا + «العب» يشغّل اللعبة فعلًا
  const sheetSrc = byCat.pads.v[0].split('|')[1];
  await c.ev(`document.querySelector('#list .card[data-src="${sheetSrc}"]').click()`); await sleep(300);
  const sh = await c.ev(`(()=>{const s=document.getElementById('gsheet'); return s && {src:s.dataset.src, title:s.querySelector('h3').textContent, desc:(document.getElementById('gsD')||{}).textContent||'', meta:s.querySelector('.meta').textContent, play:!!document.getElementById('gsPlay'), focus:document.activeElement&&document.activeElement.id}})()`);
  const fullDesc = /@desc (.*)/.exec(rd(sheetSrc))[1];
  ok('tapping a card opens the details sheet: full explanation, players/minutes/age, big «العب» (focused)', sh && sh.src === sheetSrc && sh.desc === fullDesc && /لاعب/.test(sh.meta) && /د/.test(sh.meta) && sh.play && sh.focus === 'gsPlay', sh);
  await c.ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(100);
  ok('Escape closes the sheet, focus returns to the card', await c.ev(`!document.getElementById('gsheet') && document.activeElement && document.activeElement.dataset.src===${JSON.stringify(sheetSrc)}`));
  const padSrc = byCat.pads.v[1].split('|')[1];
  await c.ev(`__engine.home.open(${JSON.stringify(padSrc)})`); await sleep(200); await c.ev(`document.getElementById('gsPlay').click()`); await sleep(800);
  ok('pads game: «العب» opens the TV lobby for that game', await c.ev(`!document.getElementById('tv').hidden && Pads.state().game === ${JSON.stringify(padSrc)} && !document.getElementById('gsheet')`), await c.ev(`Pads.state()&&Pads.state().game`));
  ok('lobby: back control + «كيف أشغّلها على التلفاز؟» at the top', await c.ev(`(()=>{const b=document.getElementById('tvBack'), g=document.getElementById('tvHow'); return !!b && !!g && b.getBoundingClientRect().top < 120 && g.offsetParent!==null})()`));
  await c.ev(`document.getElementById('tvHow').click()`); await sleep(200);
  ok('lobby guide opens over the room (room kept)', await c.ev(`!!document.getElementById('guideDlg') && document.querySelectorAll('#guideDlg .gway').length===3 && !!Pads.state()`));
  await c.ev(`document.querySelector('#guideDlg .back').click(); Pads.close(); __engine.show('menu')`);
  await c.nav(BASE + '/index.html?debug=1&nosw=1', 2000); await c.ev(`document.getElementById('synth').checked=true`);
  await c.ev(`__engine.events.length=0; document.querySelector('#list .card[data-src="games/balloon-bop.js"]').click()`); await sleep(200); await c.ev(`document.getElementById('gsPlay').click()`);
  ok('camera game: «العب» in the sheet really starts it', await wait(`!!(__engine.state()&&__engine.state().ready)`, 10000) && (await c.ev(`__engine.state().src`)) === 'games/balloon-bop.js');
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
  // (9) الجوال 375×812: عمودان من بطاقات مربّعة، رجوع ظاهر في كل صفحة فرعية، صفحة التلفاز، لا عدّاد زوّار، «تواصل معنا»
  await c.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await c.nav(BASE + '/index.html?nosw=1', 2500);
  const ph = await c.ev(`(()=>{const l=document.getElementById('list'), cs=[...l.querySelectorAll('.card')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()); return {cols:getComputedStyle(l).gridTemplateColumns.split(' ').length, sq:cs.every(r=>Math.abs(r.width-r.height)<2), w:Math.round(cs[0].width), hs: document.documentElement.scrollWidth <= 375 && document.getElementById('menu').scrollWidth <= 375, bar:getComputedStyle(document.getElementById('tabs')).position, min:Math.min(...[...document.querySelectorAll('#menu button')].filter(b=>b.offsetWidth&&!b.closest('[hidden]')&&!b.classList.contains('card')).map(b=>Math.min(b.getBoundingClientRect().height, b.getBoundingClientRect().width))), firstCardTop: Math.round(cs[0].top)}})()`);
  ok('phone 375: grid of 2 square cards per row, games visible in the first screen, no horizontal scroll, bottom tab bar, targets ≥44px', ph.cols === 2 && ph.sq && ph.w > 140 && ph.firstCardTop < 330 && ph.hs && ph.bar === 'fixed' && ph.min >= 44, ph);
  await c.ev(`document.getElementById('serBtn').click()`); await sleep(1500);
  const lg = await c.ev(`(()=>{const b=document.getElementById('serBack'); if(!b) return null; const r=b.getBoundingClientRect(); return {top:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height), vis:!document.getElementById('ser').hidden}})()`);
  ok('league («الدوري») on 375: back control visible at the top immediately', lg && lg.vis && lg.top >= 0 && lg.top < 100 && lg.w >= 44 && lg.h >= 44, lg);
  await c.ev(`document.getElementById('ser').scrollTop=2000`); await sleep(100);
  ok('league back stays reachable after scrolling (sticky)', await c.ev(`(()=>{const r=document.getElementById('serBack').getBoundingClientRect(); return r.top>=0 && r.bottom<120})()`));
  await c.ev(`document.getElementById('serBack').click()`); await sleep(200);
  ok('league back returns to the home', await c.ev(`!document.getElementById('menu').hidden && document.getElementById('ser').hidden`));
  for (const [open, id, name] of [[`document.getElementById('tabMake').click()`, 'makePage', 'make'], [`QuizPacks.open()`, 'famPage', 'quiz packs'], [`document.getElementById('tvGuideBtn').click()`, 'tvGuide', 'TV guide']]) {
    await c.ev(open); await sleep(250);
    const r = await c.ev(`(()=>{const p=document.getElementById('${id}'), b=p&&p.querySelector('.back'); if(!b||p.hidden) return null; const q=b.getBoundingClientRect(); return {top:Math.round(q.top), w:Math.round(q.width)}})()`);
    ok(`${name} page on 375: back control at the top`, r && r.top >= 0 && r.top < 200 && r.w >= 44, r);
    if (id !== 'tvGuide') await c.ev(`CGHome.go('home')`);
  }
  const gd = await c.ev(`(()=>{const g=document.getElementById('tvGuide'); return {site: document.getElementById('gSite').textContent, ways: g.querySelectorAll('.gway').length, tv: !!g.querySelector('#tvBtn'), join: !!g.querySelector('#joinBtn'), steps: g.querySelectorAll('.gway li').length, txt: g.textContent}})()`);
  ok('TV guide: site address, 3 ways (smart-TV browser, HDMI, mirroring), numbered steps, open-screen + join buttons', gd.site === 'a541ana-droid.github.io/camera-games' && gd.ways === 3 && gd.steps >= 10 && gd.tv && gd.join && /HDMI/.test(gd.txt) && /AirPlay/.test(gd.txt) && /Miracast/.test(gd.txt) && /Chromecast/.test(gd.txt) && /انضم برمز/.test(gd.txt) && /إنترنت/.test(gd.txt) && /issues\/new/.test(await c.ev(`document.querySelector('#tvGuide a[href*="issues"]').href`)), { site: gd.site, ways: gd.ways, steps: gd.steps });
  await c.ev(`document.getElementById('joinBtn').click()`); await sleep(400);
  ok('guide «انضم برمز» opens the phone join screen', await c.ev(`!document.getElementById('pad').hidden && !!document.querySelector('#pad .pcode')`));
  await c.nav(BASE + '/index.html?nosw=1', 2000);
  await c.ev(`document.getElementById('footGuide').click()`); await sleep(200);
  ok('footer link opens the TV guide too', await c.ev(`!document.getElementById('tvGuide').hidden`));
  await c.ev(`CGHome.go('home'); document.getElementById('setBtn').click()`); await sleep(300);
  const st = await c.ev(`(()=>{const s=document.getElementById('settings'), b=document.getElementById('setClose').getBoundingClientRect(); return {back: b.top>=0 && b.top<100, stats: !!document.getElementById('stats') || /زوّار الموقع/.test(document.body.innerHTML), issue: !!s.querySelector('#gContact ~ a, #gContact')&&!!s.querySelector('a[href="https://github.com/a541ana-droid/camera-games/issues/new"]'), mail: document.getElementById('mailL').hidden, html: s.innerHTML + document.getElementById('tvGuide').innerHTML + document.querySelector('.foot').innerHTML}})()`); st.at = /@|mailto/.test(st.html.replace(/https:\/\/[^"]*/g, '')); delete st.html;
  ok('settings: back control at the top; no visitor counter anywhere; «تواصل معنا» with GitHub Issues; e-mail line hidden (CONTACT_EMAIL empty)', st.back && !st.stats && st.issue && st.mail && !st.at, st);
  ok('visitor counter: hit/ once a day only, never get/, nothing rendered', /'hit\/'/.test(rd('engine.js')) && !/'get\/'/.test(rd('engine.js')) && !/statsL|id="stats"/.test(rd('index.html')));
  await c.ev(`document.getElementById('setClose').click()`);
  // التلفاز/الشاشة الكبيرة: 6 أعمدة
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await c.nav(BASE + '/index.html?nosw=1', 2000);
  ok('1920×1080: 6 cards per row', (await c.ev(`getComputedStyle(document.getElementById('list')).gridTemplateColumns.split(' ').length`)) === 6);
  // (10) «مسح بياناتي» يمسح أسئلة العائلة
  await c.ev(`__engine.wipeMine()`); ok('«مسح بياناتي» also wipes family packs', (await c.ev(`QuizPacks.list().length`)) === 0);
  ok('no page errors / console errors', !c.log.some(l => /exception|log\.error|console\.error/i.test(l)), c.log.filter(l => /exception|error/i.test(l)).slice(0, 3));
} catch (e) { fails++; console.log('FAIL exception', e.message); }
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); c.close(); process.exit(fails ? 1 : 0);
