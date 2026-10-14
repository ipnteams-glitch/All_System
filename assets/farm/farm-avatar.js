/* farm-avatar.js — รถแข่ง procedural วาดด้วย Canvas 2D (ธีมเดียว)
 * ใช้ "กำไรต่อทุน" (growth %) เป็นตัวตัดสินสถานะ:
 *   growth < 0        → รถพัง (ควัน + ประกายไฟ + เอียงหัวทิ่ม, จอดนิ่ง)
 *   growth >= turboAt → ติดเทอร์โบ (เปลวไฟแรง + speed lines + ตัวสั่นเร็ว)
 * สีตัวรถ = ระดับความเสี่ยง (High=แดง / Medium=ฟ้า / Low=เขียว)
 * ยกระดับตามเลเวล: Lv>=8 มีปีกหลัง, Lv>=25 รถทอง (golden)
 * ป้ายยศ: Recommend = มงกุฎ, Good = หมวกปีก
 * ไม่มีไฟล์ภาพ — วาดจาก path/arc ล้วน. หันหัวไปทางขวา (เส้นชัยอยู่ขวา)
 * พิกัด: ล้อแตะพื้นที่ y = +7*unit จากจุด (cx,cy) ที่ส่งเข้ามา
 */
(function (global) {
  'use strict';
  const VMFarm = (global.VMFarm = global.VMFarm || {});

  const DEFAULT_TURBO = 60; // % กำไรต่อทุน ที่เริ่มติดเทอร์โบ

  function riskCol(r) { return r === 'high' ? '#ff4d4d' : r === 'low' ? '#2fe08a' : '#36b4ff'; }
  function riskDark(r) { return r === 'high' ? '#7a1414' : r === 'low' ? '#0c6e42' : '#0d4f7a'; }
  function riskRGB(r) { return r === 'high' ? '255,77,77' : r === 'low' ? '47,224,138' : '54,180,255'; }

  function wheel(ctx, cx, cy, rad, col, spin, dead) {
    ctx.fillStyle = '#0b0b0f'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.92, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b2d38'; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.5, 0, 7); ctx.fill();
    ctx.strokeStyle = dead ? '#555' : col; ctx.lineWidth = rad * 0.14;
    ctx.beginPath(); ctx.arc(cx, cy, rad * 0.5, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = rad * 0.1;
    for (let i = 0; i < 5; i++) {
      const a = spin + i * 2 * Math.PI / 5;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * rad * 0.46, cy + Math.sin(a) * rad * 0.46); ctx.stroke();
    }
    ctx.fillStyle = dead ? '#555' : col; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.13, 0, 7); ctx.fill();
  }

  // วาดรถ 1 คัน ที่พิกัด (o.cx, o.cy); o = { cx, cy, unit, t, risk, level, badge, growth, turboAt }
  function drawCar(ctx, o) {
    const s = o.unit || 4;
    const t = o.t || 0;
    const growth = Number(o.growth) || 0;
    const turboAt = o.turboAt != null ? o.turboAt : DEFAULT_TURBO;
    const risk = o.risk || 'medium';
    const level = o.level || 1;
    const badge = o.badge || (o.recommend ? 'recommend' : '');
    const stars = Math.max(0, Math.min(5, o.stars || 0));
    const broken = growth < 0;
    const turbo = growth >= turboAt;

    let col, dk, rgb;
    if (broken) { col = '#6b7280'; dk = '#2a2f38'; rgb = '120,130,145'; }
    else if (o.carColor) { col = o.carColor.main; dk = o.carColor.dark; rgb = o.carColor.rgb; }
    else { col = riskCol(risk); dk = riskDark(risk); rgb = riskRGB(risk); }
    const golden = level >= 25 && !broken;
    const bodyLo = golden ? '#9c6f1c' : dk, bodyHi = golden ? '#ffe79a' : col;

    ctx.save();
    ctx.translate(o.cx || 0, o.cy || 0);

    // ควัน (รถพัง) — วาดใต้รถก่อน
    if (broken) {
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.6 + i * 0.37) % 1;
        const px = -8 * s - ph * 10 * s, py = -6 * s - ph * 16 * s, r = (2 + ph * 5) * s;
        ctx.globalAlpha = 0.35 * (1 - ph);
        ctx.fillStyle = i % 2 ? '#3a3f47' : '#555b63';
        ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    const wob = broken ? (Math.sin(t * 3) * 0.3) : (turbo ? Math.sin(t * 26 + o.cx) * 1.1 : Math.sin(t * 9 + o.cx) * 0.5);
    ctx.translate(0, wob);
    if (broken) ctx.rotate(0.12); // เอียงหัวทิ่ม
    const wr = 7 * s, spin = broken ? 0 : t * 11;

    // เทอร์โบ: speed lines
    if (turbo && !broken) {
      ctx.strokeStyle = 'rgba(' + rgb + ',0.5)'; ctx.lineWidth = 1.2 * s;
      for (let i = 0; i < 4; i++) {
        const sx = -20 * s - ((t * 60 + i * 14) % 42) * s;
        ctx.globalAlpha = 0.4; ctx.beginPath();
        ctx.moveTo(sx, (-3 + i * 3) * s); ctx.lineTo(sx - 10 * s, (-3 + i * 3) * s); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // ไอพ่นท้ายรถ ตามจำนวนดาว: 3=สั้น, 4+=ยาว (turbo บังคับยาว)
    if (!broken && (stars >= 3 || turbo)) {
      const longJet = (stars >= 4 || turbo);
      const jetEnd = -19 * s - (longJet ? 30 : 15) * s;
      const fl = 0.6 + 0.4 * Math.sin(t * 28 + o.cx);
      const fg = ctx.createLinearGradient(-19 * s, 0, jetEnd, 0);
      fg.addColorStop(0, '#fff'); fg.addColorStop(0.3, 'rgba(' + rgb + ',0.95)');
      fg.addColorStop(0.65, 'rgba(255,200,90,0.6)'); fg.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.globalAlpha = fl; ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(-19 * s, -2 * s); ctx.lineTo(jetEnd, 2 * s); ctx.lineTo(-19 * s, 6 * s); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ปีกหลัง (Lv>=8)
    if (level >= 8 && !broken) {
      ctx.fillStyle = golden ? '#ffd23b' : col;
      ctx.fillRect(-21 * s, -13 * s, 2.4 * s, 13 * s);
      ctx.beginPath();
      ctx.moveTo(-23 * s, -13 * s); ctx.lineTo(-13 * s, -12 * s); ctx.lineTo(-13 * s, -9.5 * s); ctx.lineTo(-23 * s, -10.5 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = dk; ctx.fillRect(-21 * s, -8 * s, 7 * s, 1.6 * s);
    }

    wheel(ctx, -14 * s, 7 * s, wr, col, spin, broken);

    // พื้นรถ
    ctx.fillStyle = bodyLo; ctx.beginPath();
    ctx.moveTo(-19 * s, 8 * s); ctx.lineTo(22 * s, 8 * s); ctx.lineTo(22 * s, 5.5 * s); ctx.lineTo(-19 * s, 6 * s);
    ctx.closePath(); ctx.fill();

    // ตัวรถเพรียว
    const g = ctx.createLinearGradient(0, -6 * s, 0, 7 * s);
    g.addColorStop(0, bodyHi); g.addColorStop(0.55, col); g.addColorStop(1, bodyLo);
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(-18 * s, 6 * s);
    ctx.lineTo(-15 * s, -1 * s);
    ctx.quadraticCurveTo(-10 * s, -4 * s, -3 * s, -4.2 * s);
    ctx.quadraticCurveTo(3 * s, -4.4 * s, 6 * s, -2 * s);
    ctx.quadraticCurveTo(14 * s, -1 * s, 30 * s, 3.5 * s);
    ctx.lineTo(30 * s, 5 * s);
    ctx.quadraticCurveTo(16 * s, 5.5 * s, -18 * s, 6.4 * s);
    ctx.closePath(); ctx.fill();

    // airbox
    ctx.fillStyle = dk; ctx.beginPath();
    ctx.moveTo(-14 * s, -1 * s); ctx.lineTo(-9 * s, -8 * s); ctx.lineTo(-6 * s, -8 * s); ctx.lineTo(-6 * s, -3 * s);
    ctx.closePath(); ctx.fill();

    // halo + ค็อกพิต
    ctx.fillStyle = '#0c0f16'; ctx.beginPath(); ctx.ellipse(-1 * s, -4.5 * s, 5 * s, 2.2 * s, 0, 0, Math.PI, true); ctx.fill();
    ctx.strokeStyle = '#0c0f16'; ctx.lineWidth = 1.3 * s; ctx.beginPath(); ctx.arc(-1 * s, -3 * s, 4.3 * s, Math.PI * 1.08, Math.PI * 1.95); ctx.stroke();

    // นักขับ (helmet)
    ctx.fillStyle = golden ? '#fff2c4' : '#e9eef5'; ctx.beginPath(); ctx.arc(-2 * s, -5.2 * s, 2.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(-4.3 * s, -5.8 * s, 4.6 * s, 1.4 * s);
    ctx.fillStyle = '#0c0f16'; ctx.fillRect(-4.3 * s, -5.1 * s, 3.6 * s, 1.1 * s); // visor

    // แถบนีออนข้างรถ
    ctx.fillStyle = golden ? '#ffd23b' : '#ffffff'; ctx.globalAlpha = 0.85;
    ctx.fillRect(-12 * s, 2.2 * s, 3 * s, 2.6 * s); ctx.globalAlpha = 1;

    // ปีกหน้า
    ctx.fillStyle = golden ? '#ffd23b' : col; ctx.beginPath();
    ctx.moveTo(27 * s, 3.5 * s); ctx.lineTo(33 * s, 3 * s); ctx.lineTo(33 * s, 6.5 * s); ctx.lineTo(27 * s, 5.5 * s);
    ctx.closePath(); ctx.fill();

    wheel(ctx, 20 * s, 7 * s, wr * 0.98, col, spin, broken);

    // ประกายไฟ + ป้าย "พัง" (รถพัง)
    if (broken) {
      for (let i = 0; i < 4; i++) {
        const ph = (t * 2 + i * 0.5) % 1;
        if (ph < 0.5) {
          ctx.globalAlpha = 1 - ph * 2;
          ctx.fillStyle = i % 2 ? '#ffb020' : '#ff5b2e';
          const sx = -10 * s + Math.sin(i * 9) * 4 * s, sy = -1 * s - ph * 8 * s;
          ctx.fillRect(sx, sy, 1.6 * s, 1.6 * s);
        }
      }
      ctx.globalAlpha = 1;
      // ข้อความสถานะ (พัง/DNF) วาดโดย farm-cards.js เพื่อรองรับหลายภาษา
    } else {
      // Recommend → บาเรียแนวตั้งรอบคัน (vertical shield bars)
      if (badge === 'recommend') {
        const fl = 0.5 + 0.5 * Math.sin(t * 4 + o.cx);
        ctx.strokeStyle = 'rgba(255,210,59,' + (0.4 + 0.35 * fl) + ')';
        ctx.lineWidth = 1.2 * s;
        const bx0 = -24 * s, bx1 = 36 * s, by0 = -13 * s, by1 = 9 * s, nbar = 7;
        for (let i = 0; i <= nbar; i++) {
          const bx = bx0 + (bx1 - bx0) * i / nbar;
          ctx.beginPath(); ctx.moveTo(bx, by0); ctx.lineTo(bx, by1); ctx.stroke();
        }
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by0);
        ctx.moveTo(bx0, by1); ctx.lineTo(bx1, by1); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // 5 ดาว → หัวลูกศรหน้ารถ (ขวา) แสดงความแรง
      if (stars >= 5) {
        const ax = 36 * s, ay = 2 * s, fl2 = 0.6 + 0.4 * Math.sin(t * 18 + o.cx);
        ctx.globalAlpha = fl2; ctx.fillStyle = golden ? '#ffd23b' : '#ffffff';
        for (let k = 0; k < 2; k++) {
          const ox = ax + k * 5 * s;
          ctx.beginPath();
          ctx.moveTo(ox, ay - 3.2 * s); ctx.lineTo(ox + 4 * s, ay); ctx.lineTo(ox, ay + 3.2 * s);
          ctx.lineTo(ox + 1.3 * s, ay); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  VMFarm.DEFAULT_TURBO = DEFAULT_TURBO;
  VMFarm.drawCar = drawCar;
  // ความเข้ากันได้ย้อนหลัง: drawCreature เดิม → เรียก drawCar
  VMFarm.drawCreature = drawCar;
})(typeof window !== 'undefined' ? window : this);
