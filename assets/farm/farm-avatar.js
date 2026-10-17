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
      // Recommend → ร่มสีแดงเหนือหัวรถ (ใหญ่)
      if (badge === 'recommend') {
        const ux = -2 * s, uy = -14 * s, ur = 11 * s;
        ctx.strokeStyle = '#c9ccd1'; ctx.lineWidth = 1 * s;           // ด้ามร่ม
        ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux, -4 * s); ctx.stroke();
        ctx.fillStyle = '#e02424';                                    // โดมร่ม (ครึ่งวงกลม)
        ctx.beginPath(); ctx.arc(ux, uy, ur, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c21c1c';                                    // ขอบหยักใต้โดม
        const nsc = 4, scr = ur / nsc;
        for (let i = 0; i < nsc; i++) {
          const sx = ux - ur + scr + i * 2 * scr;
          ctx.beginPath(); ctx.arc(sx, uy, scr, 0, Math.PI); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = '#c9ccd1'; ctx.lineWidth = 1 * s;           // ยอดร่ม
        ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux, uy - 3 * s); ctx.stroke();
        ctx.fillStyle = '#ffd23b'; ctx.beginPath(); ctx.arc(ux, uy - 3 * s, 0.9 * s, 0, 7); ctx.fill();
      }
      // 5 ดาว → หัวลูกศรหน้ารถ (ขวา) แสดงความแรง
      if (stars >= 5) {
        const ax = 36 * s, ay = 2 * s, fl2 = 0.6 + 0.4 * Math.sin(t * 18 + o.cx);
        ctx.globalAlpha = fl2; ctx.fillStyle = golden ? '#ffd23b' : '#ffffff';
        for (let k = 0; k < 2; k++) {                 // ลูกศรใหญ่ x2
          const ox = ax + k * 10 * s;
          ctx.beginPath();
          ctx.moveTo(ox, ay - 6.4 * s); ctx.lineTo(ox + 8 * s, ay); ctx.lineTo(ox, ay + 6.4 * s);
          ctx.lineTo(ox + 2.6 * s, ay); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  // ───────────────────────────────────────────────────────────
  //  โหมดใหม่: นักเต้นบนเวที (procedural pixel/cartoon)
  //  เท้าอยู่ที่ (o.cx, o.cy) ; ตัวสูงขึ้นทางลบของแกน y ; o.scale = หน่วยพิกเซล
  //  growth < 0 → ท่าหมดแรง (เทา) ; growth >= turboAt → เต้นเร็ว + ประกาย
  //  carColor = สีเสื้อ ; variant = ทรงผม/หมวก ; recommend → มงกุฎ
  // ───────────────────────────────────────────────────────────
  function rr(ctx, x, y, w, h, r) {
    if (r > w / 2) r = w / 2; if (r > h / 2) r = h / 2;
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function arm(ctx, sx, sy, ang, len, w, col) {
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
    ctx.fillStyle = col; rr(ctx, 0, -w / 2, len, w, w / 2); ctx.fill(); ctx.restore();
    return [sx + Math.cos(ang) * len, sy + Math.sin(ang) * len];
  }
  function star4(ctx, x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, rad = i % 2 ? r * 0.4 : r;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawDancer(ctx, o) {
    const u = o.scale || 4, t = o.t || 0;
    const growth = Number(o.growth) || 0;
    const turboAt = o.turboAt != null ? o.turboAt : DEFAULT_TURBO;
    const broken = growth < 0, hot = growth >= turboAt && !broken;
    const phase = o.phase || 0, variant = (o.variant | 0);
    const recommend = o.badge === 'recommend' || o.recommend;
    const golden = (o.level || 1) >= 25 && !broken;

    let col, dk;
    if (broken) { col = '#6b7280'; dk = '#3a3f47'; }
    else if (o.carColor) { col = o.carColor.main; dk = o.carColor.dark; }
    else { col = '#36b4ff'; dk = '#0d4f7a'; }
    const skin = broken ? '#a7adb5' : '#f4cda4';
    const hairCols = ['#241a10', '#5a3a1a', '#15171c', '#8a5a16', '#b23b2e', '#e8c24a', '#6d4bb0', '#2f8f6b'];
    const hair = broken ? '#50555d' : hairCols[variant % hairCols.length];
    const accent = golden ? '#ffd23b' : hairCols[(variant + 3) % hairCols.length];

    const dance = !broken && growth >= 10;         // >=10% เต้น ; 0..<10% ยืนเฉยๆ ; <0 ตุย
    const extreme = !!o.extreme && dance;          // 3 อันดับแรก = ท่าเอ็กซ์ตรีม หมุน/ตีลังกา
    const beat = 9;   // ความเร็วเต้นเท่ากันทุกตัว
    const m = dance ? Math.sin(t * beat + phase) : 0;
    const m2 = dance ? Math.sin(t * beat * 0.5 + phase + 1) : 0;
    const bob = dance ? (Math.abs(m) - 0.5) * 2.0 * u : (broken ? 0 : Math.sin(t * 2 + phase) * 0.3 * u);
    const lean = dance ? m2 * 0.05 : 0;

    ctx.save();
    ctx.translate(o.cx || 0, o.cy || 0);
    const base = ctx.globalAlpha;   // อิงความโปร่งจากภายนอก (แถวจาง 50%)

    // เงาที่พื้น
    ctx.globalAlpha = 0.32 * base; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 1.4 * u, 6.4 * u, 1.7 * u, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = base;

    ctx.translate(0, bob);
    ctx.rotate(broken ? 0.14 : lean);

    // ── ท่าเอ็กซ์ตรีม: กระโดด + สลับ ตีลังกา/หมุนตัว ──
    if (extreme) {
      const cyc = 1.3, p = ((t / cyc + phase) % 1), pv = -10 * u;
      ctx.translate(0, -Math.sin(p * Math.PI) * 9 * u);   // กระโดดโค้ง
      ctx.translate(0, pv);
      const sc = Math.cos(p * 2 * Math.PI);               // หมุนรอบแกนตั้งอย่างเดียว (ย่อแกน x)
      ctx.scale(sc < 0 ? Math.min(sc, -0.08) : Math.max(sc, 0.08), 1);
      ctx.translate(0, -pv);
    }

    const shoulderY = -13.5 * u;
    const fa = dance ? (-1.2 + m * 0.85) : 1.45;   // เต้น=ชูแขนขึ้น / ยืน=แขนลงข้างตัว
    const la = Math.PI - fa;         // แขนซ้าย (หลัง) มิเรอร์
    const sway = broken ? 0 : m * 0.5 * u;

    // ── ปีกนางฟ้า (Recommend) — เล็ก 2 ชั้น โค้งสวย เส้นบาง + เรืองแสงอ่อน ──
    if (recommend && !broken) {
      const wy = -11.5 * u, flap = 1 + 0.1 * Math.sin(t * beat + phase);
      for (let d = -1; d <= 1; d += 2) {
        ctx.save(); ctx.translate(d * 2.2 * u, wy); ctx.scale(d, 1);
        ctx.lineJoin = 'round';
        // เรืองแสงอ่อนหลังปีก
        const gl = ctx.createRadialGradient(3 * u, 0, 0, 3 * u, 0, 7 * u);
        gl.addColorStop(0, 'rgba(210,230,255,0.26)'); gl.addColorStop(1, 'rgba(210,230,255,0)');
        ctx.globalAlpha = base; ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(3 * u, 0, 7 * u, 0, 7); ctx.fill();
        const wg = ctx.createLinearGradient(0, 0, 7 * u, -5 * u);
        wg.addColorStop(0, '#ffffff'); wg.addColorStop(0.7, '#eaf2ff'); wg.addColorStop(1, '#c6dbff');
        ctx.fillStyle = wg; ctx.strokeStyle = 'rgba(150,180,230,0.4)'; ctx.lineWidth = 0.26 * u;
        // ชั้นล่าง (สั้น)
        ctx.globalAlpha = 0.9 * base;
        ctx.beginPath(); ctx.moveTo(0, 1.5 * u);
        ctx.quadraticCurveTo(4.5 * u * flap, -2 * u, 6.5 * u * flap, 1.2 * u);
        ctx.quadraticCurveTo(4.5 * u * flap, 3 * u, 1 * u, 4.2 * u);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // ชั้นบน (ยาวโค้งขึ้น)
        ctx.globalAlpha = base;
        ctx.beginPath(); ctx.moveTo(0, 0.5 * u);
        ctx.quadraticCurveTo(5.5 * u * flap, -5.5 * u, 7.5 * u * flap, -0.5 * u);
        ctx.quadraticCurveTo(5 * u * flap, 1.5 * u, 0.5 * u, 2.2 * u);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // เส้นขนบาง
        ctx.strokeStyle = 'rgba(150,180,230,0.38)'; ctx.lineWidth = 0.2 * u;
        for (let f = 0; f < 3; f++) {
          const fx = (2.4 + f * 1.7) * u * flap;
          ctx.beginPath(); ctx.moveTo(fx, -1 * u); ctx.quadraticCurveTo(fx + 0.8 * u, 0.4 * u, fx - 0.3 * u, 1.6 * u); ctx.stroke();
        }
        ctx.globalAlpha = base; ctx.restore();
      }
    }

    // ── ขา + รองเท้า ──
    ctx.fillStyle = dk;
    rr(ctx, -3.2 * u + sway * 0.3, -6.2 * u, 2.6 * u, 6.4 * u, 1 * u); ctx.fill();
    rr(ctx, 0.6 * u - sway * 0.3, -6.2 * u, 2.6 * u, 6.4 * u, 1 * u); ctx.fill();
    ctx.fillStyle = '#14171d';
    rr(ctx, -3.5 * u + sway * 0.3, -1.3 * u, 3.1 * u, 1.7 * u, 0.6 * u); ctx.fill();
    rr(ctx, 0.4 * u - sway * 0.3, -1.3 * u, 3.1 * u, 1.7 * u, 0.6 * u); ctx.fill();

    // ── แขนหลัง (ซ้าย) ──
    (function () {
      const [hx, hy] = arm(ctx, -3.4 * u, shoulderY, broken ? 2.5 : la, 6.3 * u, 2.1 * u, dk);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, 1.5 * u, 0, 7); ctx.fill();
    })();

    // ── ลำตัว ──
    const g = ctx.createLinearGradient(0, shoulderY, 0, -6 * u);
    g.addColorStop(0, golden ? '#ffe79a' : col); g.addColorStop(1, dk);
    ctx.fillStyle = g; rr(ctx, -3.9 * u, -14 * u, 7.8 * u, 8.4 * u, 1.9 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(-0.4 * u, -13.4 * u, 0.8 * u, 7 * u);

    // ── หัว ──
    const hy0 = -17.8 * u;
    ctx.fillStyle = skin; rr(ctx, -3 * u, hy0 - 3 * u, 6 * u, 6.3 * u, 2.4 * u); ctx.fill();
    // ผม
    ctx.fillStyle = hair;
    rr(ctx, -3.15 * u, hy0 - 3.5 * u, 6.3 * u, 3 * u, 2 * u); ctx.fill();
    ctx.fillRect(-3.15 * u, hy0 - 2.2 * u, 1.2 * u, 2.4 * u);
    ctx.fillRect(1.95 * u, hy0 - 2.2 * u, 1.2 * u, 2.4 * u);
    // ตา (กระพริบเป็นจังหวะ)
    const blink = (!broken && ((t * 0.9 + phase) % 5) < 0.12) ? 0.18 : 1;
    ctx.fillStyle = '#15181e';
    ctx.fillRect(-1.75 * u, hy0 - 0.1 * u, 0.95 * u, 1.2 * u * blink);
    ctx.fillRect(0.8 * u, hy0 - 0.1 * u, 0.95 * u, 1.2 * u * blink);
    // ปาก (ยิ้มเมื่อกำไร / คว่ำเมื่อพัง)
    ctx.strokeStyle = broken ? '#7a2f2f' : '#9c4a2f'; ctx.lineWidth = 0.6 * u; ctx.beginPath();
    if (broken) ctx.arc(0, hy0 + 2.9 * u, 1.2 * u, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(0, hy0 + 1.5 * u, 1.3 * u, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();

    // ── หมวก/แอกเซสซอรี่ ตาม variant (เว้น recommend — ใส่ปีกนางฟ้าแทน) ──
    if (!broken && !recommend) {
      const hv = variant % 3;
      if (hv === 1) {               // หูฟัง DJ
        ctx.strokeStyle = '#1c2029'; ctx.lineWidth = 1.1 * u;
        ctx.beginPath(); ctx.arc(0, hy0 - 1.5 * u, 3.6 * u, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.fillStyle = accent;
        rr(ctx, -4.4 * u, hy0 - 1 * u, 1.8 * u, 2.6 * u, 0.7 * u); ctx.fill();
        rr(ctx, 2.6 * u, hy0 - 1 * u, 1.8 * u, 2.6 * u, 0.7 * u); ctx.fill();
      } else if (hv === 2) {        // หมวกแก๊ป
        ctx.fillStyle = accent;
        rr(ctx, -3.3 * u, hy0 - 4.2 * u, 6.6 * u, 2.6 * u, 1.3 * u); ctx.fill();
        ctx.fillRect(1.6 * u, hy0 - 2.4 * u, 3.4 * u, 1.1 * u);
      }
    }

    // ── แขนหน้า (ขวา) ──
    (function () {
      const [hx, hy] = arm(ctx, 3.4 * u, shoulderY, broken ? (Math.PI - 2.5) : fa, 6.3 * u, 2.2 * u, golden ? '#ffe79a' : col);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, hy, 1.6 * u, 0, 7); ctx.fill();
    })();

    // ── ประกายไฟ (เทอร์โบ/ร้อนแรง) ──
    if (hot) {
      for (let i = 0; i < 4; i++) {
        const a = t * 2 + i * Math.PI / 2, rad = (7 + Math.sin(t * 3 + i) * 1.5) * u;
        const sx = Math.cos(a) * rad, sy = hy0 - 1 * u + Math.sin(a) * rad * 0.7;
        ctx.globalAlpha = (0.6 + 0.4 * Math.sin(t * 6 + i)) * base;
        star4(ctx, sx, sy, 1.1 * u, '#ffd23b');
      }
      ctx.globalAlpha = base;
    }

    ctx.restore();
  }

  VMFarm.DEFAULT_TURBO = DEFAULT_TURBO;
  VMFarm.drawCar = drawCar;
  VMFarm.drawDancer = drawDancer;
  // ความเข้ากันได้ย้อนหลัง: drawCreature เดิม → เรียก drawCar
  VMFarm.drawCreature = drawCar;
})(typeof window !== 'undefined' ? window : this);
