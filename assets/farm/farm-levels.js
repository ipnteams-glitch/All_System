/* farm-levels.js — แกนเลเวล (พอร์ตจาก vibemaster: server/levels.js + config.js)
 * เป็น browser JS ล้วน ไม่มี dependency / ไม่มี Node / ไม่มี backend
 * ทุกอย่าง deterministic จาก "snapshot" ในชีต (กำไร/ทุน/ดาว) → เลเวล/แถบ XP/ตำแหน่ง
 * ค่าคงที่ทั้งหมดจูนได้ที่ TUNE ด้านล่าง (คาลิเบรตหลังเห็นตัวเลขจริง)
 */
(function (global) {
  'use strict';
  const VMFarm = (global.VMFarm = global.VMFarm || {});

  // ===== ค่าคงที่จูนได้ =====
  const TUNE = {
    LEVEL_BASE: 80,      // XP เพื่อขึ้นเลเวล 1→2 (เส้นโค้ง exponential เดิมของ vibemaster)
    LEVEL_GROWTH: 1.18,  // อัตราทวีต่อเลเวล
    LEVEL_CAP: 100,
    GROWTH_W: 45,        // น้ำหนัก growth% (= กำไร/ทุน*100) — เป็น "ฐาน" ของเลเวล
    PROFIT_W: 0,         // น้ำหนักกำไรดิบ (ปิดไว้เพื่อความยุติธรรมข้ามขนาดทุน; ตั้ง >0 เพื่อเปิด เช่น 0.02)
    STAR_BONUS: 0.12,    // ดาว 0–5 → ตัวคูณ 1.0–1.6
  };
  VMFarm.TUNE = TUNE;

  // ===== เส้นโค้งเลเวล (พอร์ตตรง) =====
  function expRequiredForLevel(level) {
    return Math.round(TUNE.LEVEL_BASE * Math.pow(TUNE.LEVEL_GROWTH, level - 1));
  }
  function totalExpForLevel(targetLevel) {
    let t = 0;
    for (let l = 1; l < targetLevel; l++) t += expRequiredForLevel(l);
    return t;
  }
  function calcLevelFromExp(totalExp) {
    let remaining = Math.max(0, totalExp);
    let level = 1;
    while (level < TUNE.LEVEL_CAP) {
      const req = expRequiredForLevel(level);
      if (remaining < req) break;
      remaining -= req;
      level++;
    }
    return { level: level, expRequired: expRequiredForLevel(level) };
  }
  function expProgress(totalExp) {
    const info = calcLevelFromExp(totalExp);
    const inLevel = Math.max(0, totalExp) - totalExpForLevel(info.level);
    return {
      level: info.level,
      currentLevelExp: inLevel,
      expToNextLevel: info.expRequired,
      percentage: Math.min(100, (inLevel / info.expRequired) * 100),
    };
  }

  // ===== snapshot → xp (growth% ถ่วงด้วยดาว) =====
  function xpFromStats(row) {
    const profit = Number(row.profit) || 0;
    const balance = Number(row.balance) || 0;
    const stars = Math.max(0, Math.min(5, Number(row.stars) || 0));
    const growth = balance > 0 ? (profit / balance) * 100 : 0;
    const base = Math.max(0, growth) * TUNE.GROWTH_W;
    const tip = Math.max(0, profit) * TUNE.PROFIT_W;
    const starMul = 1 + stars * TUNE.STAR_BONUS;
    return Math.round((base + tip) * starMul);
  }

  // ===== title ladder 2 ธีม =====
  const TITLES = {
    farm: [
      { max: 3, t: 'เมล็ดพันธุ์', emoji: '🌱' },
      { max: 7, t: 'ต้นกล้า', emoji: '🌿' },
      { max: 14, t: 'รวงเขียว', emoji: '🌾' },
      { max: 24, t: 'ไร่งาม', emoji: '🌻' },
      { max: 100, t: 'พญาไร่ทอง', emoji: '🏆' },
    ],
    dev: [
      { max: 5, t: 'Intern', emoji: '🐣' },
      { max: 12, t: 'Junior Dev', emoji: '💻' },
      { max: 25, t: 'AI Developer', emoji: '🤖' },
      { max: 40, t: 'Senior Engineer', emoji: '⚙️' },
      { max: 60, t: 'Staff Engineer', emoji: '🛠️' },
      { max: 85, t: 'Principal Engineer', emoji: '🧙' },
      { max: 100, t: 'AI Architect', emoji: '👑' },
    ],
  };
  function titleFor(theme, level) {
    const ladder = TITLES[theme] || TITLES.farm;
    for (const x of ladder) if (level <= x.max) return x;
    return ladder[ladder.length - 1];
  }

  // ===== รวม: snapshot row → RPG stat พร้อมใช้ =====
  function statsFor(row, theme) {
    const xp = xpFromStats(row);
    const prog = expProgress(xp);
    const title = titleFor(theme || 'farm', prog.level);
    const balance = Number(row.balance) || 0;
    const profit = Number(row.profit) || 0;
    const growth = balance > 0 ? (profit / balance) * 100 : 0;
    return {
      xp: xp,
      level: prog.level,
      pct: prog.percentage,
      inLevel: Math.round(prog.currentLevelExp),
      toNext: Math.round(prog.expToNextLevel),
      title: title.t,
      titleEmoji: title.emoji,
      growth: growth,
      gold: Math.max(0, Math.round(profit)),
      stars: Math.max(0, Math.min(5, Number(row.stars) || 0)),
      tier: Math.min(4, Math.max(0, Number(row.stars) || 0)),
    };
  }

  VMFarm.xpFromStats = xpFromStats;
  VMFarm.expProgress = expProgress;
  VMFarm.titleFor = titleFor;
  VMFarm.statsFor = statsFor;
})(typeof window !== 'undefined' ? window : this);
