// @title عرض العُدّة
// @desc يرسم كل مساعدات api.ui في ثلاثة مشاهد (المس الشاشة للتبديل): ساكنة تمامًا (ui.still) فتُقارَن بكسلًا ببكسل بين تشغيلين.
// @series no
// @engine 0.2
// @capabilities
// @accent #ff7a45
let ui, view = 0, rects = null;
defineGame({
  init(a) { ui = a.ui; ui.still = true; },
  onTap() { view = (view + 1) % 3; },
  update() {},
  render(c, w, h) {
    ui.background(c);
    if (view === 1) { ui.title(c, 'عرض العُدّة', 'وصف قصير للعبة يشرح الفكرة في سطرين أو ثلاثة بكلمات بسيطة'); return; }
    if (view === 2) { ui.results(c, { title: 'انتهت الجولة', score: 128, label: 'نقطة', lines: ['أفضل تتابع 5', 'الوقت 24 ثانية'], players: [{ label: 'سارة', score: 3 }, { label: 'ليلى', score: 5 }, { label: 'أحمد', score: 1 }], winner: 1 }); return; }
    ui.progress(c, 0.6);
    ui.bigText(c, 'أمسك شيئًا أحمر', { y: h * 0.16 });
    for (let i = 0; i < 4; i++) ui.playerChip(c, i, w / 2, h * 0.26 + i * 52, { label: 'لاعب ' + ui.num(i + 1), score: i * 3, active: i === 1 });
    ui.meter(c, 0.3, { y: h * 0.6, threshold: 0.5, label: 'هدف لم يتحقق' });
    ui.meter(c, 0.7, { y: h * 0.68, threshold: 0.5, label: 'هدف تحقق' });
    ui.meter(c, 0.7, { y: h * 0.76, threshold: 0.5, label: 'حدّ الحركة', limit: true });
    rects = ui.row(rects, 3, h * 0.82, 52);
    ui.button(c, rects[0], '2 لاعبان', { on: true }); ui.button(c, rects[1], '3 لاعبين'); ui.button(c, rects[2], 'ابدأ', { primary: true });
    for (let i = 0; i < 4; i++) ui.shape(c, i, 40 + i * 40, h - 40, 14);
    ui.draw(c);
  }
});
