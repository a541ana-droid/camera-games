#!/usr/bin/env node
// محقّق ساكن لملف لعبة قبل التحميل. طبقة مساعدة فقط — الحدّ الأمني هو عزل Worker (iframe معزول + CSP + تعطيل globals + terminate) لا هذا الفحص.
// الاستعمال: node tools/check-game.mjs game.js [أخرى.js ...]   (يخرج بـ1 إن وُجد خطأ)
import { readFileSync } from 'node:fs';
// القائمتان تُقرآن من engine.js نفسه كي لا يتأخر المحقّق عن المحرك (كان نسخة يدوية فتخلّف عن audio.mic)
const ENG = readFileSync(new URL('../engine.js', import.meta.url), 'utf8'), list = k => JSON.parse(new RegExp('const ' + k + ' = (\\[[^\\]]*\\])').exec(ENG)[1].replace(/'/g, '"'));
const KNOWN = list('KNOWN'), PLANNED = list('PLANNED'), PLAYS = list('PLAYS'), STYLES = list('STYLES');
const FORBID = [[/\bfetch\s*\(/, 'fetch'], [/XMLHttpRequest/, 'XMLHttpRequest'], [/\bWebSocket\b/, 'WebSocket'], [/\bEventSource\b/, 'EventSource'], [/sendBeacon/, 'sendBeacon'],
  [/\bimport\b/, 'الكلمة import (المحرك يرفض الملف كله)'], [/\beval\s*\(/, 'eval'], [/\bnew\s+Function\b|\bFunction\s*\(/, 'Function()'],
  [/\b(window|self|globalThis)\.(parent|top|opener|frameElement)\b/, 'parent/top/opener'], [/document\.cookie/, 'document.cookie'], [/\b(localStorage|sessionStorage|indexedDB|caches)\b/, 'تخزين'],
  [/getUserMedia|mediaDevices/, 'getUserMedia (الكاميرا للمحرك وحده)'], [/\bwindow\.open\b|\bopen\s*\(\s*['"]/, 'window.open'], [/\bnew\s+(Shared)?Worker\b|importScripts/, 'Worker'],
  [/\blocation\s*(\.|=)|document\.location/, 'location (تغيير الصفحة)'], [/navigator\.serviceWorker/, 'serviceWorker'], [/document\.write/, 'document.write'], [/\bpostMessage\s*\(/, 'postMessage (استعمل api فقط)'],
  [/\b(window|document)\s*[.\[]/, 'window/document (اللعبة تعمل في Worker بلا DOM)'], [/\b(getImageData|putImageData|createImageData|createPattern|Path2D|isPointInPath|isPointInStroke|getTransform)\b/, 'ميزة Canvas غير مدعومة في ctx (انظر ENGINE.md §3)'], [/\bnew\s+Image\b|OffscreenCanvas|createElement/, 'DOM/صور (استعمل // @assets و api.assets.image)'], [/\b(innerWidth|innerHeight|devicePixelRatio)\b/, 'innerWidth/Height (استعمل api.view.size() أو w,h في render)']];
const WARN = [[/while\s*\(\s*(true|1)\s*\)|for\s*\(\s*;\s*;\s*\)/, 'حلقة قد لا تنتهي — الحارس سيغلق اللعبة'], [/setInterval\s*\(/, 'setInterval — استعمل update(dt)'], [/requestAnimationFrame/, 'requestAnimationFrame — المحرك يملك الحلقة'], [/<script|innerHTML/, 'DOM — لا حاجة له: ارسم على ctx']];
const CAPMAP = [[/api\.view\.showCamera/, 'camera.view'], [/api\.track\.color\b/, 'camera.color'], [/api\.track\.motion\b/, 'camera.motion'], [/api\.track\.lanes\b/, 'camera.lanes'], [/api\.track\.colorPerPlayer\b/, 'camera.playercolors'], [/api\.camera\.lowres/, 'camera.lowres'], [/api\.calibrate\./, 'camera.calibrate'], [/api\.audio\./, 'audio'], [/api\.haptic/, 'haptic'], [/api\.hud\./, 'hud'], [/api\.players\.local/, 'players.local'], [/api\.sensors\.motion/, 'motion.device'], [/api\.mic\./, 'audio.mic'], [/api\.pads\./, 'players.pads']];
// عُدّة الواجهة api.ui (runtime.js): القائمة تُطابَق في tests/run-kit.mjs بمفاتيح الكائن الفعلي فلا تتأخر عنه
const KIT = ['theme', 'safe', 'num', 'hit', 'row', 'background', 'text', 'title', 'bigText', 'meter', 'progress', 'shape', 'playerChip', 'button', 'results', 'countdown', 'pop', 'flash', 'cancel', 'draw', 'still', 'counting', 't', 'unit'];
const PREFS = ['roundScale', 'difficulty', 'reducedMotion', 'textScale']; // = مفاتيح api.prefs في runtime.js
const PLANMAP = [[/api\.qr\b/, 'qr.show'], [/api\.players\.network/, 'players.network'], [/api\.hand\b/, 'hand'], [/api\.pose\b/, 'pose']];
const HOWACTS = ['wave', 'wave-lane', 'freeze', 'show-color', 'tilt', 'hand-zone', 'block', 'dodge', 'pop', 'push-up', 'joystick', 'tap-beat', 'react', 'tap', 'voice', 'simon']; // = ACTS في runtime.js (يتحقق run-kit من التطابق)
let bad = 0;
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8'), errs = [], warns = [];
  const head = {}; for (const l of src.split('\n', 40)) { const m = /^\/\/\s*@([\w-]+)\s*(.*)$/.exec(l.trim()); if (m) head[m[1]] = m[2].trim(); }
  const caps = (head.capabilities || '').split(/\s+/).filter(Boolean);
  if (!('capabilities' in head)) errs.push('لا يوجد سطر // @capabilities في الرأس');
  if (!head.title) warns.push('لا يوجد // @title');
  if (head.engine && head.engine.split('.')[0] !== '0') errs.push('@engine ' + head.engine + ' لا يطابق المحرك 0.x');
  // الشرح القصير قبل اللعب (0.5.1): جملة قصيرة + فعل من المجموعة المغلقة (ENGINE.md §1)
  if (!head.howto) warns.push('لا يوجد // @howto: أضف جملة أمر قصيرة لطفل (≤40 حرفًا) فيظهر شرح متحرّك قبل اللعب (ENGINE.md §1)');
  else if ([...head.howto].length > 40) warns.push('@howto طويلة (' + [...head.howto].length + ' حرفًا): الأقصر أوضح للطفل (≤40)؛ تُقصّ عند 60');
  if (head['howto-act'] && !HOWACTS.includes(head['howto-act'])) errs.push('@howto-act «' + head['howto-act'] + '» ليس من الأفعال المعروفة: ' + HOWACTS.join(' '));
  if (head.howto && !/\bcountdown\s*\(/.test(src)) warns.push('@howto لا يظهر إلا عند ui.countdown: ابدأ الجولة الأولى بها');
  // بيانات الفلاتر (0.6، ENGINE.md §1.1): غيابها تنبيه، وقيمة خارج المجموعة المغلقة خطأ
  for (const k of ['players', 'minutes', 'age', 'play', 'style']) if (!head[k]) warns.push('لا يوجد // @' + k + ': أضفه لتظهر اللعبة في فلاتر القائمة (ENGINE.md §1.1)');
  if (head.players) { const m = /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?$/.exec(head.players), a = m && +m[1], b = m && +(m[2] || m[1]); if (!m || a < 1 || b < a || b > 16) errs.push('@players «' + head.players + '» يجب أن يكون رقمًا أو مدى مثل 1-4 (من 1 إلى 16)');
    else if (caps.includes('players.pads')) { const pd = /(\d)\s*-\s*(\d)/.exec(head.pads || '1-8'); if (pd && (a < +pd[1] || b > +pd[2])) warns.push('@players ' + head.players + ' خارج مدى @pads ' + pd[1] + '-' + pd[2]); } }
  if (head.minutes && !(+head.minutes >= 1 && +head.minutes <= 60)) errs.push('@minutes «' + head.minutes + '» يجب أن يكون دقائق من 1 إلى 60');
  if (head.age && !(Number.isInteger(+head.age) && +head.age >= 3 && +head.age <= 18)) errs.push('@age «' + head.age + '» يجب أن يكون أصغر عمر مناسب، رقمًا صحيحًا من 3 إلى 18');
  if (head.play && !PLAYS.includes(head.play)) errs.push('@play «' + head.play + '» ليست من: ' + PLAYS.join(' '));
  if (head.play === 'pads' && !caps.includes('players.pads')) errs.push('@play pads يحتاج القدرة players.pads');
  if (head.style) { const un = head.style.split(/[\s|,]+/).filter(x => x && !STYLES.includes(x)); if (un.length) errs.push('@style «' + un.join(' ') + '» ليست من: ' + STYLES.join(' ')); }
  for (const c of caps) { if (PLANNED.includes(c)) errs.push('القدرة «' + c + '» غير متاحة بعد'); else if (!KNOWN.includes(c)) errs.push('قدرة غير معروفة: ' + c); }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1');
  if (!/\bdefineGame\s*\(/.test(code)) errs.push('لا يوجد استدعاء defineGame({...})');
  for (const [re, name] of FORBID) if (re.test(code)) errs.push('استدعاء محظور: ' + name);
  // parent/top/opener المجرّدة: محظورة ما لم تكن اسمًا محليًا (متغيّر أو معامل) أو خاصية كائن (rect.top). كانت تُرفض مطلقًا فتوقف من سمّى متغيّره top
  for (const n of ['parent', 'top', 'opener', 'frameElement']) { const use = new RegExp('(?<![.\\w$])' + n + '\\s*[.\\[]'), decl = new RegExp('\\b(?:let|const|var|function)\\s+[^;=]*?\\b' + n + '\\b|[(,]\\s*' + n + '\\s*[,)=]|\\b' + n + '\\s*=>'); if (use.test(code) && !decl.test(code)) errs.push('استدعاء محظور: ' + n + ' (كائن المتصفح العام؛ سمِّ متغيّرك باسم آخر أو عرّفه بـlet/const)'); }
  for (const [re, name] of WARN) if (re.test(code)) warns.push(name);
  for (const [re, cap] of CAPMAP) if (re.test(code) && !caps.includes(cap)) errs.push('تستعمل api لقدرة «' + cap + '» لم تُعلَن في @capabilities');
  for (const [re, name] of PLANMAP) if (re.test(code)) errs.push('api.' + name + ' غير متاحة بعد في v0');
  // العُدّة: لا قدرة تلزمها. الاسم المستعار (ui = api.ui) يُتتبَّع كي يُكشف خطأ إملائي في اسم الدالة قبل التشغيل.
  const alias = new Set(['api.ui']); for (const m of code.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*(?:api|a)\.ui\b|\b(\w+)\s*=\s*(?:api|a)\.ui\b/g)) alias.add(m[1] || m[2]);
  for (const al of alias) for (const m of code.matchAll(new RegExp('(?<![\\w.])' + al.replace('.', '\\.') + '\\.(\\w+)', 'g'))) if (!KIT.includes(m[1])) errs.push('«' + al + '.' + m[1] + '» غير موجودة في عُدّة الواجهة' + ' (المتاح: ' + KIT.join(' ') + ')');
  // api.prefs (0.5.2): أربعة أرقام للقراءة فقط يضبطها الوالد من الإعدادات
  for (const m of code.matchAll(/\b(?:api|a)\.prefs\.(\w+)/g)) if (!PREFS.includes(m[1])) errs.push('«api.prefs.' + m[1] + '» غير موجودة (المتاح: ' + PREFS.join(' ') + ')');
  if (/\b(?:api|a)\.prefs(?:\.\w+)?\s*=(?!=)/.test(code)) errs.push('api.prefs للقراءة فقط: لا تغيّرها (يضبطها الوالد من الإعدادات)');
  if (/\bROUND\w*\s*=\s*\d/.test(code) && !/\bprefs\b/.test(code)) warns.push('للعبة مدة جولة ولا تقرأ api.prefs.roundScale: اضربها فيه كي يعمل إعداد «مدة الجولة» (ENGINE.md §3.5)');
  const usesUi = /\b(?:api|a)\.ui\b/.test(code);
  if (!usesUi && /\bdefineGame\b/.test(code) && /\brender\b/.test(code)) warns.push('لا تستعمل api.ui: شاشات البداية والعدّ التنازلي والمقاييس تأتي جاهزة بهوية المحرك (ENGINE.md §3.3)');
  if (!usesUi && (code.match(/#[0-9a-fA-F]{6}\b/g) || []).length > 6) warns.push('ألوان مكتوبة يدويًا كثيرة: استعمل api.ui.theme (DESIGN.md §2)');
  const lines = src.split('\n').length; if (lines > 300) warns.push('الملف ' + lines + ' سطرًا (الحد المقترح 300)');
  if (src.length > 200000) errs.push('الملف أكبر من 200000 بايت');
  console.log((errs.length ? 'فشل  ' : 'سليم ') + file + '  [' + caps.join(' ') + ']  ' + lines + ' سطر');
  errs.forEach(e => console.log('   خطأ  : ' + e)); warns.forEach(w => console.log('   تنبيه: ' + w));
  if (errs.length) bad++;
}
process.exit(bad ? 1 : 0);
