// لقطات الرئيسية 0.6.1 للمراجعة: node tests/home-shots.mjs [مجلد]  (CDP_PORT منفصل)
import { writeFileSync, mkdirSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const OUT = process.argv[2] || new URL('./shots', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const c = await chrome({ size: '1440,900' });
const metrics = (w, h, mobile) => c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
const shot = async (n, full) => {
  let clip; if (full) { const H = await c.ev(`Math.ceil(document.getElementById('menu').scrollHeight)`); await c.send('Emulation.setDeviceMetricsOverride', { width: full, height: H, deviceScaleFactor: 1, mobile: full < 700 }); await sleep(400); }
  writeFileSync(OUT + '/' + n + '.png', Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
};
try {
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await metrics(1440, 900, false); await c.nav(BASE + '/index.html?nosw=1', 2500); await shot('home-1440', 1440);
  await metrics(390, 844, true); await c.nav(BASE + '/index.html?nosw=1', 2500); await shot('home-390-top');
  const H = await c.ev(`document.getElementById('menu').scrollHeight`); console.log('390 page height', H); await shot('home-390', 390);
  await metrics(390, 844, true); await c.ev(`document.getElementById('shQuiz').scrollIntoView()`); await sleep(300); await shot('quiz-packs');
  await c.ev(`QuizPacks.save({name:'أسئلة بيتنا',questions:[{q:'كم عدد أيام الأسبوع؟',choices:['5','7','10'],answer:1},{q:'ما لون السماء صافية؟',choices:['أزرق','أخضر','أحمر','بني'],answer:0,explain:'بسبب تشتت الضوء'}]})`);
  await c.ev(`QuizPacks.edit(QuizPacks.list()[0]); CGHome.go('famPage')`); await sleep(400); await shot('family-pack-editor');
  await c.ev(`QuizPacks.open(); QuizPacks.share(QuizPacks.list()[0])`); await sleep(1200); await shot('share-qr');
  await metrics(1440, 900, false); await c.nav(BASE + '/index.html?nosw=1', 2000); await c.ev(`document.getElementById('shQuiz').scrollIntoView()`); await sleep(300); await shot('quiz-packs-1440');
  console.log(c.log.filter(l => /exception|error/i.test(l)).slice(0, 5));
} finally { c.close(); process.exit(0); }
