/* farm-cards.js — ตัวควบคุม: ดึง Google Sheet (GViz) → คำนวณ stat → render กริดการ์ด
 * รียูสรูปแบบ fetch/parse เดียวกับ index.html เดิม (RT sheet, gid=0)
 * client-side ล้วน: ไม่มี backend, อ่านชีตแบบ read-only, auto-refresh + ตรวจจับ level-up
 * ต้องโหลดหลัง farm-levels.js และ farm-avatar.js (ใช้ window.VMFarm)
 */
(function () {
  'use strict';
  const VMFarm = window.VMFarm;

  // ── แหล่งข้อมูล (เหมือนตาราง RealTime เดิม) ──
  const RT_SHEET_ID = '1B2XVPTkg4HBtd8XlQBwOSlisakAkyR1HbGIz1-wVxAU';
  const RT_URL = `https://docs.google.com/spreadsheets/d/${RT_SHEET_ID}/gviz/tq?tqx=out:json&gid=0`;
  const REFRESH_MS = 30000;

  // ── ขนาด canvas การ์ด ──
  const CV = { W: 150, H: 140, baseX: 75, baseY: 126, unit: 4.4 };

  // ── ข้อมูลตัวอย่าง (แสดงเมื่อดึงชีตไม่ได้ เช่น เปิดแบบ offline) ──
  const DEMO_ROWS = [
    { name: 'Sys_1', balance: 10000, profit: 2450, month: 8.2, lastMonth: 5.1, stars: 5, recommend: true, badge: 'recommend', link: 'https://www.harvestfarm.site/?sys=1' },
    { name: 'Sys_2', balance: 5000, profit: 640, month: 3.4, lastMonth: -1.2, stars: 3, recommend: false, badge: 'good', link: 'https://www.harvestfarm.site/?sys=2' },
    { name: 'Sys_3', balance: 20000, profit: -320, month: -1.1, lastMonth: 2.0, stars: 2, recommend: false, badge: '', link: '' },
    { name: 'Sys_4', balance: 8000, profit: 5200, month: 24.5, lastMonth: 18.0, stars: 5, recommend: true, badge: 'recommend', link: 'https://www.harvestfarm.site/?sys=4' },
    { name: 'Sys_5', balance: 3000, profit: 120, month: 1.2, lastMonth: 0.5, stars: 1, recommend: false, badge: '', link: '' },
    { name: 'Sys_6', balance: 12000, profit: 3600, month: 12.0, lastMonth: 9.4, stars: 4, recommend: false, badge: 'good', link: '' },
  ];

  let THEME = 'farm';
  let lastRows = null;
  let DEMO = false;
  let cards = []; // { ctx, W,H, baseX,baseY,unit, stats, cfg, mood, row, pop, popStart }
  const prevLevels = {};
  let rafOn = false;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function fmtInt(n) {
    return Math.round(Number(n) || 0).toLocaleString('en-US');
  }
  function starStr(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '<span class="vm-star-on">★</span>' : '<span class="vm-star-off">★</span>';
    return s;
  }

  // (ปุ่ม Copy เป็นลิงก์ไปหน้า copytrade_approve.html เหมือนตาราง — ไม่ใช้คลิปบอร์ดแล้ว)

  // ── parse GViz rows → snapshot objects (คอลัมน์เดียวกับตาราง RealTime) ──
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
        month: cell(6) !== null ? parseFloat(cell(6)) : 0,        // เดือนนี้ (%)
        lastMonth: cell(7) !== null ? parseFloat(cell(7)) : 0,    // เดือนที่แล้ว (%)
        stars: cell(8) !== null ? parseInt(cell(8), 10) : 0,
        label: label,
        recommend: label.toLowerCase() === 'recommend',
        badge: label.toLowerCase() === 'recommend' ? 'recommend' : label.toLowerCase() === 'good' ? 'good' : '',
        link: cell(10) !== null ? String(cell(10)).trim() : '',
      });
    }
    // เรียงตามชื่อแบบตัวเลข (Sys_1, Sys_2, ...)
    out.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' }));
    return out;
  }

  async function fetchData() {
    try {
      const res = await fetch(RT_URL + '&t=' + Date.now());
      const text = await res.text();
      const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
      const rows = parseRows(json);
      if (!rows.length) throw new Error('empty');
      lastRows = rows;
      DEMO = false;
      renderGrid(rows, true);
    } catch (e) {
      // ดึงไม่ได้ → โชว์เดโมครั้งแรกเพื่อให้เห็นหน้าตา (ติดป้าย "เดโม")
      if (!lastRows) {
        lastRows = DEMO_ROWS;
        DEMO = true;
        renderGrid(DEMO_ROWS, false);
      }
    }
  }

  function trendHtml(month) {
    if (month > 0) return `<div class="vm-trend up">📈 +${month.toFixed(1)}% เดือนนี้</div>`;
    if (month < 0) return `<div class="vm-trend down">📉 ${month.toFixed(1)}% เดือนนี้</div>`;
    return `<div class="vm-trend flat">➖ ทรงตัว</div>`;
  }

  function buildCard(row, stats, leveledUp) {
    const card = document.createElement('div');
    card.className = 'vm-card' + (row.badge === 'recommend' ? ' rec' : row.badge === 'good' ? ' good' : '') + (leveledUp ? ' levelup' : '');
    const nameHtml = row.link
      ? `<a href="${esc(row.link)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${esc(row.name)}</a>`
      : esc(row.name);
    card.innerHTML =
      (row.link ? `<a class="vm-copy" href="copytrade_approve.html?url=${encodeURIComponent(row.link)}" target="_blank" rel="noopener">Copy</a>` : '') +
      (row.badge === 'recommend' ? '<div class="vm-recbadge">👑</div>' : row.badge === 'good' ? '<div class="vm-recbadge">🧢</div>' : '') +
      `<canvas class="vm-canvas" width="1" height="1"></canvas>` +
      `<div class="vm-name">${nameHtml}</div>` +
      `<div class="vm-title">${stats.titleEmoji} ${esc(stats.title)}</div>` +
      `<div class="vm-xpbar"><div class="vm-xpfill" style="width:0%"></div>` +
      `<span class="vm-xptext">${fmtInt(stats.inLevel)}/${fmtInt(stats.toNext)} XP</span></div>` +
      `<div class="vm-meta"><span class="vm-gold">🪙 ${fmtInt(row.profit)}</span>` +
      `<span class="vm-stars">${starStr(stats.stars)}</span></div>` +
      trendHtml(row.month) +
      `<div class="vm-lvlup">LEVEL UP!<br>Lv ${stats.level}</div>`;
    return card;
  }

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CV.W * dpr;
    canvas.height = CV.H * dpr;
    canvas.style.width = CV.W + 'px';
    canvas.style.height = CV.H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function renderGrid(rows, detectLevelUp) {
    const grid = document.getElementById('vm-farm-grid');
    if (!grid) return;
    const demoBadge = document.getElementById('vm-demo');
    if (demoBadge) demoBadge.style.display = DEMO ? 'inline-block' : 'none';

    grid.innerHTML = '';
    cards = [];
    const now = performance.now();

    rows.forEach((row) => {
      const stats = VMFarm.statsFor(row, THEME);
      const cfg = VMFarm.paletteFor(row.name);
      const mood = row.month > 0 ? 1 : row.month < 0 ? -1 : 0;
      const prev = prevLevels[row.name];
      const leveledUp = !!detectLevelUp && prev != null && stats.level > prev;
      prevLevels[row.name] = stats.level;

      const card = buildCard(row, stats, leveledUp);
      grid.appendChild(card);
      const ctx = setupCanvas(card.querySelector('.vm-canvas'));

      cards.push({
        ctx: ctx, W: CV.W, H: CV.H, baseX: CV.baseX, baseY: CV.baseY, unit: CV.unit,
        stats: stats, cfg: cfg, mood: mood, row: row,
        pop: leveledUp ? 1 : 0, popStart: now,
      });

      // แถบ XP เด้ง (transition)
      const fill = card.querySelector('.vm-xpfill');
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = stats.pct + '%'; }));
      if (leveledUp) setTimeout(() => card.classList.remove('levelup'), 1700);
    });

    if (!rafOn) {
      rafOn = true;
      requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    const t = now / 1000;
    for (const c of cards) {
      c.ctx.clearRect(0, 0, c.W, c.H);
      let pop = 0;
      if (c.pop > 0) {
        const dt = (now - c.popStart) / 1000;
        pop = Math.max(0, 1 - dt / 1.2);
        if (pop <= 0) c.pop = 0;
      }
      VMFarm.drawCreature(c.ctx, {
        theme: THEME, cx: c.baseX, cy: c.baseY, unit: c.unit, t: t,
        level: c.stats.level, stars: c.stats.stars, mood: c.mood,
        cfg: c.cfg, recommend: c.row.recommend, badge: c.row.badge, pop: pop,
      });
    }
    requestAnimationFrame(tick);
  }

  function wireThemeButtons() {
    const btns = document.querySelectorAll('#vm-farm .vm-theme-btn');
    btns.forEach((b) => {
      b.addEventListener('click', () => {
        const th = b.getAttribute('data-theme');
        if (th === THEME) return;
        THEME = th;
        btns.forEach((x) => x.classList.toggle('active', x === b));
        if (lastRows) renderGrid(lastRows, false); // สลับธีมไม่นับเป็น level-up
      });
    });
  }

  function init() {
    if (!window.VMFarm || !document.getElementById('vm-farm-grid')) return;
    wireThemeButtons();
    fetchData();
    setInterval(fetchData, REFRESH_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
