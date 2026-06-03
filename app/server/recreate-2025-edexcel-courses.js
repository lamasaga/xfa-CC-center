/**
 * 依据「启赋一班学生成绩与申请信息汇总.md」的科目范围，重建 2025级课程与 Edexcel IAL 标准单元（course_units）。
 *
 * 要求（按用户指示）：
 * - 不创建英语课（语言能力通过语言成绩模块体现）
 * - 数学拆为两门课：
 *   - Mathematics: P1, P2, S1, M1
 *   - Further Mathematics: P3, P4, S2, M2, S3, M3
 * - 单元设置尽量贴合 Edexcel IAL 的官方单元（含常用 unit code 与满分）
 * - 写库前自动备份 database.sqlite；单事务执行，失败回滚
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');
const GRADE = '2025级';
const NOW = new Date().toISOString();

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

/**
 * Edexcel IAL 常用单元代码（Pearson unit code / paper code）与常见满分（raw marks）
 * - 数学/进阶数学/经济：100
 * - 理科 U1/U2/U4/U5：80；U3/U6：50（常见结构）
 */
const COURSE_DEFS = [
  {
    name: 'Mathematics',
    subject_code: 'IAL-MATH',
    board: 'Edexcel',
    units: [
      { unit_code: 'P1', unit_name: 'Pure Mathematics 1', max_score: 100, weight: 1.0, pearson_code: 'WMA11' },
      { unit_code: 'P2', unit_name: 'Pure Mathematics 2', max_score: 100, weight: 1.0, pearson_code: 'WMA12' },
      { unit_code: 'S1', unit_name: 'Statistics 1', max_score: 100, weight: 1.0, pearson_code: 'WST01' },
      { unit_code: 'M1', unit_name: 'Mechanics 1', max_score: 100, weight: 1.0, pearson_code: 'WME01' },
    ],
  },
  {
    name: 'Further Mathematics',
    subject_code: 'IAL-FM',
    board: 'Edexcel',
    units: [
      { unit_code: 'P3', unit_name: 'Pure Mathematics 3', max_score: 100, weight: 1.0, pearson_code: 'WMA13' },
      { unit_code: 'P4', unit_name: 'Pure Mathematics 4', max_score: 100, weight: 1.0, pearson_code: 'WMA14' },
      { unit_code: 'S2', unit_name: 'Statistics 2', max_score: 100, weight: 1.0, pearson_code: 'WST02' },
      { unit_code: 'M2', unit_name: 'Mechanics 2', max_score: 100, weight: 1.0, pearson_code: 'WME02' },
      { unit_code: 'S3', unit_name: 'Statistics 3', max_score: 100, weight: 1.0, pearson_code: 'WST03' },
      { unit_code: 'M3', unit_name: 'Mechanics 3', max_score: 100, weight: 1.0, pearson_code: 'WME03' },
    ],
  },
  {
    name: 'Physics',
    subject_code: 'IAL-PHYS',
    board: 'Edexcel',
    units: [
      { unit_code: 'U1', unit_name: 'Mechanics and Materials', max_score: 80, weight: 1.0, pearson_code: 'WPH11' },
      { unit_code: 'U2', unit_name: 'Waves and Electricity', max_score: 80, weight: 1.0, pearson_code: 'WPH12' },
      { unit_code: 'U3', unit_name: 'Practical Skills in Physics I', max_score: 50, weight: 1.0, pearson_code: 'WPH13' },
      { unit_code: 'U4', unit_name: 'Further Mechanics, Fields and Particles', max_score: 80, weight: 1.0, pearson_code: 'WPH14' },
      { unit_code: 'U5', unit_name: 'Thermodynamics, Radiation, Oscillations and Cosmology', max_score: 80, weight: 1.0, pearson_code: 'WPH15' },
      { unit_code: 'U6', unit_name: 'Practical Skills in Physics II', max_score: 50, weight: 1.0, pearson_code: 'WPH16' },
    ],
  },
  {
    name: 'Chemistry',
    subject_code: 'IAL-CHEM',
    board: 'Edexcel',
    units: [
      { unit_code: 'U1', unit_name: 'Structure, Bonding and Introduction to Organic Chemistry', max_score: 80, weight: 1.0, pearson_code: 'WCH11' },
      { unit_code: 'U2', unit_name: 'Energetics, Group Chemistry, Halogenoalkanes and Alcohols', max_score: 80, weight: 1.0, pearson_code: 'WCH12' },
      { unit_code: 'U3', unit_name: 'Practical Skills in Chemistry I', max_score: 50, weight: 1.0, pearson_code: 'WCH13' },
      { unit_code: 'U4', unit_name: 'Rates, Equilibria and Further Organic Chemistry', max_score: 80, weight: 1.0, pearson_code: 'WCH14' },
      { unit_code: 'U5', unit_name: 'Transition Metals and Organic Nitrogen Chemistry', max_score: 80, weight: 1.0, pearson_code: 'WCH15' },
      { unit_code: 'U6', unit_name: 'Practical Skills in Chemistry II', max_score: 50, weight: 1.0, pearson_code: 'WCH16' },
    ],
  },
  {
    name: 'Biology',
    subject_code: 'IAL-BIOL',
    board: 'Edexcel',
    units: [
      { unit_code: 'U1', unit_name: 'Molecules, Diet, Transport and Health', max_score: 80, weight: 1.0, pearson_code: 'WBI11' },
      { unit_code: 'U2', unit_name: 'Cells, Development, Biodiversity and Conservation', max_score: 80, weight: 1.0, pearson_code: 'WBI12' },
      { unit_code: 'U3', unit_name: 'Practical Skills in Biology I', max_score: 50, weight: 1.0, pearson_code: 'WBI13' },
      { unit_code: 'U4', unit_name: 'Energy, Environment, Microbiology and Immunity', max_score: 80, weight: 1.0, pearson_code: 'WBI14' },
      { unit_code: 'U5', unit_name: 'Respiration, Internal Environment, Coordination and Gene Technology', max_score: 80, weight: 1.0, pearson_code: 'WBI15' },
      { unit_code: 'U6', unit_name: 'Practical Skills in Biology II', max_score: 50, weight: 1.0, pearson_code: 'WBI16' },
    ],
  },
  {
    name: 'Economics',
    subject_code: 'IAL-ECON',
    board: 'Edexcel',
    units: [
      { unit_code: 'U1', unit_name: 'Markets in Action', max_score: 100, weight: 1.0, pearson_code: 'WEC11' },
      { unit_code: 'U2', unit_name: 'Macroeconomic Performance and Policy', max_score: 100, weight: 1.0, pearson_code: 'WEC12' },
      { unit_code: 'U3', unit_name: 'Business Behaviour', max_score: 100, weight: 1.0, pearson_code: 'WEC13' },
      { unit_code: 'U4', unit_name: 'Developments in the Global Economy', max_score: 100, weight: 1.0, pearson_code: 'WEC14' },
    ],
  },
];

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ database.sqlite not found:', DB_PATH);
    process.exit(1);
  }

  const bak = backupSqlite();
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const tx = db.transaction(() => {
    const findCourse = db.prepare(
      'SELECT id FROM courses WHERE grade_level=? AND name=? AND board=? LIMIT 1'
    );
    const insertCourse = db.prepare(
      `INSERT INTO courses
       (id, name, subject_code, board, grade_level, teacher_id, academic_year, semester, max_students, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const listUnits = db.prepare('SELECT id, unit_code FROM course_units WHERE course_id=?');
    const insertUnit = db.prepare(
      `INSERT INTO course_units
       (id, course_id, unit_code, unit_name, max_score, weight, description, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let createdCourses = 0;
    let createdUnits = 0;
    let skippedCourses = 0;
    let skippedUnits = 0;

    for (const def of COURSE_DEFS) {
      const existing = findCourse.get(GRADE, def.name, def.board);
      let courseId = existing?.id;
      if (!courseId) {
        courseId = randomUUID();
        insertCourse.run(
          courseId,
          def.name,
          def.subject_code || '',
          def.board,
          GRADE,
          null,
          null,
          null,
          60,
          'Auto-generated (Edexcel IAL units configured)',
          NOW
        );
        createdCourses += 1;
      } else {
        skippedCourses += 1;
      }

      const existingUnits = listUnits.all(courseId);
      const existingSet = new Set(existingUnits.map(u => u.unit_code));

      def.units.forEach((u, idx) => {
        if (existingSet.has(u.unit_code)) {
          skippedUnits += 1;
          return;
        }
        const desc = u.pearson_code ? `Pearson Unit Code: ${u.pearson_code}` : '';
        insertUnit.run(
          randomUUID(),
          courseId,
          u.unit_code,
          u.unit_name,
          u.max_score,
          u.weight ?? 1.0,
          desc,
          idx,
          NOW
        );
        createdUnits += 1;
      });
    }

    return { createdCourses, createdUnits, skippedCourses, skippedUnits };
  });

  try {
    const r = tx();
    console.log('✅ 2025级课程重建完成');
    console.log(`- 新建课程: ${r.createdCourses}（跳过已存在: ${r.skippedCourses}）`);
    console.log(`- 新建单元: ${r.createdUnits}（跳过已存在: ${r.skippedUnits}）`);
    console.log(`- 数据库备份: ${bak}`);
  } catch (e) {
    console.error('❌ 重建失败（已回滚事务）:', e?.message || e);
    console.error('可用备份恢复:', bak);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

run();

