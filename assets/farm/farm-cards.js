/* farm-cards.js — ตัวควบคุม: ดึง Google Sheet (GViz) → คำนวณ growth → render เวทีเต้น
 * ธีม "เวทีเต้น": แต่ละระบบ = นักเต้น 1 ตัว บนเวทีคลับ, อันดับตามกำไรต่อทุน (growth %)
 *   จัดเป็นแถวแบบมุมมองลึก: แถวหน้า (ล่าง/ใหญ่) = อันดับดีสุด, แถวหลัง (บน/เล็ก)
 *   growth < 0        → ท่าหมดแรง (เทา, วาดใน farm-avatar.js) + ป้าย "พัง"
 *   growth >= TURBO   → เต้นเร็ว + ประกาย + สปอตไลต์
 * ป้ายชื่อ+growth% ลอยเหนือหัว ; คลิกป้าย/ตัว → เปิดหน้า copytrade
 * client-side ล้วน: ไม่มี backend, อ่านชีตแบบ read-only, auto-refresh
 * ต้องโหลดหลัง farm-levels.js และ farm-avatar.js (ใช้ window.VMFarm)
 */
(function () {
  'use strict';
  const VMFarm = window.VMFarm;

  // i18n — index.html = ไทย (ดีฟอลต์), index_en.html ตั้ง window.VM_LANG='en' ก่อนโหลดสคริปต์
  const LANG = window.VM_LANG === 'en' ? 'en' : 'th';
  const T = {
    th: { minCap: 'ทุน', broken: 'ตุย', demo: 'เดโม', start: 'สตาร์ท', finish: 'เส้นชัย' },
    en: { minCap: 'Capital', broken: 'DNF', demo: 'demo', start: 'Start', finish: 'Finish' },
  }[LANG];

  // ── แหล่งข้อมูล (ตาราง RealTime) ──
  const RT_SHEET_ID = '1B2XVPTkg4HBtd8XlQBwOSlisakAkyR1HbGIz1-wVxAU';
  const RT_URL = `https://docs.google.com/spreadsheets/d/${RT_SHEET_ID}/gviz/tq?tqx=out:json&gid=0`;
  const REFRESH_MS = 30000;

  // ── ชีต EA (คอลัมน์ E = ระดับความเสี่ยง) — join ด้วยชื่อ Sys_N ──
  const EA_SHEET_ID = '193XZLwmEDX7oTGZJEEjHKcFSZy4bDf5NNfPdr75gDYQ';
  const EA_URL = `https://docs.google.com/spreadsheets/d/${EA_SHEET_ID}/gviz/tq?tqx=out:json&gid=0`;
  let riskByName = {}; // { 'Sys_1': 'high' | 'medium' | 'low' }

  // ── เกณฑ์เทอร์โบ (% กำไรต่อทุน) — จูนได้ที่เดียว ──
  const TURBO = (VMFarm && VMFarm.DEFAULT_TURBO != null) ? VMFarm.DEFAULT_TURBO : 60;

  // ── สีเฉพาะต่อคัน: golden-angle hue (137.508°) → แต่ละระบบสีห่างสุด, รถใหม่ได้สีใหม่ไม่ซ้ำ ──
  const _nameIdx = {};
  let _nameCounter = 0;
  function hslToRgb(h, s, l) { // h,s,l = 0..1 → [r,g,b] 0..255
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
  function carColorFor(name) {
    const m = String(name).match(/(\d+)/);
    let n;
    if (m) n = parseInt(m[1], 10);                                  // Sys_7 → 7 (stable)
    else { if (_nameIdx[name] == null) _nameIdx[name] = _nameCounter++; n = _nameIdx[name]; }
    const hue = (n * 137.508) % 360;
    return {
      main: 'hsl(' + hue.toFixed(1) + ',72%,58%)',
      dark: 'hsl(' + hue.toFixed(1) + ',60%,30%)',
      rgb: hslToRgb(hue / 360, 0.72, 0.58).join(','),
    };
  }

  function normRisk(s) {
    const v = String(s || '').toLowerCase();
    if (v.indexOf('high') >= 0 || v.indexOf('เสี่ยงสูง') >= 0) return 'high';
    if (v.indexOf('low') >= 0 || v.indexOf('เสี่ยงต่ำ') >= 0) return 'low';
    if (v.indexOf('medium') >= 0 || v.indexOf('ค่อนข้าง') >= 0 || v.indexOf('กลาง') >= 0) return 'medium';
    return null;
  }

  async function fetchRisk() {
    try {
      const res = await fetch(EA_URL + '&t=' + Date.now());
      const text = await res.text();
      const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
      const rows = json && json.table && json.table.rows;
      if (!rows) return;
      const map = {};
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!(r && r.c)) continue;
        const nm = r.c[2] && r.c[2].v !== null ? String(r.c[2].v).trim() : ''; // คอลัมน์ C = Sys_N
        const rk = normRisk(r.c[4] && r.c[4].v !== null ? r.c[4].v : '');       // คอลัมน์ E = risk
        if (nm && rk) map[nm] = rk;
      }
      riskByName = map;
      if (lastRows) buildScene(lastRows); // ได้ risk แล้ว → รีเฟรชสี
    } catch (e) { /* ดึงไม่ได้ → ใช้สีดีฟอลต์ (medium/ฟ้า) */ }
  }

  function fmtInt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

  // ── ข้อมูลตัวอย่าง (แสดงเมื่อดึงชีตไม่ได้) ──
  const DEMO_ROWS = [
    { name: 'Sys_1', balance: 10000, profit: 2450, month: 820, lastMonth: 2400, stars: 5, recommend: true, badge: 'recommend', link: 'https://www.forexcool.com/?sys=1' },
    { name: 'Sys_2', balance: 5000, profit: 640, month: 340, lastMonth: 640, stars: 3, recommend: false, badge: 'good', link: 'https://www.forexcool.com/?sys=2' },
    { name: 'Sys_3', balance: 20000, profit: -320, month: -110, lastMonth: -320, stars: 2, recommend: false, badge: '', link: '' },
    { name: 'Sys_4', balance: 8000, profit: 5200, month: 2450, lastMonth: 5200, stars: 5, recommend: true, badge: 'recommend', link: 'https://www.forexcool.com/?sys=4' },
    { name: 'Sys_5', balance: 3000, profit: 120, month: 36, lastMonth: 120, stars: 1, recommend: false, badge: '', link: '' },
    { name: 'Sys_6', balance: 12000, profit: 3600, month: 1120, lastMonth: 3600, stars: 4, recommend: false, badge: 'good', link: '' },
  ];

  let lastRows = null;
  let DEMO = false;
  let canvas = null, ctx = null, dpr = 1;
  let lanes = [];      // [{ row, growth, rank, fillRow, cx, cy, scale, variant, phase, link, hit }]
  let W = 660, H = 372;
  let rafOn = false;

  // ── layout เวทีเต้น (responsive, perspective หลายแถว) ──
  const TAG_PAD_TOP = 60, FLOOR_PAD = 40;
  let rowsN = 1, rowSpacing = 90;
  function variantFor(name) {
    const mm = String(name).match(/(\d+)/);
    if (mm) return parseInt(mm[1], 10);
    let h = 0, s = String(name); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // ── parse GViz rows → snapshot (คอลัมน์เดียวกับตาราง RealTime) ──
  function parseRows(json) {
    const out = [];
    const rows = json && json.table && json.table.rows;
    if (!rows) return out;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!(r && r.c && r.c[0] && r.c[0].v !== null && String(r.c[0].v).toLowerCase() !== 'acc')) continue;
      const cell = (idx) => (r.c[idx] && r.c[idx].v !== null ? r.c[idx].v : null);
      const label = cell(9) !== null ? String(cell(9)).trim() : '';
      out.push({
        name: cell(1) !== null ? String(cell(1)) : '-',
        balance: cell(2) !== null ? parseFloat(cell(2)) : 0,
        profit: cell(4) !== null ? parseFloat(cell(4)) : 0,
        month: cell(6) !== null ? parseFloat(cell(6)) : 0,
        lastMonth: cell(7) !== null ? parseFloat(cell(7)) : 0,
        stars: cell(8) !== null ? parseInt(cell(8), 10) : 0,
        label: label,
        recommend: label.toLowerCase() === 'recommend',
        badge: label.toLowerCase() === 'recommend' ? 'recommend' : label.toLowerCase() === 'good' ? 'good' : '',
        link: cell(10) !== null ? String(cell(10)).trim() : '',
      });
    }
    return out;
  }

  async function fetchData() {
    try {
      const res = await fetch(RT_URL + '&t=' + Date.now());
      const text = await res.text();
      const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
      const rows = parseRows(json);
      if (!rows.length) throw new Error('empty');
      lastRows = rows; DEMO = false;
      buildScene(rows);
    } catch (e) {
      if (!lastRows) { lastRows = DEMO_ROWS; DEMO = true; buildScene(DEMO_ROWS); }
    }
  }

  function ensureCanvas() {
    const host = document.getElementById('vm-farm-grid');
    if (!host) return false;
    if (!canvas) {
      host.innerHTML = '';
      host.style.display = 'block'; // ยกเลิก grid เดิม — ลู่แข่งเป็น canvas เต็มกว้าง
      canvas = document.createElement('canvas');
      canvas.className = 'vm-race';
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.cursor = 'default';
      host.appendChild(canvas);
      canvas.addEventListener('click', onClick);
      canvas.addEventListener('mousemove', onMove);
      window.addEventListener('resize', () => { if (lastRows) buildScene(lastRows); });
    }
    return true;
  }

  function measureW() {
    const host = document.getElementById('vm-farm-grid');
    W = Math.max(320, host.clientWidth || 660);
  }
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── เตรียมฉาก: จัดอันดับตาม growth, วางตำแหน่งนักเต้นบนเวที ──
  function buildScene(rows) {
    if (!ensureCanvas()) return;
    if (!ctx) ctx = canvas.getContext('2d');

    const demoBadge = document.getElementById('vm-demo');
    if (demoBadge) demoBadge.style.display = DEMO ? 'inline-block' : 'none';

    const list = rows.map((row) => {
      const balance = Number(row.balance) || 0;
      const colG = Number(row.month) || 0; // คอลัมน์ G (profit7day) = ตัวตัดสินกำไรต่อทุน
      const growth = balance > 0 ? (colG / balance) * 100 : 0;
      return { row: row, growth: growth, effProfit: colG };
    });
    list.sort((a, b) => b.growth - a.growth);

    measureW();
    const n = list.length || 1;
    const isDesktop = W >= 640;
    const rowGap = isDesktop ? 126 : 102;
    rowSpacing = rowGap * 0.72;
    const baseScale = isDesktop ? 4.2 : 3.2;

    // จัดแถว: เต้น (growth>=10) อยู่ล่าง (หน้า 3 ดีสุด + กลาง 5/แถว), ส่วน <10% จางอยู่บนสุด (ไม่เต้น)
    const groups = buildStageRows(list);     // index 0 = แถวหน้า (ดีสุด)
    rowsN = groups.length;

    // ความสูง canvas = ป้ายบน + ระยะแถว + ตัวแถวหน้า + พื้นเวที
    H = Math.round(TAG_PAD_TOP + (rowsN - 1) * rowSpacing + 100 + FLOOR_PAD);
    resizeCanvas();

    const frontFeetY = H - FLOOR_PAD;        // แถวหน้า (อันดับดีสุด) อยู่ล่างสุด
    const sideMargin = Math.max(24, W * 0.06);

    lanes = [];
    groups.forEach((grp, gi) => {
      const itemsInRow = grp.idxs.length;
      const spacing = (W - sideMargin * 2) / itemsInRow;
      grp.idxs.forEach((rank, inRow) => {
        const it = list[rank];
        const v = variantFor(it.row.name);
        lanes.push({
          row: it.row, growth: it.growth, rank: rank, fillRow: gi, faded: grp.faded,
          cx: sideMargin + spacing * (inRow + 0.5),         // เท้า x
          cy: frontFeetY - gi * rowSpacing,                 // เท้า y (แถวหลังสูงขึ้น)
          scale: baseScale * Math.pow(0.86, gi),            // แถวหลังเล็กลง (มุมมองลึก)
          link: it.row.link, carColor: carColorFor(it.row.name),
          variant: v, phase: (v % 10) * 0.63,               // เฟสเต้นต่างกันต่อระบบ
          stats: VMFarm.statsFor ? VMFarm.statsFor({ ...it.row, profit: it.effProfit }, 'racing') : { level: 1, stars: it.row.stars || 0 },
          hit: null,
        });
      });
    });

    if (!rafOn) { rafOn = true; requestAnimationFrame(tick); }
  }

  // แบ่งแถวเวที (list เรียงดี→แย่แล้ว): เต้น (growth>=10) = หน้า 3 ดีสุด + กลาง 5/แถว ;
  // <10% = จาง อยู่บนสุด 5/แถว (ไม่เต้น, ติดลบ=ตุย). index 0 = แถวหน้า (ล่าง/ดีสุด)
  function buildStageRows(list) {
    const n = list.length, idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    const isRec = (i) => !!(list[i].row.recommend || list[i].row.badge === 'recommend');
    const rec = idx.filter(isRec);                                     // แถวล่างสุด (เด่น)
    const rest = idx.filter((i) => !isRec(i));
    const strong = rest.filter((i) => list[i].growth > 10);            // โบกมือข้างเดียว
    const stand = rest.filter((i) => list[i].growth <= 10 && list[i].growth >= 0); // ยืนเฉยๆ
    const dead = rest.filter((i) => list[i].growth < 0);               // ตุย → บนสุด
    const groups = [];
    // ล่าง→บน: recommend, แล้ว non-recommend เรียงกำไรลดหลั่นขึ้นไป (strong → stand → ตุย)
    for (let i = 0; i < rec.length; i += 5) groups.push({ idxs: rec.slice(i, i + 5), faded: false });
    for (let i = 0; i < strong.length; i += 5) groups.push({ idxs: strong.slice(i, i + 5), faded: false });
    for (let i = 0; i < stand.length; i += 5) groups.push({ idxs: stand.slice(i, i + 5), faded: true });
    for (let i = 0; i < dead.length; i += 5) groups.push({ idxs: dead.slice(i, i + 5), faded: true });
    if (!groups.length) groups.push({ idxs: idx, faded: false });
    // ให้ Sys_2 อยู่กลางแถวของมัน
    const s2 = idx.find((i) => list[i].row.name === 'Sys_2');
    if (s2 != null) for (const g of groups) {
      const pos = g.idxs.indexOf(s2);
      if (pos >= 0) { g.idxs.splice(pos, 1); g.idxs.splice(Math.floor(g.idxs.length / 2), 0, s2); break; }
    }
    return groups;
  }

  // hit-test: คลิก/ชี้ที่ป้าย+ตัวละคร → เปิดหน้า copytrade (ไล่หน้า→หลัง)
  function hitAt(mx, my) {
    for (let i = lanes.length - 1; i >= 0; i--) {
      const l = lanes[i], h = l.hit;
      if (l.link && h && mx >= h.x0 && mx <= h.x1 && my >= h.y0 && my <= h.y1) return l;
    }
    return null;
  }
  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    canvas.style.cursor = hitAt(e.clientX - rect.left, e.clientY - rect.top) ? 'pointer' : 'default';
  }
  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const l = hitAt(e.clientX - rect.left, e.clientY - rect.top);
    if (l) window.open('copytrade_approve.html?url=' + encodeURIComponent(l.link), '_blank');
  }

  function roundRectC(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function medalColor(rank) {
    return rank === 0 ? '#ffd23b' : rank === 1 ? '#c0c8d0' : rank === 2 ? '#cd7f32' : '#3a4a5f';
  }

  // ── เวที: พื้นหลังคลับ + แสงบ๊อกเก้ + วงแหวนเรืองแสงต่อแถว ──
  function drawStage(t) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0618'); bg.addColorStop(0.5, '#120a26'); bg.addColorStop(1, '#070410');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 16; i++) {
      const bx = ((i * 0.6180339) % 1) * W, by = 16 + ((i * 0.4142) % 1) * (H * 0.5);
      const br = 5 + (i % 5) * 2, al = 0.05 + (i % 6) * 0.015;
      ctx.globalAlpha = al; ctx.fillStyle = i % 3 === 0 ? '#ff5ea8' : i % 3 === 1 ? '#5ea8ff' : '#ffd23b';
      ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const frontFeetY = H - FLOOR_PAD;
    for (let r = rowsN - 1; r >= 0; r--) {       // หลัง → หน้า
      const fy = frontFeetY - r * rowSpacing;
      const rw = W * (0.9 - r * 0.05), rh = 14 + (rowsN - r) * 3;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + r);
      ctx.save();
      ctx.strokeStyle = 'rgba(54,255,160,' + (0.22 + 0.18 * pulse) + ')';
      ctx.lineWidth = 2.5; ctx.shadowColor = '#36ffa0'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.ellipse(W / 2, fy + 2, Math.max(30, rw / 2), rh, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }
  }

  // ── ป้ายชื่อ + growth% ลอยเหนือหัว ──
  function drawTag(l) {
    const neg = l.growth < 0, hot = l.growth >= TURBO;
    const gtxt = (l.growth > 0 ? '+' : '') + l.growth.toFixed(1) + '%' + (hot ? ' 🔥' : neg ? ' ' + T.broken : '');
    const gcol = neg ? '#ff6b6b' : hot ? '#ffd23b' : l.growth > 0 ? '#4cd137' : '#e6edf3';
    const nameTxt = l.row.name;

    ctx.font = '600 12px Kanit,sans-serif'; const w1 = ctx.measureText(nameTxt).width;
    ctx.font = '700 14px Kanit,sans-serif'; const w2 = ctx.measureText(gtxt).width;
    const tw = Math.max(w1, w2) + 20, th = 34;
    const headTop = l.cy - 21 * l.scale, topY = headTop - 6 - th;
    let tx = l.cx - tw / 2; tx = Math.max(3, Math.min(W - tw - 3, tx));

    ctx.fillStyle = 'rgba(8,10,18,0.85)'; roundRectC(ctx, tx, topY, tw, th, 7); ctx.fill();
    ctx.lineWidth = l.rank < 3 ? 1.6 : 1; ctx.strokeStyle = medalColor(l.rank); ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#cdd6e2'; ctx.font = '600 12px Kanit,sans-serif';
    ctx.fillText(nameTxt, tx + tw / 2, topY + 14);
    ctx.fillStyle = gcol; ctx.font = '700 14px Kanit,sans-serif';
    ctx.fillText(gtxt, tx + tw / 2, topY + 29);

    l.hit = { x0: Math.min(tx, l.cx - 9 * l.scale), x1: Math.max(tx + tw, l.cx + 9 * l.scale), y0: topY, y1: l.cy + 3 * l.scale };
  }

  function tick(now) {
    const t = now / 1000;
    ctx.clearRect(0, 0, W, H);
    drawStage(t);

    // วาดแถวหลัง → หน้า (z-order ถูกต้อง)
    const order = lanes.map((_, i) => i).sort((a, b) => lanes[b].fillRow - lanes[a].fillRow);
    for (const i of order) {
      const l = lanes[i];
      const hot = !l.faded && l.growth >= TURBO && l.growth >= 0;
      // สปอตไลต์ให้ท็อป 3 หรือคนที่ร้อนแรง (ข้ามแถวจาง)
      if (!l.faded && (l.rank < 3 || hot)) {
        const beam = (hot || l.rank === 0) ? '255,210,59' : '120,180,255';
        const top = l.cy - 30 * l.scale;
        const gr = ctx.createLinearGradient(l.cx, top, l.cx, l.cy);
        gr.addColorStop(0, 'rgba(' + beam + ',0)'); gr.addColorStop(1, 'rgba(' + beam + ',0.14)');
        ctx.fillStyle = gr; ctx.beginPath();
        ctx.moveTo(l.cx - 4 * l.scale, top); ctx.lineTo(l.cx + 4 * l.scale, top);
        ctx.lineTo(l.cx + 14 * l.scale, l.cy); ctx.lineTo(l.cx - 14 * l.scale, l.cy);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = l.faded ? 0.5 : 1;    // แถวหลัง (worst) แสดงลางๆ 50%
      VMFarm.drawDancer(ctx, {
        cx: l.cx, cy: l.cy, scale: l.scale, t: t, phase: l.phase,
        growth: l.growth, turboAt: TURBO, carColor: l.carColor, variant: l.variant,
        level: (l.stats && l.stats.level) || 1, stars: l.row.stars || 0,
        badge: l.row.badge, recommend: l.row.recommend, extreme: l.rank < 3,
        throne: l.row.name === 'Sys_2',
      });
      drawTag(l);
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(tick);
  }

  // แสดงช่วงเดือนที่แล้วใน heading เช่น (1-30 ก.ย.) / (1-30 Sep) — dynamic ตามจำนวนวัน
  function setMonthRange() {
    var el = document.querySelector('#vm-farm .vm-range');
    if (!el) return;
    var now = new Date();
    var lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate(); // วันสุดท้ายเดือนที่แล้ว
    var m = (now.getMonth() + 11) % 12;                                      // เดือนที่แล้ว 0-11
    var monTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    var monEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var mon = (LANG === 'en' ? monEn : monTh)[m];
    el.textContent = '(1-' + lastDay + ' ' + mon + ')';
  }

  function init() {
    if (!window.VMFarm || !document.getElementById('vm-farm-grid')) return;
    setMonthRange();
    // เปิดหน้า approve ด้วย window.open (จัดการใน onClick)
    fetchRisk();
    fetchData();
    setInterval(function () { fetchRisk(); fetchData(); }, REFRESH_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
