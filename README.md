# ألعاب الكاميرا

ألعاب تلعبها بيدك وجسمك وألوان من حولك أمام كاميرا الجهاز، في المتصفح فقط. **بلا خادم، بلا حساب، بلا إنترنت بعد أول فتح.**

## الخصوصية
- الصورة تُحلَّل على جهازك ولا تُرسل ولا تُحفظ في أي مكان (لا يوجد أي طلب شبكة أثناء اللعب؛ سياسة الأمان CSP تمنع الاتصال بغير المصدر نفسه).
- معظم الألعاب **لا تعرض الصورة أصلًا** (صيد الألوان: أمسك شيئًا ملوّنًا دون أن يظهر وجهك). الألعاب التي ترى فيها نفسك تحمل شارة «📷».
- من القائمة يمكنك إطفاء «عرض صورة الكاميرا في الألعاب» نهائيًا. ويظهر مؤشر دائم أثناء عمل الكاميرا.
- ألعاب الطرف الثالث تعمل في صندوق معزول لا يصل للشبكة ولا للصفحة (التفاصيل في `ENGINE.md` §10).

## التشغيل
الكاميرا لا تعمل في المتصفح إلا في سياق آمن (HTTPS أو `localhost`). لذلك **فتح `index.html` مباشرة (`file://`) لا يكفي**: المتصفحات تحجب الكاميرا وعامل الخدمة هناك.

1. **على جهازك:** في هذا المجلد شغّل `python3 -m http.server 8000` ثم افتح `http://localhost:8000` (أي خادم ملفات ثابتة يصلح).
2. **على الإنترنت (ثابت):** انشر المجلد كما هو على GitHub Pages أو أي استضافة ثابتة HTTPS.
3. بعد أول فتح يخزّن التطبيق نفسه ويعمل بلا شبكة، ويمكن تثبيته: Safari ← مشاركة ← «إضافة إلى الشاشة الرئيسية»، أو Chrome ← «تثبيت التطبيق».

## تحميل لعبة أخرى
زر «تحميل ملف لعبة» في القائمة يشغّل `game.js` من جهازك. لكتابة لعبة: `CONTRIBUTING.md` و`ENGINE.md`.

## الاختبار
`node tests/server.mjs 8453 &` ثم `node tests/run-portable.mjs` وبقية `tests/run-*.mjs` (تحتاج Google Chrome؛ بلا اعتماديات).

## الرخصة
MIT — `LICENSE`.

---

## English (short)
Camera games that run entirely in the browser: no server, no account, works offline after first load, and the camera image never leaves the device (CSP blocks all external requests; most games don't even display the image, and you can turn display off globally in the menu).

**Run:** `python3 -m http.server 8000` in this folder → `http://localhost:8000`, or host the folder on any static HTTPS host (GitHub Pages). `file://` does not work: browsers block camera and service workers outside a secure context. After the first visit it is cached by a service worker and installable as a PWA.

**Contribute a game:** see `CONTRIBUTING.md` (spec in `ENGINE.md`, validator `node tools/check-game.mjs`). License: MIT.
