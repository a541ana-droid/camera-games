# ألعاب الكاميرا

ألعاب تلعبها بيدك وجسمك وألوان من حولك أمام كاميرا الجهاز، في المتصفح فقط. **بلا خادم، بلا حساب، بلا إنترنت بعد أول فتح.**

## الخصوصية
- الصورة تُحلَّل على جهازك ولا تُرسل ولا تُحفظ في أي مكان. سياسة الأمان CSP لا تسمح إلا بطلبين خارجيين معلنين: عدّاد زوّار مجهول (abacus، مرة في اليوم لكل جهاز، بلا كوكيز)، ووسيط الربط بين التلفاز والجوالات في وضع التلفاز (لا تمرّ عبره صورة ولا صوت، فقط أوامر التحكم).
- معظم الألعاب **لا تعرض الصورة أصلًا** (صيد الألوان: أمسك شيئًا ملوّنًا دون أن يظهر وجهك). الألعاب التي ترى فيها نفسك تحمل شارة «📷».
- من القائمة يمكنك إطفاء «عرض صورة الكاميرا في الألعاب» نهائيًا. ويظهر مؤشر دائم أثناء عمل الكاميرا.
- ألعاب الطرف الثالث تعمل في صندوق معزول لا يصل للشبكة ولا للصفحة (التفاصيل في `ENGINE.md` §10).

## التشغيل
الكاميرا لا تعمل في المتصفح إلا في سياق آمن (HTTPS أو `localhost`). لذلك **فتح `index.html` مباشرة (`file://`) لا يكفي**: المتصفحات تحجب الكاميرا وعامل الخدمة هناك.

1. **على جهازك:** في هذا المجلد شغّل `python3 -m http.server 8000` ثم افتح `http://localhost:8000` (أي خادم ملفات ثابتة يصلح).
2. **على الإنترنت (ثابت):** انشر المجلد كما هو على GitHub Pages أو أي استضافة ثابتة HTTPS.
3. بعد أول فتح يخزّن التطبيق نفسه ويعمل بلا شبكة، ويمكن تثبيته: Safari ← مشاركة ← «إضافة إلى الشاشة الرئيسية»، أو Chrome ← «تثبيت التطبيق».

## العب بالجوالات (وضع التلفاز)
افتح الموقع على الشاشة الكبيرة (تلفاز ذكي، حاسوب موصول بتلفاز، لوح) واضغط «📺 العب بالجوالات». يظهر رمز QR ورمز من أربعة أحرف: كل لاعب يمسح الرمز بكاميرا جواله (أو يفتح الموقع ويضغط «📱 انضم» ويكتب الحروف)، يختار لونه وشكله (أزرق دائرة، وردي مثلث، أصفر مربع، أخضر معيّن) ويكتب اسمه ويضغط «ابدأ». جواله يصير ذراع تحكّم: عصا وزرّان واهتزاز. 1 إلى 8 لاعبين، كلٌّ لنفسه أو 1 ضد 1 أو 2 ضد 2 أو فريقان. أول لاعب انضمّ هو القائد: يختار اللعبة ويبدأها من جواله.

**بصراحة عن الإنترنت:** للربط بين التلفاز والجوالات يحتاج الجهازان إنترنت لحظة الاتصال (تتبادل «المصافحة» المشفّرة عبر مرحّلات Nostr عامة). بعد الاتصال تجري أوامر التحكم مباشرة بين الجوال والتلفاز (WebRTC، داخل شبكتك المنزلية عادةً). اللعب على شبكة محلية بلا إنترنت إطلاقًا غير ممكن من صفحة ويب — يحتاج تطبيقًا أصليًا على الجهاز المضيف (ليس في هذا الإصدار). إن لم يتصل جوال: ضعوا كل الأجهزة على الواي فاي نفسه (بعض شبكات الجوال تمنع الاتصال المباشر). الألعاب نفسها لا تصل الشبكة أبدًا؛ المضيف يمرّر لها أرقام الأزرار والعصا فقط. لم يُجرَّب بعد على آيفون ولا على متصفحات التلفاز (Tizen/webOS).

## الإعدادات
من «⚙️ الإعدادات» في القائمة: الصوت ومستواه، الاهتزاز، مدة الجولة (قصيرة/عادية/طويلة)، الصعوبة (سهل لطفل في الرابعة/عادي/صعب)، حساسية حركة الكاميرا، تقليل الوميض والحركة، نص أكبر، و«حول» (الإصدار والرخصة والخصوصية) و«مسح بياناتي». إن نُشرت نسخة جديدة ظهر في القائمة شريط «نسخة جديدة جاهزة — تحديث»؛ لا يُعاد تحميل الصفحة وحده أبدًا، ولا يظهر أثناء لعبة.

## تحميل لعبة أخرى
زر «تحميل ملف لعبة» في القائمة يشغّل `game.js` من جهازك. لكتابة لعبة: `CONTRIBUTING.md` و`ENGINE.md`.

## الاختبار
`node tests/server.mjs 8453 &` ثم `node tests/run-portable.mjs` وبقية `tests/run-*.mjs` (تحتاج Google Chrome؛ بلا اعتماديات).

## الرخصة
MIT — `LICENSE`.

---

## English (short)
Camera games that run entirely in the browser: no server, no account, works offline after first load, and the camera image never leaves the device (CSP allows only an anonymous visit counter and, in TV mode, the pairing relays; most games don't even display the image, and you can turn display off globally in the menu).

**Run:** `python3 -m http.server 8000` in this folder → `http://localhost:8000`, or host the folder on any static HTTPS host (GitHub Pages). `file://` does not work: browsers block camera and service workers outside a secure context. After the first visit it is cached by a service worker and installable as a PWA.

**TV mode:** open the site on a big screen, press «📺 العب بالجوالات», and phones join by scanning the QR code (`#pad=ABCD`) to become controllers (joystick + buttons, 1–8 players, solo/1v1/2v2/teams). Honest note: pairing needs internet on both devices (WebRTC signalling via public Nostr relays, Trystero vendored in `vendor/`); after that, input flows peer-to-peer, usually inside your LAN. Fully offline LAN play would need a native app. Games themselves still have no network access.

**Contribute a game:** see `CONTRIBUTING.md` (spec in `ENGINE.md`, validator `node tools/check-game.mjs`). License: MIT.
