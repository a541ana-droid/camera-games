# بحث الأجهزة والمتصفحات: توافق واجهات برمجة المحرك (2026)

**التاريخ المرجعي:** 2026-11-06
**النطاق:** بحث للقراءة فقط. لم يُعدَّل أي ملف آخر في المستودع.
**منهج:** كل ادعاء له مصدر URL. ما لم يُذكر مصدر مباشر أو كان مصدره ضعيفًا أو قديمًا، يُعلَّم بـ «غير مُتحقَّق». أغلب صفوف جداول Safari وFirefox مستقاة من caniuse، وصفحات MDN المفتوحة لم تُظهر جدول التوافق كاملًا، فالمعلومات عنها أضعف.

---

## 0. الخلاصة السريعة

- **الكاميرا والميكروفون (getUserMedia)** مدعومان في كل المتصفحات الحديثة، لكن **يشترطان سياقًا آمنًا** (HTTPS أو localhost). عنوان IP في الشبكة المحلية عبر HTTP لا يعمل.
- **حساسات الحركة على iOS** تحتاج `DeviceOrientationEvent.requestPermission()` تُستدعى من نقرة مستخدم، ولا تعمل عند التحميل.
- **Vibration** غير مدعومة على iOS Safari، فالتغذية الراجعة اللمسية تحتاج بديلًا بصريًا وصوتيًا.
- **Wake Lock** مدعوم على iOS من 16.4 وصار كاملًا تقريبًا من 18.4، لكنه ضعيف داخل تطبيقات الشاشة الرئيسية المثبّتة.
- **WebRTC داخل الشبكة المحلية** ممكن، لكن Safari على iOS تخفي عناوين IP المحلية حتى يُمنح إذن الكاميرا أو الميكروفون، ومنطق الإذن المحلي لم يُحسم في المصادر.
- **أقل جهاز آمن كخط أساس:** Android 9+ بذاكرة 2 GB مع Chrome 110+ أو Samsung Internet 20+ أو Firefox 120+، وiOS 16.4+ لـ Safari.
- **أبسط مسار للمرحلة الثانية:** المضيف يخدم صفحة HTTPS محلية بشهادة موقّعة ذاتيًا أو عبر `localhost`، والهواتف تتصل بـWebRTC DataChannel مع إشارة يدوية أو QR. (التفاصيل في القسم 3.)

---

## 1. مصفوفة التوافق

**الرموز:** ✅ مدعوم | ⚠️ جزئي أو بشرط | ❌ غير مدعوم | ❔ غير مُتحقَّق من مصدر مباشر

### 1.1 الكاميرا (getUserMedia video، أمامية/خلفية)

| المتصفح | الدعم | الشرط / الملاحظة | المصدر |
|---|---|---|---|
| iOS Safari 16 | ⚠️ | مدعوم، لكن `facingMode` قد يفتح الأمامية في إصدارات 16.4 Beta (تقرير WebKit) | [caniuse getUserMedia](https://caniuse.com/mdn-api_mediadevices_getusermedia)، [WebKit 252560](https://auto-bugs.webkit.org/show_bug.cgi?id=252560) |
| iOS Safari 17 | ✅ | — | نفس المصدر |
| iOS Safari 18+ | ✅ | تحقق من التوجيه الخلفي على الجهاز الفعلي | نفس المصدر |
| iPadOS | ✅ | الكاميرا الخلفية غالبًا غير مفيدة في الأجهزة اللوحية | ❔ |
| Android Chrome 157 | ✅ | `exact: "environment"` قد يفشل NotReadableError على بعض الأجهزة، والحل اختيار deviceId | [mediasoup forum](https://mediasoup.discourse.group/t/webrtc-facingmode-environment-not-working-in-android-chrome/2187) |
| Samsung Internet | ✅ | مدعوم من 6.2 حسب caniuse | [caniuse](https://caniuse.com/mdn-api_mediadevices_getusermedia) |
| Firefox Android 159 | ✅ | — | نفس المصدر |
| Desktop Chrome / Safari / Firefox | ✅ | Chrome وSafari مدعومان. Firefox desktop لم يُتحقَّق من جدوله في هذا البحث | نفس المصدر |
| أجهزة قديمة 2 GB (Android Go) | ⚠️ | الدعم موجود، لكن الأداء يتدهور مع الدقة العالية | [Android Go](https://developer.android.com/guide/topics/androidgo) |

**الفشل والبديل:** إن رفض المستخدم الإذن أو لم تتوفر كاميرا، يُعرض وضع «لوحة لمس فقط» (زر بدل الإيماءة). استخدم `facingMode: "environment"` كقيد مثالي وليس `exact`، واختر الكاميرا بـ enumerateDevices عند الفشل.

### 1.2 الميكروفون وWebAudio AnalyserNode

| المتصفح | الدعم | الشرط / الملاحظة | المصدر |
|---|---|---|---|
| iOS Safari 16–18+ | ⚠️ | `AudioContext` يبدأ `suspended` حتى نقرة، وgetUserMedia يحتاج تفاعلًا | ❔ (معرفة عامة لم تُتحقَّق من مصدر مباشر) |
| Android Chrome / Samsung / Firefox Android | ✅ | — | [caniuse getUserMedia](https://caniuse.com/mdn-api_mediadevices_getusermedia) |
| Desktop | ✅ | — | نفس المصدر |
| أجهزة قديمة | ✅ | تحليل الصوت (FFT 256) خفيف، لكن مع `requestAnimationFrame` قد يستهلك CPU | ❔ |

**الفشل والبديل:** `AudioContext` معلّق = اعرض زر «ابدأ الصوت». لا تبنِ اللعبة على الصوت وحده.

### 1.3 الحساسات: DeviceMotion / DeviceOrientation

| المتصفح | الدعم | الشرط / الملاحظة | المصدر |
|---|---|---|---|
| iOS Safari 16–18+ | ⚠️ | يتطلب `DeviceOrientationEvent.requestPermission()` من نقرة مستخدم، والإجابة تُخزَّن، ولا يعمل عند onload. HTTPS مطلوب | [WebKit 201676](https://bugs.webkit.org/show_bug.cgi?id=201676)، [caniuse deviceorientation](https://caniuse.com/deviceorientation) |
| iPadOS | ⚠️ | نفس القاعدة، ويعمل فقط إن كان الجهاز يحوي حساسات | ❔ |
| Android Chrome 157 | ✅ | لا يُطلب إذن صريح في الغالب | [caniuse](https://caniuse.com/deviceorientation) |
| Samsung Internet | ✅ | — | نفس المصدر |
| Firefox Android 159 | ✅ | — | نفس المصدر |
| Desktop | ❌ غالبًا | حساسات الحركة غير متوفرة عادةً على الحاسوب | ❔ |

**منطق iOS الإلزامي:**
```text
if (typeof DeviceOrientationEvent?.requestPermission === 'function')
  -> اربط الزر بنقرة: await requestPermission() ثم addEventListener لو 'granted'
else
  -> أضف المستمع مباشرة
```
**الفشل والبديل:** الرفض أو الفشل = اعرض تحكمًا باللمس أو الكاميرا (تتبع الحركة بـMediaPipe أو optical flow).

### 1.4 Web Workers وblob: workers

| المتصفح | الدعم | الشرط / الملاحظة | المصدر |
|---|---|---|---|
| iOS Safari 16–18+ | ✅ | `blob:` Worker يحتاج `worker-src` يسمح بـ `blob:` في CSP | [CentralCSP](https://next.centralcsp.com/en/blog/csp-blob-scheme) |
| Android / Samsung / Firefox Android | ✅ | — | ❔ |
| Desktop | ✅ | — | ❔ |
| داخل iframe sandbox بلا allow-same-origin | ❌ | المصدر null، والـblob Worker يفشل | [WebKit thread](https://bugs.webkit.org/show_bug.cgi?id=170075) (قديم، يُتحقق) |

**الفشل والبديل:** إن فشل blob Worker، حمّل ملف Worker من نفس الأصل (`/engine/worker.js`) بدل blob. هذا أبسط وأكثر أمنًا.

### 1.5 iframe sandbox وsrcdoc

| المتصفح | الدعم | الشرط / الملاحظة | المصدر |
|---|---|---|---|
| كل المتصفحات الحديثة | ✅ | `sandbox` و`srcdoc` مدعومان | ❔ (معرفة عامة) |
| getUserMedia داخل sandbox | ⚠️ | يحتاج `allow="camera; microphone"` وغالبًا `allow-same-origin` | [Mozilla review 148180](https://reviewboard.mozilla.org/r/148180/diff/) (مسودة اختبار، ليس مواصفة) |
| iOS Safari | ⚠️ | نفس الشرط، لم يُتحقَّق من إصدار 18+ | ❔ |

**الفشل والبديل:** لا تستخدم sandbox لمحتوى اللعبة الموثوق. اعزل بالـWorker بدل الـiframe، وأبقِ الكاميرا في الصفحة المضيفة.

### 1.6 Service Worker وتثبيت PWA والعمل دون اتصال

| المتصفح | الدعم | الشرط / الملاحظة | المصدر |
|---|---|---|---|
| iOS Safari 16–18+ | ⚠️ | Service Worker مدعوم، لكن `beforeinstallprompt` غير مدعوم. التثبيت يدوي عبر «إضافة إلى الشاشة الرئيسية». بيانات الموقع تُحذف بعد 7 أيام من عدم التفاعل (خارج الشاشة الرئيسية) | [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) (مصدر ثانوي) |
| Android Chrome | ✅ | `beforeinstallprompt` مدعوم | ❔ |
| Samsung Internet | ✅ | Chromium، لكن تحقق من إصدار PWA | ❔ |
| Firefox Android | ⚠️ | لا يوجد زر تثبيت مماثل لـChrome | ❔ |
| Desktop | ✅ | — | ❔ |
| أجهزة قديمة | ⚠️ | حجم الكاش محدود، والذاكرة ضيقة | ❔ |

**الفشل والبديل:** إن لم يتوفر Service Worker، اعمل بلا عمل دون اتصال. اعرض تعليمات «أضف إلى الشاشة الرئيسية» لمستخدمي iOS.

### 1.7 Vibration API

| المتصفح | الدعم | الشرط / الملاحظة | المصدر |
|---|---|---|---|
| iOS Safari 16–27 | ❌ | غير مدعوم في كل الإصدارات حتى 27.2 | [caniuse vibrate](https://caniuse.com/mdn-api_navigator_vibrate) |
| Android Chrome 157 | ✅ | يحتاج تفاعلًا من المستخدم (user activation) | [caniuse](https://caniuse.com/mdn-api_navigator_vibrate) |
| Samsung Internet | ✅ | — | نفس المصدر |
| Firefox Android 159 | ⚠️ | caniuse يصنفه جزئيًا، وتقرير W3C يقول إن الدعم أُلغي في الإصدار 129. الحالة متناقضة | [caniuse](https://caniuse.com/mdn-api_navigator_vibrate)، [W3C report](https://w3c.github.io/vibration/reports/implementation.html) |
| Desktop | ❌ | — | ❔ |

**الفشل والبديل:** `if ('vibrate' in navigator)` ثم اهتزاز، وإلا وميض شاشة أو صوت.

### 1.8 Battery API

| المتصفح | الدعم | الشرط / الملاحظة | المصدر |
|---|---|---|---|
| iOS Safari | ❌ | غير مدعوم | ❔ (معرفة عامة، المصدر لم يُفتح) |
| Android Chrome / Samsung | ✅ | يعمل في الأصل الآمن فقط | [MDN Battery](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API) |
| Firefox | ❌ | معطّل لأسباب خصوصية | ❔ (معرفة عامة، يُتحقق) |
| Desktop Chrome | ✅ | — | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API) |

**الحالة على MDN:** Limited availability، لأنه لا يعمل في بعض المتصفحات الكبرى. **الاستنتاج:** لا تعتمد عليه لأي قرار جوهري (مثل خفض الجودة). استخدمه كتلميح تحسيني فقط.

### 1.9 Wake Lock API

| المتصفح | الدعم | الشرط / الملاحظة | المصدر |
|---|---|---|---|
| iOS Safari 16.4–18.3 | ⚠️ | يعمل في المتصفح العادي، ولا يعمل في تطبيق الشاشة الرئيسية المثبّت | [MDN Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)، [caniuse](https://caniuse.com/wake-lock) |
| iOS Safari 18.4+ | ✅ | دعم كامل وفق MDN، والمصدر متناقض حول التفاصيل | نفس المصادر |
| iOS Safari 26.x | ✅ | caniuse يشير إلى الدعم حتى 27.2 | [caniuse](https://caniuse.com/wake-lock) |
| Android Chrome 157 | ✅ | — | [caniuse](https://caniuse.com/wake-lock) |
| Samsung Internet 14+ | ✅ | — | [caniuse](https://caniuse.com/wake-lock) |
| Firefox Android 159 | ❌ | caniuse لا يعرض دعمًا بعد، يُتحقق | [caniuse](https://caniuse.com/wake-lock) |
| Desktop | ⚠️ | Chrome/Safari نعم، Firefox يُتحقق | [caniuse](https://caniuse.com/wake-lock) |

**الواجب:** أعد طلب القفل عند `visibilitychange` (MDN ينص على أن النظام قد يفكّه). **الفشل والبديل:** شاشة لا تنطفئ يدويًا = نص «أبقِ الشاشة مفتوحة».

### 1.10 WebTransport (للمرحلة الثانية، إن احتجناه)

| المتصفح | الدعم | المصدر |
|---|---|---|
| iOS Safari | ✅ من 26.4 فقط | [caniuse webtransport](https://caniuse.com/webtransport) |
| Chrome Android 157 | ✅ | نفس المصدر |
| Firefox desktop 114+ / Android 159 | ✅ | نفس المصدر |
| Samsung Internet 18+ | ✅ | نفس المصدر |

**ملاحظة:** WebTransport يتطلب HTTP/3 وشهادة صالحة، وهذا أصعب على الشبكة المحلية. انظر القسم 3.

---

## 2. خط الأساس للأجهزة وأفضل ممارسات الخفة

### 2.1 خط الأساس المقترح

| الفئة | الحد الأدنى | ملاحظة |
|---|---|---|
| iOS | 16.4+ (Safari) | يغطي Wake Lock وWebRTC الأساسي. الأفضل 18.4+ |
| Android | 9+، Chrome 110+ أو Samsung Internet 20+ أو Firefox 120+ | ليست مواصفة مُتحقَّقة، بل تقدير من جداول caniuse |
| الذاكرة | 2 GB RAM | ينطبق على Android Go. الأداء تحت هذا الحد غير مضمون |
| الكاميرا | أي كاميرا أمامية أو خلفية | دقة هدف 640×480 تكفي |
| الحساسات | اختيارية | الإذن عند iOS فقط |

**توصية:** أعلن الخط الأدنى في الصفحة، واعرض «وضع خفيف» تلقائيًا عند `navigator.deviceMemory <= 2` (مصدر: [Chrome device memory](https://developer.chrome.com/blog/device-memory)). ملاحظة: Firefox لا يدعم `deviceMemory` حتى الآن، فاعتبر غيابه حالة حذرة.

### 2.2 ممارسات الخفة لتحليل الكاميرا

1. **دقة منخفضة في التحليل.** حلّل على 320×240 أو أصغر، واعرض الفيديو بدقة أعلى إن لزم. التحليل أسرع بكثير من معالجة 1080p.
2. **تحليل كل إطار ثانٍ أو ثالث.** معظم الألعاب لا تحتاج 60 إطار تحليل في الثانية.
3. **استخدم `OffscreenCanvas` في Worker** لتفريغ الخيط الرئيسي. (الدعم: Safari 16.4+، Chrome، Firefox).
4. **تجنب `getImageData` المتكرر.** استخدم `ImageBitmap` أو `VideoFrame` حيث يتوفر. انسخ البيانات مرة واحدة لكل إطار.
5. **لا تشغّل `requestAnimationFrame` للتحليل بلا حاجة.** اضبط المعدل حسب الحاجة، وأوقف التحليل عند إخفاء التبويب.
6. **أوقف الكاميرا عند الإيقاف المؤقت.** `track.stop()` ليس نفس الإيقاف المؤقت، لذا أعد تشغيلها عند الاستئناف.
7. **افصل التحليل عن الرسم.** العامل يحلل، والخيط الرئيسي يرسم فقط.
8. **تجنب تخصيص الذاكرة في كل إطار.** أعد استخدام المصفوفات (TypedArray) بدل إنشاء مصفوفات جديدة.
9. **راقب الحرارة والبطارية.** على الجوال، التحليل المستمر يسخّن الجهاز. خفّض المعدل بعد دقيقة إن لم تكن هناك تغييرات.

---

## 3. المرحلة الثانية: لعب محلي عبر Wi-Fi (مضيف واحد + هواتف كمتحكمات)

### 3.1 المقارنة

| الخيار | المتطلب | المزايا | العيوب / الحدود | الحكم |
|---|---|---|---|---|
| WebRTC DataChannel + إشارة يدوية/QR | مضيف يعرض صفحة، وهواتف تمسح QR | لا خادم إنترنت، زمن منخفض | الإشارة معقدة قليلًا، وiOS يخفي IP المحلي (انظر 3.4) | **الأفضل** |
| خادم محلي صغير على المضيف (WebSocket) | لابتوب يشغّل Node أو Python. الهواتف لا تشغّل خادمًا | بسيط جدًا، موثوق | يتطلب HTTPS لكاميرا الهاتف، وإن كانت الكاميرا على المضيف فليس مشكلة | بديل جيد |
| WebTransport | HTTP/3 وشهادة صالحة | مرن | دعم iOS حديث (26.4+)، والشهادة المحلية صعبة | ليس الآن |
| mDNS (`.local`) | Bonjour أو Avahi | اسم مريح بدل IP | لا يعمل بالضرورة داخل Android بلا دعم، وWebRTC يخفي IP بـ mDNS أيضًا | مساعد فقط، لا تعتمد عليه |

**المصادر:** [WebRTC mDNS glossary](https://bloggeek.me/webrtcglossary/mdns)، [arXiv 2510.16168](https://arxiv.org/pdf/2510.16168.pdf) (يقيس فعالية الإخفاء على Chrome وFirefox وBrave وTor على Windows 11 وAndroid).

### 3.2 أيّ جهاز يشغّل الخادم المحلي؟

| الجهاز | يشغّل خادمًا محليًا؟ | الملاحظة |
|---|---|---|
| لابتوب (Mac/Windows/Linux) | ✅ | نعم، Node أو Python بسطر واحد |
| iPhone / iPad (Safari) | ❌ | لا يسمح المتصفح بخادم عمليات، وتطبيق مستقل يتطلب Xcode |
| Android (Chrome) | ❌ | لا خادم في المتصفح. Termux ممكن لكنه ليس للمستخدم العادي |
| تطبيق Android مع WebView | ⚠️ | ممكن كتطبيق أصلي، لكنه خارج نطاق صفحة ويب |

**الاستنتاج:** المضيف هو الحاسوب أو الشاشة، والهواتف متحكمات تتصل بالمضيف فقط.

### 3.3 إذن الشبكة المحلية على iOS وAndroid

- **iOS 14+:** Apple تطلب إذنًا «Local Network» عندما يحاول التطبيق تصفح الشبكة المحلية. توجد أبحاث (IEEE S&P 2025) تشير إلى أن هذا الإذن ضعيف في بعض حالات WebView، لكن النتيجة لم تُطبَّق بعد على Safari. [IEEE S&P 2025 via eprints](https://eprints.cs.univie.ac.at/8454).
- **Safari (ويب):** تقرير مطور واحد يشير إلى أن Safari لا تعرض الإذن المحلي كما تفعل Chrome، لكنه ليس قرارًا رسميًا من Apple. [Apple forums 811690](https://developer.apple.com/forums/thread/811690).
- **CVE-2025-31184:** أُصلح في Safari 18.4 (وصف وصول تطبيق غير مصرّح للشبكة المحلية). [Rapid7](https://www.rapid7.com/db/vulnerabilities/apple-safari-cve-2025-31184/).
- **Android:** لم يُتحقَّق من مصدر مباشر. الأذونات الحديثة تتطلب موافقة لتصفح الشبكة المحلية في Chrome، فاختبر ذلك على جهاز فعلي.

**الفشل والبديل:** إذا رُفض الإذن أو لم يظهر، اعرض رمز QR يحتوي عنوان HTTPS الكامل ليعيد المستخدم المحاولة.

### 3.4 حدود WebRTC على الشبكة المحلية

| الحد | التفاصيل | المصدر |
|---|---|---|
| عناوين IP المحلية مخفية | Safari تُرجع ICE candidates بلا IP محلي (منذ Safari 11) للخصوصية | [WebKit 176921](https://bugs.webkit.org/show_bug.cgi?id=176921) |
| منح الكاميرا أو الميكروفون يكشف IP محلي على iOS | تقرير من 2018، لم يُتحقق من وضعه الحالي | [WebKit 173052](https://lists.webkit.org/pipermail/webkit-unassigned/2017-June/777027.html) (قديم) |
| mDNS `.local` بدل IP | Chrome يخفي IP بمعرّف `.local`، ويحل الاسم أقرانٌ على الشبكة نفسها، وخادم الإشارة قد لا يحله | [arXiv 2025](https://arxiv.org/pdf/2510.16168.pdf)، [bloggeek](https://bloggeek.me/webrtcglossary/mdns) |
| TURN احتياطي | يعمل من الإنترنت، لكنه يتطلب خادمًا خارجيًا، وهذا ممنوع في المرحلة الثانية | مصادر WebRTC عامة |

**الاستنتاج العملي:** اختبر الاتصال بين جهاز iOS والمضيف فعليًا قبل الاعتماد عليه. إن فشل، فالمسار البديل هو خادم WebSocket محلي بدل WebRTC.

### 3.5 HTTPS لعناوين الشبكة المحلية وشهادات موقّعة ذاتيًا

- **getUserMedia لا يعمل على `http://192.168.x.x`** لأنه ليس سياقًا آمنًا. الاستثناء الوحيد هو `localhost` [WebRTC Hacks](https://webrtchacks.com/?p=2469)، و[MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints).
- **الخيارات:**
  1. **شهادة موقّعة ذاتيًا:** iOS وSafari ترفضها افتراضيًا، ويتطلب المستخدم تثبيتها يدويًا. مكلف للمستخدم العادي.
  2. **المضيف يعرض الصفحة على `localhost`، والهواتف تستخدم قناة WebSocket/WebRTC للبيانات فقط:** الكاميرا تبقى على المضيف، والهواتف لا تحتاج كاميرا، وهذا الحل الأبسط.
  3. **شهادة صالحة لنطاق عام** (مثل تسجيل نطاق عبر Let's Encrypt) مع DNS يشير إلى IP محلي: ممكن، لكنه يتطلب نطاقًا ومعلومات خارجية.
- **التوصية:** الكاميرا على المضيف فقط (الخيار 2)، والهواتف تتحكم عبر أزرار ولمس وحساسات الحركة (وحساسات الحركة على iOS تحتاج HTTPS، لذا تحتاج الهواتف أيضًا إلى سياق آمن). **تحدٍّ:** حساسات الحركة على iOS تتطلب HTTPS، فالهواتف تحتاج شهادة. هذا القيد الأهم في المرحلة الثانية.

### 3.6 التوصية البسيطة والمتينة

1. **المضيف:** لابتوب يخدم صفحة LAN عبر HTTPS بشهادة موقّعة ذاتيًا أو بنطاق صالح، أو عبر `localhost` حين يكون الجهاز نفسه.
2. **الإشارة:** QR يحمل رمز الغرفة و SDP مضغوطًا (طريقة manual signaling). لا خادم إنترنت.
3. **النقل:** WebRTC DataChannel (unreliable للحساسات، reliable للأحداث).
4. **احتياط:** إن فشل WebRTC على iOS، ينتقل المتحكم إلى WebSocket محلي على نفس الخادم.
5. **ملاحظة:** لا تعتمد على mDNS أو WebTransport في الإصدار الأول.

---

## 4. مشاريع مفتوحة المصدر (للمرجعية وإعادة الاستخدام)

| المشروع | الرخصة | ماذا يفعل | ما يمكن إعادة استخدامه | الحالة / ملاحظة | المصدر |
|---|---|---|---|---|---|
| **Open Party Lab** | Apache-2.0 | منصة ألعاب حفلات، شاشة مضيفة وهواتف متحكمة | SDK الألعاب الصغيرة وبنية المتحكم | يعتمد على خادم Socket.IO (ليس بلا خادم)، 11 نجمة، نشاط غير واضح | [GitHub](https://github.com/Hartwich/Open-Party-Lab) |
| **PeerJS** | MIT | مكتبة WebRTC مبسطة | طبقة DataChannel جاهزة | الإشارة تحتاج PeerServer، أو خادم خاص | [GitHub](https://github.com/peers/peerjs) |
| **Trystero** | MIT | WebRTC بلا خادم، والإشارة عبر Nostr أو BitTorrent أو MQTT | مبدأ الإشارة بلا خادم | مُصان بنشاط، لكن الإشارة تعتمد على شبكات خارجية، وهذا مخالف للمتطلب | [GitHub](https://github.com/dmotz/trystero) |
| **acthung-webrtc** | غير مذكورة | لعبة Achtung die Kurve بمتحكمات الهواتف عبر WebRTC | نمط المتحكم عبر WebRTC | يحتاج خادم إشارة صغيرًا، يُتحقق من الصيانة | [GitHub](https://github.com/TobiasMelen/acthung-webrtc) |
| **LudumPad** | LGPL-3.0 (README) و MIT في الواجهة، متناقض | المتحكم بالهاتف للألعاب | فكرة الخادم المحلي الذي يخدم الصفحات | مشروع تجريبي (49 commit)، الرخصة تحتاج تحقق من ملف LICENSE | [GitHub](https://github.com/dasilvacontin/ludumpad) |
| **Controller-API (Couchfriends)** | غير مذكورة | متحكم لعبة HTML5 بالهاتف | واجهة برمجة المتحكم | WebSocket، والوصف يقول WebRTC، متناقض | [GitHub](https://github.com/Couchfriends/Controller-API) |
| **TouchCoop** | غير مُتحقَّق | مكتبة TypeScript للمتحكم بالهاتف عبر QR | فكرة الانضمام بـQR | لم يُفتح المستودع للتحقق من الرخصة | [DEV.to](https://dev.to/remojansen/turning-your-living-room-into-a-couch-co-op-arena-with-touchcoop-249j) |
| **MediaPipe Tasks Vision** | Apache-2.0 (مصدر ثانوي) | كشف الوضعية واليد والوجه في المتصفح | تحليل الكاميرا عبر Worker | الرخصة مذكورة في ويكيبيديا، ويجب مراجعة ملف LICENSE الرسمي ورخصة النماذج `.task` | [Wikipedia](https://en.wikipedia.org/wiki/MediaPipe)، [npm](https://www.npmjs.com/package/@mediapipe/tasks-vision) |
| **TensorFlow.js (Pose/MoveNet)** | Apache-2.0 | بديل MediaPipe لتقدير الوضعية | — | لم يُتحقَّق من مصدر مباشر في هذا البحث | ❔ |
| **Phaser** | MIT | محرك ألعاب 2D للمتصفح | خيار إن احتجنا محركًا جاهزًا | ❔ |

**التوصية:** لا تنسخ أيًّا منها كاملًا. الأكثر فائدة هو نمط **Open Party Lab** (المضيف والهاتف ككلٍّ منفصل) ومكتبة **PeerJS** إن احتجنا WebRTC، مع **MediaPipe** للكاميرا. Trystero مرجع للفكرة فقط لأنه يعتمد على شبكات خارجية.

---

## 5. فجوات ومعلومات غير مُتحقَّق منها

- جدول Battery API لـSafari وFirefox اعتمد على معرفة عامة، لم يُفتح جدول MDN الكامل.
- سلوك الإذن المحلي في Safari (هل تظهر رسالة؟) متناقض بين مصدرين، ولم يُحسم من Apple.
- حدود WebRTC على iOS الحالي (18+) تحتاج اختبارًا فعليًا.
- رخص TouchCoop، وrealtime-p2p-game، وacthung-webrtc غير واضحة.
- دعم `deviceMemory` في Safari غير مُتحقَّق.
- الأرقام الدقيقة لـ Android Go وذاكرة 2 GB اعتمدت على صفحات Android الرسمية، وليست بيانات أداء مقاسة.

---

## 6. التوصيات التالية

1. **اختبار على جهاز فعلي:** iPhone 13+ على iOS 18، وAndroid منخفض السعر (2 GB)، وSamsung Internet.
2. **تأكيد iOS:** إذن Local Network في Safari، وWebRTC مع IP محلي بعد منح الكاميرا.
3. **قرار البنية:** الكاميرا على المضيف، والهواتف بلا كاميرا.
4. **مرجع الرخص:** افتح LICENSE لـLudumPad وacthung-webrtc قبل نسخ أي شيء.

---
**ملاحظة المدير (2026-11-06):** البند الخاص بفشل `blob:` Worker داخل iframe sandbox بلا `allow-same-origin` يخالف قياسنا: في Chrome يعمل وضع iframe فعلًا (حزم الاختبار كلها في `mode=iframe`)، ولهذا السبب بالذات بُني التراجع التلقائي إلى وضع host للمتصفحات التي يفشل فيها. فالبند صحيح لبعض المتصفحات لا كلها، والمحرك يتعامل معه أصلًا. والتوصية بخفض دقة التحليل إلى 320×240 وتحليل إطار من كل ثلاثة تحقّقها جزئيًا 0.2.2 (المعدّل يتكيّف بين 30 و10 مرات/ث).
