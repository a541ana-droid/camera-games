// @title parity: Canvas2D reference scene
// @engine 0.2
// @capabilities hud
// @assets spr=tests/games/spr.png
// مشهد رسم حتمي (بلا زمن/عشوائية) يغطي واجهة ctx. يُقارَن ناتجه عبر Worker+مخزن الأوامر بناتج canvas حقيقي بالمشهد نفسه.
let SPR = null;
defineGame({
  init(api) { SPR = api.assets.image('spr'); },
  render(ctx, w, h) {
    ctx.fillStyle = '#203040'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(240,165,58,0.8)'; ctx.fillRect(20, 20, 120, 80); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(20, 20, 120, 80);
    ctx.beginPath(); ctx.arc(220, 60, 40, 0, Math.PI * 1.5); ctx.lineTo(220, 60); ctx.closePath(); ctx.fillStyle = '#4cc38a'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(340, 60, 50, 25, 0.4, 0, 6.2); ctx.fillStyle = '#e5484d'; ctx.fill();
    ctx.setLineDash([10, 6]); ctx.lineWidth = 2; ctx.strokeStyle = '#f5d90a'; ctx.beginPath(); ctx.moveTo(20, 130); ctx.lineTo(200, 130); ctx.quadraticCurveTo(260, 180, 320, 130); ctx.bezierCurveTo(340, 100, 380, 160, 420, 130); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(100, 260); ctx.rotate(0.3); ctx.scale(1.2, 0.8); ctx.fillStyle = '#3b82f6'; ctx.fillRect(-40, -30, 80, 60); ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(-20, -10, 80, 40); ctx.restore();
    ctx.fillStyle = '#9b59b6'; ctx.beginPath(); ctx.roundRect(200, 220, 150, 70, 18); ctx.fill();
    const g = ctx.createLinearGradient(380, 200, 520, 300); g.addColorStop(0, '#ff0'); g.addColorStop(1, '#f0f'); ctx.fillStyle = g; ctx.fillRect(380, 200, 140, 100);
    const rg = ctx.createRadialGradient(600, 250, 5, 600, 250, 60); rg.addColorStop(0, '#fff'); rg.addColorStop(1, '#036'); ctx.fillStyle = rg; ctx.fillRect(540, 190, 120, 120);
    ctx.save(); ctx.beginPath(); ctx.rect(450, 20, 100, 100); ctx.clip(); ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.arc(500, 70, 70, 0, 7); ctx.fill(); ctx.restore();
    ctx.shadowColor = '#000'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4; ctx.fillStyle = '#fff'; ctx.fillRect(580, 30, 60, 40); ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(80,0,0,1)'; ctx.fillRect(560, 40, 60, 40); ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = 'bold 28px sans-serif'; ctx.fillText('Hello', 120, 360); ctx.direction = 'rtl'; ctx.font = '26px sans-serif'; ctx.fillText('المس الشاشة للبدء', 380, 360); ctx.direction = 'ltr';
    ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.font = '40px sans-serif'; ctx.strokeText('Aa', 600, 360);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = '16px sans-serif'; ctx.fillText('left-aligned', 20, 420);
    ctx.drawImage(SPR, 20, 440); ctx.drawImage(SPR, 70, 440, 64, 64); ctx.drawImage(SPR, 8, 8, 16, 16, 150, 440, 48, 48);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0f0'; ctx.fillRect(w - 30, h - 30, 20, 20);
    ctx.arcTo && (ctx.beginPath(), ctx.moveTo(250, 450), ctx.arcTo(330, 450, 330, 520, 30), ctx.lineTo(330, 520), ctx.strokeStyle = '#0ff', ctx.lineWidth = 3, ctx.stroke());
  }
});
