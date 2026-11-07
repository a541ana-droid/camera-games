'use strict';
// هوية اللاعب في المضيف (ردهة التلفاز، الجوال ذراعًا، شاشة النتيجة): لونه وشكله فقط (DESIGN.md §2) — بلا وجوه ولا عيون ولا شخصيات.
// 1 أزرق دائرة · 2 وردي مثلث · 3 أصفر مربع · 4 أخضر معيّن. هي نفسها ui.theme.players وui.shape داخل الألعاب (runtime.js).
window.CGPlayers = (() => {
  const INFO = Object.freeze([
    ['#4da3ff', 'circle', 'أزرق', 'دائرة'], ['#ff6b8b', 'triangle', 'وردي', 'مثلث'], ['#ffc145', 'square', 'أصفر', 'مربع'], ['#3ddc97', 'diamond', 'أخضر', 'معيّن']
  ].map(p => Object.freeze({ color: p[0], shape: p[1], name: p[2], shapeName: p[3], label: p[2] + ' · ' + p[3] })));
  const idx = i => (((i | 0) % 4) + 4) % 4;
  const NS = 'http://www.w3.org/2000/svg';
  // مسارات بمربّع 100×100 بهندسة shapePath في runtime.js نفسها تقريبًا؛ الزوايا ليّنة بحدّ من اللون نفسه
  const PATH = ['M50 8a42 42 0 1 0 .01 0Z', 'M50 9L92 84H8Z', 'M22 12H78Q88 12 88 22V78Q88 88 78 88H22Q12 88 12 78V22Q12 12 22 12Z', 'M50 4L94 50L50 96L6 50Z'];
  function el(i, cls) { // عنصر SVG للشكل؛ المقاس من CSS
    i = idx(i); const s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('class', 'psh' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true'); s.dataset.shape = INFO[i].shape;
    p.setAttribute('d', PATH[i]); p.setAttribute('fill', INFO[i].color); p.setAttribute('stroke', INFO[i].color); p.setAttribute('stroke-width', i === 0 ? '0' : '8'); p.setAttribute('stroke-linejoin', 'round');
    s.append(p); return s;
  }
  function draw(g, i, x, y, r) { // على canvas (مقبض عصا الجوال): r نصف القطر تقريبًا
    i = idx(i); g.beginPath();
    if (i === 0) g.arc(x, y, r, 0, Math.PI * 2);
    else if (i === 1) { g.moveTo(x, y - r * 1.05); g.lineTo(x + r, y + r * 0.78); g.lineTo(x - r, y + r * 0.78); g.closePath(); }
    else if (i === 2) { const k = r * 0.86; if (g.roundRect) g.roundRect(x - k, y - k, k * 2, k * 2, r * 0.22); else g.rect(x - k, y - k, k * 2, k * 2); }
    else { g.moveTo(x, y - r * 1.1); g.lineTo(x + r, y); g.lineTo(x, y + r * 1.1); g.lineTo(x - r, y); g.closePath(); }
    g.fillStyle = INFO[i].color; g.lineJoin = 'round'; g.lineWidth = r * 0.16; g.strokeStyle = INFO[i].color; g.fill(); if (i) g.stroke();
  }
  return Object.freeze({ info: INFO, el, draw, idx });
})();
