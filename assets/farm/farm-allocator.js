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
          low: 'ทุนไม่พอ (ขั้นต่ำ ¢10,000/ระบบ)', loading: '⏳ กำลังโหลดข้อมูลระบบ...', download: '📥 ดาวน์โหลดชุดติดตั้ง', dling: '⏳ กำลังสร้าง...' },
    en: { cap: 'Capital (Cent)', risk: 'Risk level', shuffle: '🎲 Reshuffle', sys: 'System', adj: 'Adj', lot: 'Lot', used: 'Capital',
          set: 'Set', nSys: 'systems', lotSum: 'total lot', use: 'used', left: 'left', normal: 'base', lotx: 'lot×', capx: 'cap×',
          low: 'Not enough (min ¢10,000/system)', loading: '⏳ Loading systems...', download: '📥 Download installer', dling: '⏳ Building...' }
  }[LANG];

  var SHEET_ID = '193XZLwmEDX7oTGZJEEjHKcFSZy4bDf5NNfPdr75gDYQ';   // ทุน(B) + risk(E)
  var SHEET_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&gid=0';
  var RT_ID = '1B2XVPTkg4HBtd8XlQBwOSlisakAkyR1HbGIz1-wVxAU';      // recommend (comment = col J)
  var RT_URL = 'https://docs.google.com/spreadsheets/d/' + RT_ID + '/gviz/tq?tqx=out:json&gid=0';
  var FLAG_PCT = 0.4;   // flagship (recommend) ต้อง >= 40% ของทุนรวม

  var MIN_PER_SYS = 10000, NSETS = 5, MAX_SYS = 5;
  var LV = ['', 'Low', 'Normal', 'Medium', 'High'];
  var SL = { Low: 1, Medium: 2, High: 3 };
  var SYSSCORE = { Low: 1, Medium: 2, High: 3 };
  var RCOLOR = { Low: '#1e8c4a', Medium: '#b85c00', High: '#a83232' };

  var SYS = [];   // โหลดจากชีต
  var seedBase = Math.floor(Math.random() * 1e9);
  var LAST = { cap: 0, risk: 'Normal', sets: [] };   // ผลล่าสุด (สำหรับดาวน์โหลด)
  var EA_NAME = 'Harvest_Famr v8.0_Multi.ex5';

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

  // lot = 0.01×f (ปลอดภัย) หรือ 0.01 (เสี่ยง); cost ต่อ unit = B หรือ B×ss (กลมเสมอ ไม่มีเศษ)
  function unitOf(name, risk, B) {
    var ss = SYSSCORE[risk];
    if (name === 'Normal') return { lot: 0.01, c: B, lab: T.normal };
    var sl = SL[name];
    if (ss > sl) return { lot: 0.01, c: B * ss, lab: T.capx + ss };        // เสี่ยง: 0.01 lot, cost B×ss
    var f = sl / ss;
    return { lot: 0.01 * f, c: B, lab: (f === 1 ? T.normal : T.lotx + (f % 1 === 0 ? f : f.toFixed(1))) };  // ปลอดภัย: 0.01×f lot, cost B
  }

  function buildSet(cap, name, targetN, rng, force) {
    var order = force ? [byName(force)].concat(shuffle(SYS.filter(function (s) { return s.name !== force; }).slice(), rng))
                      : shuffle(SYS.slice(), rng);
    var chosen = [], remain = cap;
    for (var i = 0; i < order.length; i++) {
      if (chosen.length >= targetN) break;
      var s = order[i];
      var u = unitOf(name, s.risk, s.B);
      var need = Math.ceil(MIN_PER_SYS / u.c), needCost = need * u.c;
      if (remain >= needCost) { chosen.push({ s: s, u: u, units: need, used: needCost, pin: (s.name === force) }); remain -= needCost; }
    }
    var add = true;
    while (add) { add = false; for (var j = 0; j < chosen.length; j++) { var c = chosen[j]; if (remain >= c.u.c) { c.units++; c.used += c.u.c; remain -= c.u.c; add = true; } } }
    // ปัดทุนต่อระบบลงใกล้ multiple 5000 (lot ยัง 0.01) — คงขั้นต่ำ 10,000
    chosen.forEach(function (c) {
      var t = Math.floor(c.used / 5000) * 5000;
      var nu = Math.floor(t / c.u.c);
      var minU = Math.ceil(MIN_PER_SYS / c.u.c);
      if (nu < minU) nu = minU;
      if (nu < c.units) { remain += (c.units - nu) * c.u.c; c.units = nu; c.used = nu * c.u.c; }
    });
    // เติมเงินเหลือ: บล็อก 5000 ให้ระบบที่ลงตัว (u.c หาร 5000) ก่อน — ทุนยังกลม
    var fa = true;
    while (fa && remain >= 5000) { fa = false;
      for (var a = 0; a < chosen.length; a++) { var ca = chosen[a];
        if (5000 % ca.u.c === 0 && remain >= 5000) { ca.units += 5000 / ca.u.c; ca.used += 5000; remain -= 5000; fa = true; } } }
    // เงินเหลือที่เหลือ (<5000 หรือไม่มีตัวลงตัว) เติมด้วยระบบใดก็ได้ จนใช้หมด (ตัวเลือกรอง เช่น B=3000)
    var fb = true;
    while (fb) { fb = false;
      for (var b = 0; b < chosen.length; b++) { var cb = chosen[b];
        if (remain >= cb.u.c) { cb.units++; cb.used += cb.u.c; remain -= cb.u.c; fb = true; } } }
    // บังคับ flagship (recommend) >= 40% ของทุนรวม + มากกว่าทุก non-flagship
    if (force) {
      var fc = null; for (var fi = 0; fi < chosen.length; fi++) { if (chosen[fi].s.name === force) { fc = chosen[fi]; break; } }
      if (fc && chosen.length > 1) {
        var guard = 0;
        while (guard++ < 1000) {
          var total = chosen.reduce(function (a, c) { return a + c.used; }, 0);
          var maxOther = 0, big = null;
          for (var oi = 0; oi < chosen.length; oi++) { var cc = chosen[oi];
            if (cc !== fc) { if (cc.used > maxOther) maxOther = cc.used; if (!big || cc.used > big.used) big = cc; } }
          if (fc.used >= FLAG_PCT * total && fc.used > maxOther) break;
          if (!big) break;
          if (big.units <= Math.ceil(MIN_PER_SYS / big.u.c)) break;    // ลด other ไม่ได้ (ขั้นต่ำ 10k)
          big.units--; big.used -= big.u.c; remain += big.u.c;
          if (remain >= 5000 && 5000 % fc.u.c === 0) { fc.units += 5000 / fc.u.c; fc.used += 5000; remain -= 5000; }
          else if (remain >= fc.u.c) { fc.units++; fc.used += fc.u.c; remain -= fc.u.c; }
        }
        while (remain >= fc.u.c) { fc.units++; fc.used += fc.u.c; remain -= fc.u.c; }   // เงินเหลือเข้า flagship
      }
    }
    var lots = chosen.reduce(function (a, c) { return a + c.units * c.u.lot; }, 0);
    return { chosen: chosen, used: cap - remain, remain: remain, lots: lots };
  }

  function card(idx, title, res) {
    if (!res.chosen.length) return '<div class="fa-set" data-i="' + idx + '"><h4>' + title + '</h4><div class="fa-foot">' + T.low + '</div></div>';
    var rows = res.chosen.map(function (c) {
      return '<tr><td style="font-weight:600">' + c.s.name + (c.pin ? '<span class="fa-pin">⚑</span>' : '') + '</td>' +
        '<td><span class="fa-badge" style="background:' + RCOLOR[c.s.risk] + '">' + c.s.risk + '</span></td>' +
        '<td class="fa-adj">' + c.u.lab + '</td>' +
        '<td style="text-align:right;font-weight:600">' + (c.units * c.u.lot).toFixed(2) + '</td>' +
        '<td style="text-align:right">¢' + fmt(c.used) + '</td></tr>';
    }).join('');
    return '<div class="fa-set" data-i="' + idx + '"><h4>' + title + '</h4>' +
      '<table><tr><th>' + T.sys + '</th><th>Risk</th><th>' + T.adj + '</th><th style="text-align:right">' + T.lot + '</th><th style="text-align:right">' + T.used + '</th></tr>' + rows + '</table>' +
      '<div class="fa-foot"><b>' + res.chosen.length + '</b> ' + T.nSys + ' · ' + T.lotSum + ' <b>' + res.lots.toFixed(2) + '</b> · ' + T.use + ' <b>¢' + fmt(res.used) + '</b> · ' + T.left + ' ¢' + fmt(res.remain) + '</div>' +
      '<button class="fa-dl" data-i="' + idx + '">' + T.download + '</button></div>';
  }

  function render() {
    var capEl = document.getElementById('fa-cap'), riskEl = document.getElementById('fa-risk'), setsEl = document.getElementById('fa-sets');
    if (!capEl || !setsEl) return;
    var cap = Math.max(0, parseFloat(capEl.value) || 0);
    var lv = parseInt(riskEl.value, 10), name = LV[lv];
    var out = document.getElementById('fa-capout'); if (out) out.textContent = '¢ ' + fmt(cap);
    var rl = document.getElementById('fa-riskout'); if (rl) { rl.textContent = name; rl.style.background = (name === 'Normal') ? '#4a8f3a' : (RCOLOR[name] || '#4a8f3a'); }
    if (!SYS.length) { setsEl.innerHTML = '<div class="fa-loading">' + T.loading + '</div>'; return; }

    var maxAfford = Math.floor(cap / MIN_PER_SYS), small = cap < 30000;   // <30k = 1 ระบบ
    var lo = small ? 1 : 2, hi = Math.min(small ? 1 : MAX_SYS, maxAfford, SYS.length);
    var nSets = cap < 100000 ? 4 : (cap > 120000 ? 6 : 5);   // จำนวนเซ็ตตามทุน
    var flags = SYS.filter(function (s) { return s.rec; });  // ระบบ recommend = flagship
    LAST = { cap: cap, risk: name, sets: [] };
    var seen = {}, built = [], tries = 0, k = 0;
    while (built.length < nSets && tries < 80) {
      k++; tries++;
      var rng = mulberry32(seedBase + k);
      var lo2 = Math.min(lo, hi);
      var tn = (hi < 1) ? 0 : (lo2 + Math.floor(rng() * (hi - lo2 + 1)));
      var force = small ? null : (flags.length ? flags[Math.floor(rng() * flags.length)].name : null);
      if (tn < 1) continue;
      var res = buildSet(cap, name, tn, rng, force);
      if (!res.chosen.length) continue;
      var sig = res.chosen.map(function (c) { return c.s.name + ':' + c.units; }).sort().join('|');  // เซ็ตไม่ซ้ำ
      if (seen[sig]) continue;
      seen[sig] = 1; built.push(res);
    }
    var html = '';
    for (var i = 0; i < built.length; i++) {
      LAST.sets.push({ title: T.set + ' ' + (i + 1), res: built[i] });
      html += card(i, T.set + ' ' + (i + 1), built[i]);
    }
    setsEl.innerHTML = html || ('<div class="fa-loading">' + T.low + '</div>');
  }

  // ===== ดาวน์โหลดชุดติดตั้ง (zip: setup.ps1 + config.json + card.png + README) =====
  var LIBS = { zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
               h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' };
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }
  function loadLibs() {
    var p = Promise.resolve();
    if (!window.JSZip) p = p.then(function () { return loadScript(LIBS.zip); });
    if (!window.html2canvas) p = p.then(function () { return loadScript(LIBS.h2c); });
    return p;
  }

  function genConfig(s) {
    var sys = s.res.chosen.map(function (c) {
      return { sys: c.s.name, title: c.s.title, risk: c.s.risk, lot: +(c.units * c.u.lot).toFixed(2), capital: c.used, adjust: c.u.lab };
    });
    return { set: s.title, account_capital: LAST.cap, risk_level: LAST.risk, ea: EA_NAME, systems: sys };
  }

  function genSetupPs1() {
    return [
      '# ===== ติดตั้งฟาร์มอัตโนมัติ — clone template mt5_1 ตามจำนวนระบบ =====',
      'chcp 65001 > $null',
      'trap { Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red; Read-Host "Enter to close"; exit 1 }',
      '$Base = "C:\\MT5_Portable_Farm"',
      '$Template = "$Base\\mt5_1"',
      '$TplUrl = "https://github.com/ipnteams-glitch/All_System/releases/download/template-v1/template_mt5.zip"',
      'if (-not (Test-Path $Template)) {',
      '  Write-Host "ดาวน์โหลด template MT5 (ครั้งแรก ~133MB)..." -ForegroundColor Cyan',
      '  if (-not (Test-Path $Base)) { New-Item -ItemType Directory $Base -Force | Out-Null }',
      '  $zip = "$Base\\template_mt5.zip"',
      '  try { Invoke-WebRequest -Uri $TplUrl -OutFile $zip -UseBasicParsing } catch { Write-Host "ดาวน์โหลด template ไม่สำเร็จ" -ForegroundColor Red; Read-Host "Enter"; exit }',
      '  Expand-Archive -Path $zip -DestinationPath $Base -Force',
      '  Remove-Item $zip -Force',
      '  Write-Host "ติดตั้ง template เสร็จ" -ForegroundColor Green',
      '}',
      '$cfg = Get-Content "$PSScriptRoot\\config.json" -Raw -Encoding UTF8 | ConvertFrom-Json',
      '$CounterFile = "$Base\\counter.txt"',
      '$Desktop = [Environment]::GetFolderPath("Desktop")',
      '$Wsh = New-Object -ComObject WScript.Shell',
      'Write-Host ("สร้าง {0} terminal สำหรับ {1}" -f $cfg.systems.Count, $cfg.set) -ForegroundColor Cyan',
      'foreach ($s in $cfg.systems) {',
      '  $n = 0; if (Test-Path $CounterFile) { $n = [int](Get-Content $CounterFile) }',
      '  $n++; $name = "mt5_$n"; $dst = "$Base\\$name"',
      '  Write-Host ("  -> {0}  [{1}] lot {2} capital {3}" -f $name, $s.sys, $s.lot, $s.capital) -ForegroundColor Green',
      '  robocopy $Template $dst /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null',
      '  $sc = $Wsh.CreateShortcut("$Desktop\\$name ($($s.sys)).lnk")',
      '  $sc.TargetPath = "$dst\\terminal64.exe"; $sc.Arguments = "/portable"; $sc.WorkingDirectory = $dst; $sc.Save()',
      '  Set-Content -Path $CounterFile -Value $n',
      '}',
      'Write-Host "เสร็จ! เปิด terminal จาก Desktop -> login -> ลาก EA -> ตั้ง Channel+Lot ตาม card.png" -ForegroundColor Yellow',
      'Read-Host "Enter to close"'
    ].join('\r\n');
  }
  var RUN_BAT = '@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"\r\npause\r\n';

  function genReadme(cfg) {
    var lines = ['ชุดติดตั้งฟาร์ม - ' + cfg.set, '================================', '',
      'ทุนบัญชี: ' + cfg.account_capital + ' cent | ความเสี่ยง: ' + cfg.risk_level, 'EA: ' + cfg.ea, '',
      'ระบบในชุดนี้:'];
    cfg.systems.forEach(function (s) { lines.push('  - ' + s.sys + ' | lot ' + s.lot + ' | ทุน ' + s.capital + ' | ' + s.risk + ' | ' + s.adjust); });
    lines.push('', 'วิธีใช้บน VPS:',
      '1. แตก zip วางที่ไหนก็ได้ (เช่น Desktop)',
      '2. ดับเบิลคลิก run_setup.bat',
      '   - ครั้งแรก: ดาวน์โหลด template MT5 (~133MB) -> C:\\MT5_Portable_Farm\\mt5_1 อัตโนมัติ',
      '   - clone terminal ตามจำนวนระบบ + shortcut /portable บน Desktop',
      '3. เปิดแต่ละ terminal -> login บัญชี -> ลาก EA (' + cfg.ea + ') ลงกราฟ -> ตั้ง Channel = Sys_N, Lot ตาม card.png',
      '', 'card.png = ภาพการ์ดเซ็ตนี้ (อ้างอิง lot/ทุนต่อระบบ)');
    return lines.join('\r\n');
  }

  function faDownload(idx) {
    var s = LAST.sets[idx]; if (!s || !s.res.chosen.length) return;
    var btn = document.querySelector('.fa-set[data-i="' + idx + '"] .fa-dl');
    var old = btn ? btn.textContent : ''; if (btn) { btn.textContent = T.dling; btn.disabled = true; }
    loadLibs().then(function () {
      var cardEl = document.querySelector('.fa-set[data-i="' + idx + '"]');
      return window.html2canvas(cardEl, { backgroundColor: '#1c1f26', scale: 2, ignoreElements: function (el) { return el.classList && el.classList.contains('fa-dl'); } });
    }).then(function (canvas) {
      return new Promise(function (resolve) { canvas.toBlob(function (b) { resolve(b); }, 'image/png'); });
    }).then(function (pngBlob) {
      var cfg = genConfig(s);
      var zip = new window.JSZip();
      zip.file('config.json', JSON.stringify(cfg, null, 2));
      zip.file('setup.ps1', genSetupPs1());
      zip.file('run_setup.bat', RUN_BAT);
      zip.file('README.txt', genReadme(cfg));
      zip.file('card.png', pngBlob);
      return zip.generateAsync({ type: 'blob' });
    }).then(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'farm_' + s.title.replace(/\s+/g, '_') + '.zip'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      if (btn) { btn.textContent = old; btn.disabled = false; }
    }).catch(function (e) { if (btn) { btn.textContent = old; btn.disabled = false; } console.error('download fail', e); });
  }

  function wire() {
    var capEl = document.getElementById('fa-cap'), riskEl = document.getElementById('fa-risk'), sh = document.getElementById('fa-shuffle'), setsEl = document.getElementById('fa-sets');
    if (!capEl) return;
    capEl.addEventListener('input', render);
    riskEl.addEventListener('input', render);
    if (sh) sh.addEventListener('click', function () { seedBase = Math.floor(Math.random() * 1e9); render(); });
    if (setsEl) setsEl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.fa-dl') : null;
      if (b) faDownload(parseInt(b.getAttribute('data-i'), 10));
    });
  }

  function parseRec(json) {
    var m = {}, rows = json && json.table && json.table.rows;
    if (!rows) return m;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; if (!(r && r.c)) continue;
      var nm = r.c[1] && r.c[1].v !== null ? String(r.c[1].v).trim() : '';          // B = name
      var cm = r.c[9] && r.c[9].v !== null ? String(r.c[9].v).toLowerCase() : '';    // J = comment
      if (nm && cm.indexOf('recommend') >= 0) m[nm] = true;
    }
    return m;
  }
  function fetchData() {
    Promise.all([
      fetch(SHEET_URL + '&t=' + Date.now()).then(function (r) { return r.text(); }),
      fetch(RT_URL + '&t=' + Date.now()).then(function (r) { return r.text(); })
    ]).then(function (texts) {
      try {
        var j0 = JSON.parse(texts[0].substring(texts[0].indexOf('{'), texts[0].lastIndexOf('}') + 1));
        SYS = parseSheet(j0);
        var j1 = JSON.parse(texts[1].substring(texts[1].indexOf('{'), texts[1].lastIndexOf('}') + 1));
        var rec = parseRec(j1);
        SYS.forEach(function (s) { s.rec = !!rec[s.name]; });
      } catch (e) { }
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
