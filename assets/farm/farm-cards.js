/* farm-cards.js — ตัวควบคุม: ดึง Google Sheet (GViz) → คำนวณ growth → render ลู่แข่ง
 * ธีมเดียว "สนามแข่ง": แต่ละระบบ = รถ 1 คัน, ระยะบนลู่ = กำไรต่อทุน (growth %)
 *   สตาร์ท 0%  →  เส้นชัย 100%   (คลิป 0..100)
 *   growth < 0        → รถพัง (วาดใน farm-avatar.js) + ป้ายสถานะ
 *   growth >= TURBO   → ติดเทอร์โบ
 * client-side ล้วน: ไม่มี backend, อ่านชีตแบบ read-only, auto-refresh
 * ต้องโหลดหลัง farm-levels.js และ farm-avatar.js (ใช้ window.VMFarm)
 */
(function () {
  'use strict';
  const VMFarm = window.VMFarm;

  // i18n — index.html = ไทย (ดีฟอลต์), index_en.html ตั้ง window.VM_LANG='en' ก่อนโหลดสคริปต์
  const LANG = window.VM_LANG === 'en' ? 'en' : 'th';
  const T = {
    th: { minCap: 'ทุน', broken: 'พัง', demo: 'เดโม', start: 'สตาร์ท', finish: 'เส้นชัย' },
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
  let lanes = [];      // [{ row, growth, norm, target, pos, y, laneTop, link }]
  let W = 660, H = 372;
  let rafOn = false;

  // ── layout (responsive) ──
  const LANE_H = 58, TOP_PAD = 14, LABEL_W = 108;
  function metrics() {
    const trackX0 = Math.min(LABEL_W + 24, W * 0.30);
    const trackX1 = W - 56;                 // เว้นที่เส้นชัย checkered
    return { trackX0, trackX1, trackW: Math.max(40, trackX1 - trackX0) };
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

  function resizeCanvas(nRows) {
    const host = document.getElementById('vm-farm-grid');
    W = Math.max(320, host.clientWidth || 660);
    H = TOP_PAD * 2 + LANE_H * nRows + 14; // +14 เผื่อป้าย 0%/100%
    dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── เตรียมฉาก: จัดอันดับตาม growth, คำนวณตำแหน่งเป้าหมาย ──
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

    resizeCanvas(list.length);
    const m = metrics();

    const prevByName = {};
    lanes.forEach((l) => { prevByName[l.row.name] = l.pos; });

    lanes = list.map((it, i) => {
      const norm = Math.max(0, Math.min(100, it.growth)) / 100;
      const laneTop = TOP_PAD + LANE_H * i;
      const y = laneTop + LANE_H * 0.52;
      // เผื่อระยะจมูก→ปีกหน้า (ขวาสุด ~34*unit) ให้กันชนหน้าแตะเส้นชัยพอดี ไม่ทะลุ
      const NOSE = 34;
      const usable = Math.max(20, m.trackW - NOSE);
      const target = m.trackX0 + norm * usable;
      return {
        row: it.row, growth: it.growth, norm: norm, target: target,
        pos: prevByName[it.row.name] != null ? prevByName[it.row.name] : m.trackX0,
        y: y, laneTop: laneTop, link: it.row.link,
        carColor: carColorFor(it.row.name),
        stats: VMFarm.statsFor ? VMFarm.statsFor({ ...it.row, profit: it.effProfit }, 'racing') : { level: 1, stars: it.row.stars || 0 },
      };
    });

    if (!rafOn) { rafOn = true; requestAnimationFrame(tick); }
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let hit = false;
    for (const l of lanes) {
      if (l.link && my >= l.laneTop && my < l.laneTop + LANE_H) { hit = true; break; }
    }
    canvas.style.cursor = hit ? 'pointer' : 'default';
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const my = e.clientY - rect.top;
    for (const l of lanes) {
      if (l.link && my >= l.laneTop && my < l.laneTop + LANE_H) {
        window.open('copytrade_approve.html?url=' + encodeURIComponent(l.link), '_blank');
        return;
      }
    }
  }

  function tick(now) {
    const t = now / 1000;
    const m = metrics();
    const isDesktop = W >= 640;   // มือถือ (แคบ) = เดิม / คอม = growth% หน้ารถ
    ctx.clearRect(0, 0, W, H);

    lanes.forEach((l, i) => {
      // พื้นเลน
      ctx.fillStyle = i % 2 ? '#0d1420' : '#0f1725';
      ctx.fillRect(0, l.laneTop, W, LANE_H);
      // เส้นประกลางเลน
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.setLineDash([12, 12]);
      ctx.beginPath(); ctx.moveTo(m.trackX0, l.y + 15); ctx.lineTo(m.trackX1, l.y + 15); ctx.stroke(); ctx.setLineDash([]);

      // เหรียญอันดับ
      const medal = i === 0 ? '#ffd23b' : i === 1 ? '#c0c8d0' : i === 2 ? '#cd7f32' : '#2d3a4d';
      ctx.fillStyle = medal; ctx.beginPath(); ctx.arc(18, l.y, 12, 0, 7); ctx.fill();
      ctx.fillStyle = i < 3 ? '#1a1200' : '#8fa4bd'; ctx.font = 'bold 12px Kanit,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P' + (i + 1), 18, l.y);

      // ชื่อ + growth%
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const neg = l.growth < 0, hot = l.growth >= TURBO;
      const gtxt = (l.growth > 0 ? '+' : '') + l.growth.toFixed(1) + '%' + (hot ? ' 🔥' : neg ? ' ' + T.broken : '');
      const gcol = neg ? '#ff6b6b' : hot ? '#ffd23b' : l.growth > 0 ? '#4cd137' : '#e6edf3';

      // เคลื่อนรถเข้าหาเป้าหมาย (รถพังจอดนิ่งที่สตาร์ท) — คำนวณก่อนวาด growth หน้ารถ
      l.pos += (l.target - l.pos) * 0.06;

      ctx.fillStyle = '#e6edf3'; ctx.font = '13px Kanit,sans-serif';
      if (isDesktop) {
        ctx.fillText(l.row.name, 36, l.y + 4);              // desktop: ชื่อกลางเลน
        ctx.fillStyle = gcol; ctx.font = 'bold 14px Kanit,sans-serif';
        var gx = l.pos + 40; if (gx > W - 58) gx = W - 58;  // growth% หน้ารถ (ตามรถ)
        ctx.textBaseline = 'middle'; ctx.fillText(gtxt, gx, l.y); ctx.textBaseline = 'alphabetic';
      } else {
        ctx.fillText(l.row.name, 36, l.y - 5);              // mobile: เดิม
        ctx.fillStyle = gcol; ctx.font = 'bold 13px Kanit,sans-serif';
        ctx.fillText(gtxt, 36, l.y + 10);
      }
      VMFarm.drawCar(ctx, {
        cx: l.pos, cy: l.y, unit: 1, t: t, growth: l.growth, turboAt: TURBO,
        carColor: l.carColor,
        risk: riskByName[l.row.name] || 'medium',
        level: (l.stats && l.stats.level) || 1,
        stars: l.row.stars || 0,
        badge: l.row.badge, recommend: l.row.recommend,
      });
    });

    // เส้นชัย checkered
    const sq = 6, bottom = TOP_PAD + LANE_H * lanes.length;
    for (let yy = TOP_PAD; yy < bottom; yy += sq) {
      for (let xx = 0; xx < 2; xx++) {
        ctx.fillStyle = ((Math.floor(yy / sq) + xx) % 2) ? '#e6edf3' : '#11161f';
        ctx.fillRect(m.trackX1 + xx * sq, yy, sq, sq);
      }
    }
    // เส้นสตาร์ท
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.trackX0, TOP_PAD); ctx.lineTo(m.trackX0, bottom); ctx.stroke();
    // ป้าย 0% / 100%
    ctx.fillStyle = '#4a5568'; ctx.font = '11px Kanit,sans-serif'; ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center'; ctx.fillText('0%', m.trackX0, bottom + 11);
    ctx.fillText('100%', m.trackX1, bottom + 11);

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
