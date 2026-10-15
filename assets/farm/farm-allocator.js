/* farm-allocator.js — เครื่องคำนวณจัดฟาร์มตามทุน (Cent)
 * ดึงข้อมูลระบบจาก Google Sheet (gviz): A=ชื่อ, B=ทุน/0.01, C=Sys_N, E=risk (ตัด Test)
 * ลูกค้าใส่ทุน + เลือกระดับเสี่ยง → เสนอ 5 เซ็ตจัดพอร์ตแบบสุ่ม
 *
 * กฎ:
 *  - ระดับเสี่ยง (slider): Low/Normal/Medium/High
 *  - ลอต×N = ทุน/0.01 ลดลง N เท่า (lot เยอะขึ้น) เมื่อระบบปลอดภัยกว่าที่เลือก
 *  - ทุน×N = กันทุนบัฟเฟอร์ เมื่อระบบเสี่ยงกว่าที่เลือก
 *  - แต่ละระบบวางขั้นต่ำ ¢10,000 · fill เต็มทุนทีละ 0.01
 *  - จำนวนระบบ: ทุน <20k = 1 (ระบบใดก็ได้), ≥20k = 2–5 (ทุกเซ็ตมี Sys_1 หรือ Sys_2)
 *  - Sys_1/Sys_2 ไม่อยู่เซ็ตเดียวกัน
 * client-side ล้วน · ต้องโหลดคู่กับ element #farm-alloc
 */
(function () {
  'use strict';
  var LANG = window.VM_LANG === 'en' ? 'en' : 'th';
  var T = {
    th: { cap: 'ทุน (Cent)', risk: 'ระดับเสี่ยง', shuffle: '🎲 สุ่มใหม่', sys: 'ระบบ', adj: 'ปรับ', lot: 'Lot', used: 'ทุนที่วาง',
          set: 'เซ็ต', nSys: 'ระบบ', lotSum: 'lot รวม', use: 'ใช้', left: 'เหลือ', normal: 'ปกติ', lotx: 'ลอต×', capx: 'ทุน×',
          low: 'ทุนไม่พอ (ขั้นต่ำ ¢10,000/ระบบ)', loading: '⏳ กำลังโหลดข้อมูลระบบ...' },
    en: { cap: 'Capital (Cent)', risk: 'Risk level', shuffle: '🎲 Reshuffle', sys: 'System', adj: 'Adj', lot: 'Lot', used: 'Capital',
          set: 'Set', nSys: 'systems', lotSum: 'total lot', use: 'used', left: 'left', normal: 'base', lotx: 'lot×', capx: 'cap×',
          low: 'Not enough (min ¢10,000/system)', loading: '⏳ Loading systems...' }
  }[LANG];

  var SHEET_ID = '193XZLwmEDX7oTGZJEEjHKcFSZy4bDf5NNfPdr75gDYQ';
  var SHEET_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&gid=0';

  var FLAG = ['Sys_1', 'Sys_2'];
  var MIN_PER_SYS = 10000, NSETS = 5, MAX_SYS = 5;
  var LV = ['', 'Low', 'Normal', 'Medium', 'High'];
  var SL = { Low: 1, Medium: 2, High: 3 };
  var SYSSCORE = { Low: 1, Medium: 2, High: 3 };
  var RCOLOR = { Low: '#1e8c4a', Medium: '#b85c00', High: '#a83232' };

  var SYS = [];   // โหลดจากชีต
  var seedBase = Math.floor(Math.random() * 1e9);

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function byName(n) { for (var i = 0; i < SYS.length; i++) if (SYS[i].name === n) return SYS[i]; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffle(arr, rng) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  function normRisk(s) {
    var v = String(s || '').toLowerCase();
    if (v.indexOf('test') >= 0) return null;        // ตัด Test
    if (v.indexOf('high') >= 0) return 'High';
    if (v.indexOf('medium') >= 0) return 'Medium';
    if (v.indexOf('low') >= 0) return 'Low';        // รวม UltraLow → Low
    return null;
  }

  function parseSheet(json) {
    var out = [], rows = json && json.table && json.table.rows;
    if (!rows) return out;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!(r && r.c)) continue;
      var cell = function (idx) { return (r.c[idx] && r.c[idx].v !== null) ? r.c[idx].v : null; };
      var name = cell(2) !== null ? String(cell(2)).trim() : '';   // C = Sys_N
      if (name.indexOf('Sys') !== 0) continue;
      var B = cell(1) !== null ? parseFloat(cell(1)) : 0;          // B = ทุน/0.01
      var risk = normRisk(cell(4));                               // E = risk
      if (!B || !risk) continue;
      out.push({ name: name, title: cell(0) !== null ? String(cell(0)) : name, B: B, risk: risk });
    }
    return out;
  }

  function unitOf(name, risk, B) {
    var ss = SYSSCORE[risk];
    if (name === 'Normal') return { c: B, lab: T.normal };
    var sl = SL[name];
    if (ss > sl) return { c: B * ss, lab: T.capx + ss };
    var f = sl / ss;
    return { c: Math.round(B / f), lab: (f === 1 ? T.normal : T.lotx + (f % 1 === 0 ? f : f.toFixed(1))) };
  }

  function buildSet(cap, name, targetN, rng, force) {
    var order = force ? [byName(force)].concat(shuffle(SYS.filter(function (s) { return s.name !== force; }).slice(), rng))
                      : shuffle(SYS.slice(), rng);
    var chosen = [], remain = cap, usedFlag = null;
    for (var i = 0; i < order.length; i++) {
      if (chosen.length >= targetN) break;
      var s = order[i], isFlag = FLAG.indexOf(s.name) >= 0;
      if (isFlag && usedFlag && usedFlag !== s.name) continue;
      var u = unitOf(name, s.risk, s.B);
      var need = Math.ceil(MIN_PER_SYS / u.c), needCost = need * u.c;
      if (remain >= needCost) { chosen.push({ s: s, u: u, units: need, used: needCost, pin: isFlag }); remain -= needCost; if (isFlag) usedFlag = s.name; }
    }
    var add = true;
    while (add) { add = false; for (var j = 0; j < chosen.length; j++) { var c = chosen[j]; if (remain >= c.u.c) { c.units++; c.used += c.u.c; remain -= c.u.c; add = true; } } }
    var lots = chosen.reduce(function (a, c) { return a + c.units * 0.01; }, 0);
    return { chosen: chosen, used: cap - remain, remain: remain, lots: lots };
  }

  function card(title, res) {
    if (!res.chosen.length) return '<div class="fa-set"><h4>' + title + '</h4><div class="fa-foot">' + T.low + '</div></div>';
    var rows = res.chosen.map(function (c) {
      return '<tr><td style="font-weight:600">' + c.s.name + (c.pin ? '<span class="fa-pin">⚑</span>' : '') + '</td>' +
        '<td><span class="fa-badge" style="background:' + RCOLOR[c.s.risk] + '">' + c.s.risk + '</span></td>' +
        '<td class="fa-adj">' + c.u.lab + '</td>' +
        '<td style="text-align:right;font-weight:600">' + (c.units * 0.01).toFixed(2) + '</td>' +
        '<td style="text-align:right">¢' + fmt(c.used) + '</td></tr>';
    }).join('');
    return '<div class="fa-set"><h4>' + title + '</h4>' +
      '<table><tr><th>' + T.sys + '</th><th>Risk</th><th>' + T.adj + '</th><th style="text-align:right">' + T.lot + '</th><th style="text-align:right">' + T.used + '</th></tr>' + rows + '</table>' +
      '<div class="fa-foot"><b>' + res.chosen.length + '</b> ' + T.nSys + ' · ' + T.lotSum + ' <b>' + res.lots.toFixed(2) + '</b> · ' + T.use + ' <b>¢' + fmt(res.used) + '</b> · ' + T.left + ' ¢' + fmt(res.remain) + '</div></div>';
  }

  function render() {
    var capEl = document.getElementById('fa-cap'), riskEl = document.getElementById('fa-risk'), setsEl = document.getElementById('fa-sets');
    if (!capEl || !setsEl) return;
    var cap = Math.max(0, parseFloat(capEl.value) || 0);
    var lv = parseInt(riskEl.value, 10), name = LV[lv];
    var out = document.getElementById('fa-capout'); if (out) out.textContent = '¢ ' + fmt(cap);
    var rl = document.getElementById('fa-riskout'); if (rl) { rl.textContent = name; rl.style.background = (name === 'Normal') ? '#4a8f3a' : (RCOLOR[name] || '#4a8f3a'); }
    if (!SYS.length) { setsEl.innerHTML = '<div class="fa-loading">' + T.loading + '</div>'; return; }

    var maxAfford = Math.floor(cap / MIN_PER_SYS), small = cap < 20000;
    var lo = small ? 1 : 2, hi = Math.min(small ? 1 : MAX_SYS, maxAfford, SYS.length);
    var html = '';
    for (var k = 1; k <= NSETS; k++) {
      var rng = mulberry32(seedBase + k);
      var lo2 = Math.min(lo, hi);
      var tn = (hi < 1) ? 0 : (lo2 + Math.floor(rng() * (hi - lo2 + 1)));
      var force = small ? null : ((rng() < 0.5) ? 'Sys_1' : 'Sys_2');
      html += card(T.set + ' ' + k, tn < 1 ? { chosen: [], used: 0, remain: cap, lots: 0 } : buildSet(cap, name, tn, rng, force));
    }
    setsEl.innerHTML = html;
  }

  function wire() {
    var capEl = document.getElementById('fa-cap'), riskEl = document.getElementById('fa-risk'), sh = document.getElementById('fa-shuffle');
    if (!capEl) return;
    capEl.addEventListener('input', render);
    riskEl.addEventListener('input', render);
    if (sh) sh.addEventListener('click', function () { seedBase = Math.floor(Math.random() * 1e9); render(); });
  }

  function fetchData() {
    fetch(SHEET_URL + '&t=' + Date.now()).then(function (res) { return res.text(); }).then(function (text) {
      try {
        var json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
        SYS = parseSheet(json);
      } catch (e) { SYS = []; }
      render();
    }).catch(function () { render(); });
  }

  function init() {
    if (!document.getElementById('farm-alloc')) return;
    wire();
    render();      // แสดง loading ก่อน
    fetchData();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
