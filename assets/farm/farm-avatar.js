/* farm-avatar.js — ตัวละคร procedural วาดด้วย Canvas 2D (พอร์ตแนวคิดจาก vibemaster web/src/avatar.js)
 * 2 ธีม:
 *   'farm' — พืชมาสคอตที่ "โตตามเลเวลจริง" (เมล็ด → ต้นกล้า → ดอกบาน → รวงทอง)
 *   'dev'  — ชิบิพิกเซล (palette swap สี/ผม/หมวก) พอร์ตตรงจาก avatar.js
 * ไม่มีไฟล์ภาพ — วาดจาก rect/arc ล้วน. ออร่าตามดาว (tier 0–4).
 * พิกัดใช้ระบบ "ฐานเท้าที่ (cx,cy), แกน y ชี้ขึ้น" เหมือน avatar.js เดิม
 */
(function (global) {
  'use strict';
  const VMFarm = (global.VMFarm = global.VMFarm || {});
  const DARK = '#15161f';
  const AURA_COL = ['#8899aa', '#4fd1ff', '#a78bfa', '#ffb020', '#ffd23b'];

  function hashHue(s) {
    s = String(s);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  function paletteFor(name) {
    const hue = hashHue(name);
    const skin = ['#ffe0bd', '#f1c27d', '#e0ac69', '#c68642'][hashHue(name + 's') % 4];
    return {
      hue: hue,
      skin: skin,
      shirt: `hsl(${hue},60%,55%)`,
      pants: `hsl(${(hue + 30) % 360},35%,38%)`,
      hair: `hsl(${(hue + 200) % 360},45%,${25 + (hue % 15)}%)`,
      hairStyle: ['short', 'spiky', 'long', 'mohawk'][hashHue(name + 'h') % 4],
    };
  }

  // ===== ออร่าตามดาว (tier 1–4) วาดหลังตัว =====
  function drawAura(ctx, p, tier, col, t) {
    if (tier <= 0) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    const cy = -8 * p;
    ctx.save();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.10 + 0.04 * tier + 0.05 * pulse;
    ctx.beginPath();
    ctx.ellipse(0, 0, (8 + tier * 1.6) * p, (2.2 + tier * 0.5) * p, 0, 0, Math.PI * 2);
    ctx.fill();
    if (tier >= 2) {
      ctx.globalAlpha = 0.05 + 0.035 * pulse;
      ctx.beginPath();
      ctx.arc(0, cy, (10 + tier * 1.8) * p, 0, Math.PI * 2);
      ctx.fill();
    }
    if (tier >= 3) {
      const n = tier >= 4 ? 6 : 4;
      const rx = (9 + tier) * p, ry = (6 + tier) * p, sz = (tier >= 4 ? 1.6 : 1.3) * p;
      ctx.globalAlpha = 0.45 + 0.4 * pulse;
      for (let i = 0; i < n; i++) {
        const a = t * 2 + (i * 2 * Math.PI) / n;
        ctx.fillRect(Math.cos(a) * rx - sz / 2, cy + Math.sin(a) * ry - sz / 2, sz, sz);
      }
    }
    ctx.restore();
  }

  // ===== ธีม farm: พืชมาสคอตโตตามเลเวล =====
  function drawFarm(ctx, p, o) {
    const t = o.t || 0;
    const level = o.level || 1;
    const mood = o.mood || 0;
    const hue = o.cfg && o.cfg.hue != null ? o.cfg.hue : 110;
    const pop = o.pop || 0;
    const g = Math.min(1, level / 25);
    const sway = Math.sin(t * 2) * 0.12;
    const bounce = Math.sin(t * 3) * 0.4 + pop * 3;

    // เงา
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7 * p, 2.2 * p, 0, 0, Math.PI * 2);
    ctx.fill();
    // เนินดิน
    ctx.fillStyle = '#5a3a24';
    ctx.beginPath();
    ctx.ellipse(0, -0.6 * p, 6 * p, 2.6 * p, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#6b4630';
    ctx.beginPath();
    ctx.ellipse(0, -1.1 * p, 5.2 * p, 1.7 * p, 0, Math.PI, 0);
    ctx.fill();

    const baseY = -1.6 * p - bounce * p;
    ctx.save();
    ctx.translate(0, baseY);
    ctx.rotate(sway);

    const stemH = (6 + g * 8) * p;
    // ก้าน
    ctx.strokeStyle = `hsl(${110 + (hue % 40)},55%,36%)`;
    ctx.lineWidth = 1.8 * p;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -stemH);
    ctx.stroke();

    // ใบ (เพิ่มตามเลเวล)
    const leafCol = `hsl(${110 + (hue % 50)},60%,44%)`;
    const nLeaves = Math.min(4, 1 + Math.floor(level / 4));
    for (let i = 0; i < nLeaves; i++) {
      const ly = -stemH * (0.22 + 0.18 * i);
      const side = i % 2 === 0 ? 1 : -1;
      ctx.save();
      ctx.translate(0, ly);
      ctx.rotate(side * 0.6);
      ctx.fillStyle = leafCol;
      ctx.beginPath();
      ctx.ellipse(side * 2.2 * p, 0, 2.6 * p, 1.1 * p, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const bulbY = -stemH;
    const br = (3.2 + g * 2.4) * p;
    const golden = level >= 25;
    // กลีบดอก (level >= 15)
    if (level >= 15) {
      const petalCol = golden ? '#ffd23b' : `hsl(${(hue + 25) % 360},70%,62%)`;
      const nP = golden ? 8 : 6;
      ctx.fillStyle = petalCol;
      for (let i = 0; i < nP; i++) {
        const a = (i * 2 * Math.PI) / nP + t * 0.25;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * br * 1.15, bulbY + Math.sin(a) * br * 1.15, br * 0.6, br * 0.4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // หน้ากลม
    ctx.fillStyle = golden ? '#f6df86' : `hsl(${(hue + 15) % 360},62%,72%)`;
    ctx.beginPath();
    ctx.arc(0, bulbY, br, 0, Math.PI * 2);
    ctx.fill();
    // แก้ม
    ctx.fillStyle = 'rgba(255,120,120,0.55)';
    ctx.beginPath();
    ctx.arc(-br * 0.52, bulbY + br * 0.2, br * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(br * 0.52, bulbY + br * 0.2, br * 0.2, 0, Math.PI * 2);
    ctx.fill();
    // ตา (กระพริบ)
    const blink = Math.sin(t * 1.7) > 0.95;
    ctx.fillStyle = '#26343f';
    const ey = bulbY - br * 0.05;
    if (blink) {
      ctx.fillRect(-br * 0.46, ey - br * 0.03, br * 0.28, br * 0.07);
      ctx.fillRect(br * 0.18, ey - br * 0.03, br * 0.28, br * 0.07);
    } else {
      ctx.beginPath();
      ctx.arc(-br * 0.32, ey, br * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(br * 0.32, ey, br * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    // ปากตามอารมณ์
    ctx.strokeStyle = '#9a4a3a';
    ctx.lineWidth = Math.max(1, br * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const my = bulbY + br * 0.36;
    if (mood > 0) ctx.arc(0, my - br * 0.12, br * 0.26, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood < 0) ctx.arc(0, my + br * 0.22, br * 0.26, 1.15 * Math.PI, 1.85 * Math.PI);
    else {
      ctx.moveTo(-br * 0.16, my);
      ctx.lineTo(br * 0.16, my);
    }
    ctx.stroke();
    // หมวกตาม label: Recommend = มงกุฎ, Good = หมวกปีกธรรมดา
    const badge = o.badge || (o.recommend ? 'recommend' : '');
    if (badge === 'recommend' || badge === 'good') {
      const cy = bulbY - br * (level >= 15 ? 1.9 : 1.05);
      if (badge === 'recommend') {
        ctx.fillStyle = '#ffd43b';
        const cw = br * 1.3;
        ctx.beginPath();
        ctx.moveTo(-cw / 2, cy + br * 0.35);
        ctx.lineTo(-cw / 2, cy - br * 0.1);
        ctx.lineTo(-cw / 4, cy + br * 0.12);
        ctx.lineTo(0, cy - br * 0.25);
        ctx.lineTo(cw / 4, cy + br * 0.12);
        ctx.lineTo(cw / 2, cy - br * 0.1);
        ctx.lineTo(cw / 2, cy + br * 0.35);
        ctx.closePath();
        ctx.fill();
      } else {
        // หมวกปีกธรรมดา (Good)
        ctx.fillStyle = '#3aa0ff';
        ctx.beginPath();
        ctx.arc(0, cy + br * 0.12, br * 0.62, Math.PI, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-br * 0.95, cy + br * 0.12, br * 1.9, br * 0.2);
      }
    }
    ctx.restore();
  }

  // ===== ธีม dev: ชิบิพิกเซล (พอร์ตจาก avatar.js) =====
  function drawHair(rect, cfg) {
    const h = cfg.hair;
    switch (cfg.hairStyle) {
      case 'bald':
        break;
      case 'spiky':
        rect(-4, 20.5, 8, 1.5, h);
        rect(-3.5, 21.5, 1.5, 1.6, h); rect(-1, 21.5, 1.5, 2, h); rect(1.5, 21.5, 1.5, 1.6, h);
        rect(-4, 17, 1, 4, h); rect(3, 17, 1, 4, h);
        break;
      case 'long':
        rect(-4.2, 19, 8.4, 2.5, h);
        rect(-4.2, 12, 1.4, 9, h); rect(2.8, 12, 1.4, 9, h);
        break;
      case 'mohawk':
        rect(-1, 20.5, 2, 3, h);
        rect(-4, 20.5, 8, 1, h);
        break;
      default:
        rect(-4.2, 19.5, 8.4, 2.5, h);
        rect(-4.2, 17, 1, 3.5, h); rect(3.2, 17, 1, 3.5, h);
    }
  }
  function drawAccessory(rect, cfg, acc) {
    switch (acc) {
      case 'glasses':
        rect(-3, 16, 2.4, 2, DARK); rect(0.6, 16, 2.4, 2, DARK);
        rect(-3, 16.6, 2.4, 0.8, '#bfe3ff'); rect(0.6, 16.6, 2.4, 0.8, '#bfe3ff');
        rect(-0.6, 16.8, 1.2, 0.5, DARK);
        break;
      case 'headphones':
        rect(-4.6, 21, 9.2, 1.2, '#2b2b2b');
        rect(-5.2, 15.5, 1.6, 3.5, '#3aa0ff'); rect(3.6, 15.5, 1.6, 3.5, '#3aa0ff');
        break;
      case 'cap':
        rect(-4.5, 20.5, 9, 1.8, '#e0563a');
        rect(-4.5, 20.5, 6, 0.8, '#1f1f1f'); // ปีกหมวก
        rect(-1, 21.8, 2, 1, '#e0563a');
        break;
      case 'wizard_hat':
        rect(-5, 20.5, 10, 1.5, '#5b2c9e'); rect(-3.5, 22, 7, 1.5, '#5b2c9e');
        rect(-2, 23.5, 4, 1.6, '#6a3cb5'); rect(-0.8, 25, 2, 1.6, '#7b4cc7');
        rect(-0.5, 26.5, 1.4, 1.4, '#ffd43b');
        break;
      case 'crown':
        rect(-4, 21, 8, 1.4, '#ffd43b');
        rect(-4, 22.2, 1.4, 1.4, '#ffd43b'); rect(-0.7, 22.2, 1.4, 1.6, '#ffd43b'); rect(2.6, 22.2, 1.4, 1.4, '#ffd43b');
        rect(-0.4, 21.2, 0.8, 0.8, '#ff6b6b');
        break;
    }
  }
  function drawDev(ctx, p, o) {
    const t = o.t || 0;
    const mood = o.mood || 0;
    const cfg = o.cfg || paletteFor('x');
    const level = o.level || 1;
    const pop = o.pop || 0;
    const happy = mood > 0, sad = mood < 0;
    const bob = (happy ? Math.abs(Math.sin(t * 8)) * 0.9 : Math.sin(t * 3) * 0.4) + pop * 3;

    // เงา (ที่ฐานจริง)
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7 * p, 2 * p, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(0, -bob * p);
    if (sad) ctx.rotate(Math.sin(t * 20) * 0.05);

    const rect = (ux, uy, uw, uh, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(ux * p, -(uy + uh) * p, uw * p, uh * p);
    };

    // ขา + รองเท้า
    rect(-4, 0, 3, 6, cfg.pants); rect(1, 0, 3, 6, cfg.pants);
    rect(-4, 0, 3, 1.2, DARK); rect(1, 0, 3, 1.2, DARK);
    // ลำตัว
    rect(-4.5, 5, 9, 8, cfg.shirt); rect(-4.5, 12, 9, 1, DARK);
    // แขนตามอารมณ์
    if (happy) {
      rect(-6, 12, 2, 5, cfg.shirt); rect(-6, 16, 2, 1.5, cfg.skin);
      rect(4, 12, 2, 5, cfg.shirt); rect(4, 16, 2, 1.5, cfg.skin);
    } else if (sad) {
      rect(-7, 5, 2, 4, cfg.shirt); rect(-7, 5, 2, 1.5, cfg.skin);
      rect(5, 5, 2, 4, cfg.shirt); rect(5, 5, 2, 1.5, cfg.skin);
    } else {
      rect(-6, 6, 2, 5, cfg.shirt); rect(-6, 6, 2, 1.5, cfg.skin);
      rect(4, 6, 2, 5, cfg.shirt); rect(4, 6, 2, 1.5, cfg.skin);
    }
    // หัว
    rect(-4, 13, 8, 8, cfg.skin);
    // ตา
    const blink = Math.sin(t * 1.7) > 0.95;
    const eyeY = blink ? 16.6 : 16, eyeH = blink ? 0.5 : 2;
    rect(-2.6, eyeY, 1.6, eyeH, DARK); rect(1, eyeY, 1.6, eyeH, DARK);
    // แก้ม
    rect(-3.4, 14.6, 1.2, 1, 'rgba(255,150,150,0.9)'); rect(2.2, 14.6, 1.2, 1, 'rgba(255,150,150,0.9)');
    // ปาก
    if (happy) {
      rect(-1.4, 14, 0.8, 0.7, '#9a4a3a'); rect(-0.6, 13.6, 1.2, 0.7, '#9a4a3a'); rect(0.6, 14, 0.8, 0.7, '#9a4a3a');
    } else if (sad) {
      rect(-1.4, 13.8, 0.8, 0.7, '#9a4a3a'); rect(-0.6, 14.4, 1.2, 0.7, '#9a4a3a'); rect(0.6, 13.8, 0.8, 0.7, '#9a4a3a');
    } else {
      rect(-1, 14.2, 2, 0.7, '#9a4a3a');
    }
    // ผม + accessory: Recommend = มงกุฎ, Good = หมวกปีก, ที่เหลือเลือกตามเลเวล
    drawHair(rect, cfg);
    const badge = o.badge || (o.recommend ? 'recommend' : '');
    const acc = badge === 'recommend' ? 'crown' : badge === 'good' ? 'cap' : level >= 25 ? 'wizard_hat' : level >= 8 ? 'headphones' : level >= 4 ? 'glasses' : 'none';
    drawAccessory(rect, cfg, acc);

    ctx.restore();
  }

  // ===== entry: วาดตัวละคร 1 ตัว =====
  function drawCreature(ctx, o) {
    const p = o.unit || 4;
    ctx.save();
    ctx.translate(o.cx || 0, o.cy || 0);
    const tier = Math.min(4, Math.max(0, o.stars || 0));
    drawAura(ctx, p, tier, AURA_COL[tier], o.t || 0);
    if (o.theme === 'dev') drawDev(ctx, p, o);
    else drawFarm(ctx, p, o);
    ctx.restore();
  }

  VMFarm.paletteFor = paletteFor;
  VMFarm.drawCreature = drawCreature;
})(typeof window !== 'undefined' ? window : this);
