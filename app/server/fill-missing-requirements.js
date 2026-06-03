/**
 * 补全院校/专业的 A-Level 与语言要求（缺失项）。
 *
 * 说明：
 * - 优先使用库中已有字段（不覆盖非空）
 * - 对仍为空的字段，按“院校”维度填充默认值（常见官方门槛）
 * - 写入前备份 database.sqlite，并在事务中执行
 *
 * 你后续如果希望“逐专业精确到学院页面”，可以在此脚本基础上继续按 program_name 细分。
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function backupSqlite() {
  const bak = `${DB_PATH}.bak-${ts()}`;
  fs.copyFileSync(DB_PATH, bak);
  return bak;
}

function norm(s) {
  return (s || '').trim();
}

// 按院校设置的默认门槛（用于补缺，不覆盖已填）
const DEFAULTS_BY_UNI = [
  // UK
  { match: /牛津大学|Oxford/i, a: 'A*A*A（数学和进阶数学A*；需参加MAT/TMUA视年度政策）', l: 'IELTS 7.5（单项≥7.0）（Oxford）' },
  { match: /伦敦政治经济学院|LSE/i, a: 'A*AA（数学强烈建议/常要求A*）', l: 'IELTS 7.0（单项≥6.5）' },
  { match: /剑桥大学|Cambridge/i, a: 'A*A*A（数学A*；部分专业建议进阶数学）', l: 'IELTS 7.5（单项≥7.0）' },
  { match: /帝国理工|Imperial/i, a: 'A*AA-AAA（理工多要求数学）', l: 'IELTS 6.5（单项≥6.0）' },
  { match: /伦敦大学学院|UCL/i, a: 'A*AA-AAA（视专业；多要求数学）', l: 'IELTS 7.0（单项≥6.5）' },
  { match: /华威大学|Warwick/i, a: 'A*AA-AAA', l: 'IELTS 6.5（单项≥6.0）' },
  { match: /曼彻斯特大学|Manchester/i, a: 'AAA-ABB', l: 'IELTS 6.5（单项≥6.0）' },
  // HK / Singapore
  { match: /香港科技大学|HKUST/i, a: 'GCEAL/IAL 至少3门A Level合格（建议数学+理科）', l: 'IELTS 6.0 或 TOEFL iBT 80（HKUST 2026）' },
  { match: /香港大学|HKU/i, a: 'AAA-AAB（常要求数学/理科）', l: 'IELTS 6.5（单项≥5.5/6.0视项目）' },
  { match: /香港教育大学|EdUHK/i, a: 'AAB-ABB（教育相关可能有更高英语要求）', l: 'IELTS 6.5（写作/口语可能≥6.0）' },
  { match: /南洋理工大学|NTU/i, a: 'AAA（数学必备，理工/计算机更高）', l: 'IELTS 6.0-6.5 或 TOEFL iBT 90' },
  { match: /新加坡国立大学|NUS/i, a: 'AAA/A（高分段）', l: 'IELTS 6.5 或 TOEFL iBT 92' },
  // Australia
  { match: /墨尔本大学|Melbourne/i, a: 'A-Level 认可（综合换算门槛因科目组合而异）', l: 'IELTS 6.5（单项≥6.0）' },
  { match: /新南威尔士大学|UNSW/i, a: 'A-Level 认可（通常等同于较高ATAR）', l: 'IELTS 6.5（单项≥6.0）' },
  { match: /悉尼大学|Sydney/i, a: 'A-Level 认可', l: 'IELTS 6.5（单项≥6.0）' },
  { match: /莫纳什大学|Monash/i, a: 'A-Level 认可', l: 'IELTS 6.5（单项≥6.0）' },
  { match: /昆士兰大学|Queensland/i, a: 'A-Level 认可', l: 'IELTS 6.5（单项≥6.0）' },
  { match: /昆士兰科技大学|QUT/i, a: 'A-Level 认可', l: 'IELTS 6.5（单项≥6.0）' },
  { match: /西澳大学|UWA|西澳/i, a: 'A-Level 认可', l: 'IELTS 6.5（单项≥6.0）' },
  { match: /澳洲国立大学|ANU/i, a: 'A-Level 认可', l: 'IELTS 6.5（单项≥6.0）' },
  // US Arts
  { match: /罗德岛设计学院|RISD/i, a: '无固定A-Level门槛（更看作品集与学术）', l: 'TOEFL iBT 93 / IELTS 7.0 / Duolingo 120（RISD 2026）' },
  { match: /帕森斯|Parsons/i, a: '无固定A-Level门槛（更看作品集与学术）', l: 'TOEFL iBT 92 或 IELTS 7.0（艺术院校常见门槛）' },
  { match: /加州艺术学院|CalArts/i, a: '无固定A-Level门槛（更看作品集与学术）', l: 'TOEFL iBT 80 或 IELTS 6.5' },
  { match: /麻省理工学院|MIT/i, a: '无固定A-Level门槛（综合评估；需SAT/ACT）', l: 'IELTS 最低7.0（推荐7.5）；TOEFL 最低90（推荐100）（MIT）' },
  // Switzerland
  { match: /苏黎世联邦理工|ETH/i, a: '入学门槛以学校官方国际资格评估为准（本科多要求德语）', l: '德语 C1（本科多为德语授课；视专业）' },
];

function pickDefaults(uniName) {
  for (const d of DEFAULTS_BY_UNI) {
    if (d.match.test(uniName)) return d;
  }
  // 兜底：不给空值强塞，留空
  return null;
}

function run() {
  const bak = backupSqlite();
  const db = new Database(DB_PATH);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const unis = db.prepare('SELECT * FROM target_universities').all();
    const progs = db.prepare('SELECT * FROM university_programs').all();

    const updateUni = db.prepare(
      'UPDATE target_universities SET a_level_requirement=?, language_requirement=?, notes=? WHERE id=?'
    );
    const updateProg = db.prepare(
      'UPDATE university_programs SET a_level_requirement=?, language_requirement=?, notes=? WHERE id=?'
    );

    let uniUpdated = 0;
    let progUpdated = 0;

    const uniById = new Map(unis.map(u => [u.id, u]));

    for (const u of unis) {
      const d = pickDefaults(u.name || '');
      if (!d) continue;
      const nextA = norm(u.a_level_requirement) || d.a;
      const nextL = norm(u.language_requirement) || d.l;
      if (nextA !== u.a_level_requirement || nextL !== u.language_requirement) {
        const note = norm(u.notes);
        const tag = '[AUTO] 默认门槛补全（可手动调整）';
        const nextNote = note.includes(tag) ? note : (note ? `${note}\n${tag}` : tag);
        updateUni.run(nextA, nextL, nextNote, u.id);
        uniUpdated += 1;
      }
    }

    for (const p of progs) {
      const u = uniById.get(p.university_id);
      const d = pickDefaults(u?.name || '');
      if (!d) continue;
      const nextA = norm(p.a_level_requirement) || norm(u?.a_level_requirement) || d.a;
      const nextL = norm(p.language_requirement) || norm(u?.language_requirement) || d.l;
      if (nextA !== p.a_level_requirement || nextL !== p.language_requirement) {
        const note = norm(p.notes);
        const tag = '[AUTO] 默认门槛补全（可手动调整）';
        const nextNote = note.includes(tag) ? note : (note ? `${note}\n${tag}` : tag);
        updateProg.run(nextA, nextL, nextNote, p.id);
        progUpdated += 1;
      }
    }

    return { uniUpdated, progUpdated, now };
  });

  try {
    const r = tx();
    console.log('✅ 补全完成');
    console.log(`- 更新院校: ${r.uniUpdated}`);
    console.log(`- 更新专业: ${r.progUpdated}`);
    console.log(`- 备份文件: ${bak}`);
  } finally {
    db.close();
  }
}

run();

