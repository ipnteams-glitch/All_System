/* farm-avatar.js — ตัวละคร procedural วาดด้วย Canvas 2D (พอร์ตแนวคิดจาก vibemaster web/src/avatar.js)
 * 3 ธีม:
 *   'robot' — หุ่นยนต์ AI ฟ้านีออน โตตามเลเวล (ค่าเริ่มต้น)
 *   'farm'  — พืชมาสคอตที่ "โตตามเลเวลจริง" (เมล็ด → ต้นกล้า → ดอกบาน → รวงทอง)
 *   'dev'   — ชิบิพิกเซล (palette swap สี/ผม/หมวก) พอร์ตตรงจาก avatar.js
 * ไม่มีไฟล์ภาพ — วาดจาก rect/arc ล้วน. ออร่าตามดาว (tier 0–4).
 * พิกัดใช้ระบบ "ฐานเท้าที่ (cx,cy), แกน y ชี้ขึ้น" เหมือน avatar.js เดิม
 */
(function (global) {
  'use strict';
  const VMFarm = (global.VMFarm = global.VMFarm || {});
  const DARK = '#15161f';
  const AURA_COL = ['#8899aa', '#4fd1ff', '#a78bfa', '#ffb020', '#ffd23b'];

  // roundRect polyfill (เผื่อเบราว์เซอร์รุ่นเก่า)
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      if (typeof r === 'number') r = [r, r, r, r];
      const tl = r[0], tr = r[1], br = r[2], bl = r[3];
      this.beginPath();
      this.moveTo(x + tl, y);
      this.lineTo(x + w - tr, y);
      this.arcTo(x + w, y, x + w, y + tr, tr);
      this.lineTo(x + w, y + h - br);
      this.arcTo(x + w, y + h, x + w - br, y + h, br);
      this.lineTo(x + bl, y + h);
      this.arcTo(x, y + h, x, y + h - bl, bl);
      this.lineTo(x, y + tl);
      this.arcTo(x, y, x + tl, y, tl);
      this.closePath();
      return this;
    };
  }

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
    // วงแหวน risk คมชัด (ให้เห็นสีชัดทุกธีม/ทุกโทน โดยเฉพาะฟ้า Medium)
    ctx.globalAlpha = 0.55 + 0.25 * pulse;
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.7 * p;
    ctx.beginPath();
    ctx.ellipse(0, 0, (8 + tier * 1.6) * p, (2.2 + tier * 0.5) * p, 0, 0, Math.PI * 2);
    ctx.stroke();
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
    // เสื้ออิงระดับความเสี่ยง (High=แดง/Medium=ฟ้า/Low=เขียว); ไม่มีค่า risk ใช้สีตามชื่อระบบเดิม
    if (o.risk) cfg.shirt = o.risk === 'high' ? '#ff5b5b' : o.risk === 'low' ? '#3bf5a3' : '#35d0ff';
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

  // ===== ธีม robot: หุ่นยนต์ AI เรืองแสง (โตตามเลเวล) =====
  function drawRobot(ctx, p, o) {
    const t = o.t || 0;
    const level = o.level || 1;
    const mood = o.mood || 0;
    const pop = o.pop || 0;
    const g = Math.min(1, level / 25);
    const golden = level >= 25;
    const bob = Math.sin(t * 2) * 0.45 + pop * 2.5;
    const shake = mood < 0 ? Math.sin(t * 22) * 0.04 : 0;

    // สีตัว = ระดับความเสี่ยง (High=แดง / Medium=ฟ้า / Low=เขียว); กำไร/ขาดทุนแสดงที่หน้า+การสั่น
    const risk = o.risk || 'medium';
    const neon = risk === 'high' ? '#ff5b5b' : risk === 'low' ? '#3bf5a3' : '#35d0ff';
    const neonRGB = risk === 'high' ? '255,91,91' : risk === 'low' ? '59,245,163' : '53,208,255';
    const neonA = (a) => 'rgba(' + neonRGB + ',' + a + ')';
    const bodyHi = golden ? '#ffe38a' : '#42597a';
    const bodyMd = golden ? '#e6b73e' : '#243247';
    const bodyLo = golden ? '#a9791f' : '#121a28';
    const edge = golden ? '#fff3cc' : '#7fe9ff';

    const rect = (ux, uy, uw, uh, c) => { ctx.fillStyle = c; ctx.fillRect(ux * p, -(uy + uh) * p, uw * p, uh * p); };
    const rr = (ux, uy, uw, uh, r, c) => {
      ctx.fillStyle = c; ctx.beginPath();
      ctx.roundRect(ux * p, -(uy + uh) * p, uw * p, uh * p, r * p); ctx.fill();
    };
    const glow = (ux, uy, rad, a) => {
      const gx = ux * p, gy = -uy * p, gR = rad * p;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, gR);
      gr.addColorStop(0, neonA(a));
      gr.addColorStop(1, neonA(0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, gR, 0, Math.PI * 2); ctx.fill();
    };

    // เงาที่พื้น
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(0, 0, (5.5 + g) * p, 1.8 * p, 0, 0, Math.PI * 2);
    ctx.fill();

    // ไอพ่นลอยตัว (thruster)
    const jet = 0.55 + 0.45 * Math.sin(t * 9);
    const jg = ctx.createLinearGradient(0, 0, 0, -3.2 * p);
    jg.addColorStop(0, neonA(0));
    jg.addColorStop(1, neonA(0.5 * jet));
    ctx.fillStyle = jg;
    ctx.beginPath();
    ctx.moveTo(-1.9 * p, 0);
    ctx.lineTo(1.9 * p, 0);
    ctx.lineTo(1.0 * p, -3.2 * p);
    ctx.lineTo(-1.0 * p, -3.2 * p);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(0, -bob * p);
    if (shake) ctx.rotate(shake);

    // ปีกพลังงานด้านหลัง (Lv >= 15)
    if (level >= 15) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = golden ? '#ffd23b' : edge;
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(s * 3.6 * p, -9 * p);
        ctx.lineTo(s * (7.5 + g * 1.5) * p, -12.5 * p);
        ctx.lineTo(s * (7.0 + g * 1.5) * p, -8.5 * p);
        ctx.lineTo(s * (6.2 + g) * p, -6.0 * p);
        ctx.lineTo(s * 3.6 * p, -7 * p);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();
    }

    // แขน (Lv >= 4)
    if (level >= 4) {
      [-1, 1].forEach((s) => {
        rr(s > 0 ? 4.1 : -5.3, 6.5, 1.2, 5.2, 0.5, bodyMd);
        rr(s > 0 ? 4.2 : -5.4, 5.5, 1.4, 1.6, 0.5, bodyHi);
        rect(s > 0 ? 4.35 : -5.15, 6.3, 1.1, 0.35, neon);
      });
    }

    // ไหล่/เกราะบ่า (Lv >= 8)
    if (level >= 8) {
      rr(3.4, 10.8, 1.8, 1.9, 0.6, bodyHi);
      rr(-5.2, 10.8, 1.8, 1.9, 0.6, bodyHi);
    }

    // ฐานเรียวใต้ลำตัว
    ctx.fillStyle = bodyLo;
    ctx.beginPath();
    ctx.moveTo(-1.6 * p, -3.0 * p);
    ctx.lineTo(1.6 * p, -3.0 * p);
    ctx.lineTo(3.2 * p, -5.5 * p);
    ctx.lineTo(-3.2 * p, -5.5 * p);
    ctx.closePath();
    ctx.fill();

    // ลำตัวหลัก + ไล่เฉดโลหะ
    rr(-4, 5, 8, 7.3, 1.6, '#05070c');
    const tGrad = ctx.createLinearGradient(-4 * p, 0, 4 * p, 0);
    tGrad.addColorStop(0, bodyLo);
    tGrad.addColorStop(0.5, bodyHi);
    tGrad.addColorStop(1, bodyMd);
    ctx.fillStyle = tGrad;
    ctx.beginPath();
    ctx.roundRect(-3.7 * p, -12.1 * p, 7.4 * p, 6.9 * p, 1.4 * p);
    ctx.fill();
    rect(-0.12, 5.4, 0.24, 6.4, neonA(0.5));

    // แกนพลังงานกลางอก (โตตามเลเวล + เต้นตามจังหวะ)
    const coreY = 8.6;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    const coreR = 1.0 + g * 0.7;
    glow(0, coreY, (2.4 + g) * (0.9 + 0.25 * pulse), 0.45 + 0.15 * pulse);
    ctx.fillStyle = neon;
    ctx.beginPath();
    ctx.arc(0, -coreY * p, coreR * p, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -coreY * p, coreR * 0.45 * p, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (level >= 15) {
      ctx.strokeStyle = neon;
      ctx.lineWidth = 0.28 * p;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(0, -coreY * p, (coreR + 0.9) * p, t * 1.5, t * 1.5 + Math.PI * 1.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // คอ
    rect(-1.1, 12.0, 2.2, 0.9, bodyMd);

    // หัว
    rr(-3, 12.7, 6, 5.3, 1.3, '#05070c');
    const hGrad = ctx.createLinearGradient(0, -18 * p, 0, -12.7 * p);
    hGrad.addColorStop(0, bodyHi);
    hGrad.addColorStop(1, bodyMd);
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.roundRect(-2.75 * p, -17.85 * p, 5.5 * p, 4.85 * p, 1.1 * p);
    ctx.fill();

    // ไวเซอร์/ตาเรืองแสง + จุดสแกนวิ่ง
    glow(0, 15.1, 3.2, 0.4);
    const eyeW = mood < 0 ? 3.4 : 4.0;
    rr(-eyeW / 2, 14.5, eyeW, 1.3, 0.5, '#0a0f16');
    ctx.fillStyle = neon;
    ctx.fillRect(-(eyeW / 2 - 0.25) * p, -15.15 * p, (eyeW - 0.5) * p, 0.7 * p);
    const scan = ((Math.sin(t * 2) + 1) / 2) * (eyeW - 1.2) - (eyeW - 1.2) / 2;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((scan - 0.25) * p, -15.2 * p, 0.5 * p, 0.8 * p);
    ctx.globalAlpha = 1;

    // เสาอากาศ (Lv >= 8)
    if (level >= 8) {
      ctx.strokeStyle = bodyHi;
      ctx.lineWidth = 0.3 * p;
      ctx.beginPath();
      ctx.moveTo(-1.6 * p, -17.8 * p);
      ctx.lineTo(-2.4 * p, -20.2 * p);
      ctx.stroke();
      const bl = 0.5 + 0.5 * Math.sin(t * 6);
      glow(-2.4, 20.2, 1.2, 0.5 * bl + 0.2);
      ctx.fillStyle = neon;
      ctx.beginPath();
      ctx.arc(-2.4 * p, -20.2 * p, 0.45 * p, 0, Math.PI * 2);
      ctx.fill();
    }

    // วงแหวนโฮโลแกรมเหนือหัว (Lv >= 15)
    if (level >= 15) {
      ctx.strokeStyle = golden ? '#ffd23b' : neon;
      ctx.lineWidth = 0.35 * p;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, -19.2 * p, 3.2 * p, 0.9 * p, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ป้ายยศ: Recommend = มงกุฎ, Good = เชฟรอน
    const badge = o.badge || (o.recommend ? 'recommend' : '');
    if (badge === 'recommend') {
      const cy = level >= 15 ? 21.2 : 18.6;
      const cw = 3.0;
      ctx.fillStyle = '#ffd23b';
      ctx.beginPath();
      ctx.moveTo((-cw / 2) * p, -cy * p);
      ctx.lineTo((-cw / 2) * p, -(cy + 1.1) * p);
      ctx.lineTo((-cw / 4) * p, -(cy + 0.4) * p);
      ctx.lineTo(0, -(cy + 1.4) * p);
      ctx.lineTo((cw / 4) * p, -(cy + 0.4) * p);
      ctx.lineTo((cw / 2) * p, -(cy + 1.1) * p);
      ctx.lineTo((cw / 2) * p, -cy * p);
      ctx.closePath();
      ctx.fill();
    } else if (badge === 'good') {
      ctx.fillStyle = '#3ad1ff';
      [0, 0.9].forEach((dy) => {
        ctx.beginPath();
        ctx.moveTo(-1.3 * p, -(7.2 + dy) * p);
        ctx.lineTo(0, -(6.4 + dy) * p);
        ctx.lineTo(1.3 * p, -(7.2 + dy) * p);
        ctx.lineTo(1.3 * p, -(7.55 + dy) * p);
        ctx.lineTo(0, -(6.75 + dy) * p);
        ctx.lineTo(-1.3 * p, -(7.55 + dy) * p);
        ctx.closePath();
        ctx.fill();
      });
    }

    ctx.restore();
  }

  // ===== entry: วาดตัวละคร 1 ตัว =====
  function drawCreature(ctx, o) {
    const p = o.unit || 4;
    ctx.save();
    ctx.translate(o.cx || 0, o.cy || 0);
    const tier = Math.min(4, Math.max(0, o.stars || 0));
    // ออร่า/วงแหวนใต้ตัวเปลี่ยนสีตาม risk ทุกธีม (High=แดง/Medium=ฟ้า/Low=เขียว); ขนาด/ความเข้มยังอิงจำนวนดาว
    const riskAura = o.risk === 'high' ? '#ff5b5b' : o.risk === 'low' ? '#3bf5a3' : o.risk === 'medium' ? '#35d0ff' : AURA_COL[tier];
    drawAura(ctx, p, tier, riskAura, o.t || 0);
    if (o.theme === 'dev') drawDev(ctx, p, o);
    else if (o.theme === 'robot') drawRobot(ctx, p, o);
    else drawFarm(ctx, p, o);
    ctx.restore();
  }

  VMFarm.paletteFor = paletteFor;
  VMFarm.drawCreature = drawCreature;
})(typeof window !== 'undefined' ? window : this);
