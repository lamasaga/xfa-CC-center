/**
 * 从「启赋一班学生成绩与申请信息汇总.md」导入 2025级学生的：
 * - 校内成绩（期中/期末）：写入 unit_grades，exam_type=internal
 * - Edexcel IAL 实考单元成绩：写入 unit_grades，exam_type=final
 *
 * 重要约定：
 * - 校内成绩存在小数：使用 score=分数×10、max_score=1000 保存（保留 1 位小数精度）
 * - IAL 表格里的 98/120 这类通常是 UMS/UMS max，因此理科课程单元 max_score 统一改为 UMS 满分：
 *   - U1/U2/U4/U5：120
 *   - U3/U6：60
 * - 数学拆分：
 *   - Mathematics: P1,P2,S1,M1
 *   - Further Mathematics: P3,P4,S2,M2,S3,M3
 *   本脚本将 IAL 表里的 P3/P4 写入 Further Mathematics。
 *
 * 安全：
 * - 写库前备份 database.sqlite
 * - 单事务执行，失败回滚
 * - 去重：同 student_course_id + unit_code + exam_type + score + max_score 已存在则跳过
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');
const MD_PATH = path.join(ROOT, '启赋一班学生成绩与申请信息汇总.md');

const TARGET_GRADE = '2025级';
const NOW = new Date().toISOString();

// 用于校内成绩的“伪日期”，保证“最近两次”逻辑稳定
const INTERNAL_MID_DATE = '2026-03-01';
const INTERNAL_FINAL_DATE = '2026-06-01';
const IAL_EXAM_DATE = '2026-01-01';

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

function isEmptyCell(v) {
  if (v === undefined || v === null) return true;
  const s = String(v).trim();
  return s === '' || s === '-' || s === '/' || s.toLowerCase() === 'nan';
}

function parseScoreCell(cell) {
  // 例： "91/100 a", "83/100a", "98/120a"
  if (isEmptyCell(cell)) return null;
  const s = String(cell).trim();
  const m = s.match(/(\d+)\s*\/\s*(\d+)\s*([a-zA-Z])?/);
  if (!m) return null;
  const score = parseInt(m[1], 10);
  const max = parseInt(m[2], 10);
  const g = (m[3] || '').toUpperCase();
  const grade = g === 'U' ? 'U' : g; // A/B/C/D/E/U
  return { score, max_score: max, grade };
}

function parseMarkdownTables(md) {
  const lines = md.split(/\r?\n/);

  function readTable(startIdx) {
    const header = lines[startIdx].trim();
    const sep = lines[startIdx + 1]?.trim() || '';
    if (!header.startsWith('|') || !sep.startsWith('|')) return null;
    const headers = header.split('|').map(s => s.trim()).filter(Boolean);
    const rows = [];
    for (let i = startIdx + 2; i < lines.length; i += 1) {
      const rowLine = lines[i].trim();
      if (!rowLine.startsWith('|')) break;
      const cells = rowLine.split('|').map(s => s.trim()).filter(Boolean);
      if (cells.length === 0) continue;
      const row = {};
      for (let c = 0; c < headers.length; c += 1) row[headers[c]] = cells[c] ?? '';
      rows.push(row);
    }
    return { headers, rows };
  }

  const tables = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith('| 姓名 |')) {
      const t = readTable(i);
      if (t) tables.push(t);
    }
  }

  const byName = new Map();
  const ensure = (name) => {
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        internal: {
          Mathematics: { mid: null, final: null },
          Physics: { mid: null, final: null },
          Chemistry: { mid: null, final: null },
          Biology: { mid: null, final: null },
          Economics: { mid: null, final: null },
        },
        ial: {
          Mathematics: {}, // P1,P2,S1,M1
          FurtherMathematics: {}, // P3,P4,S2,M2,S3,M3
          Physics: {}, // U1..U6 (目前仅U1列)
          Chemistry: {},
          Biology: {},
          Economics: {},
        },
      });
    }
    return byName.get(name);
  };

  for (const t of tables) {
    const h = t.headers.join('|');
    const isSchool1 = h.includes('数学期中') || h.includes('物理期中') || h.includes('化学期中');
    const isSchool2 = h.includes('AI期中') || h.includes('IT期中') || h.includes('经济期中');
    const isSchool3 = h.includes('生物期中') || h.includes('心理期中');
    const isIAL = h.includes('数学P1') || h.includes('物理U1') || h.includes('经济U1');

    for (const r of t.rows) {
      const name = String(r['姓名'] || '').trim();
      if (!name) continue;
      const obj = ensure(name);

      if (isSchool1) {
        if (!isEmptyCell(r['数学期中'])) obj.internal.Mathematics.mid = parseFloat(r['数学期中']);
        if (!isEmptyCell(r['数学期末'])) obj.internal.Mathematics.final = parseFloat(r['数学期末']);
        if (!isEmptyCell(r['物理期中'])) obj.internal.Physics.mid = parseFloat(r['物理期中']);
        if (!isEmptyCell(r['物理期末'])) obj.internal.Physics.final = parseFloat(r['物理期末']);
        if (!isEmptyCell(r['化学期中'])) obj.internal.Chemistry.mid = parseFloat(r['化学期中']);
        if (!isEmptyCell(r['化学期末'])) obj.internal.Chemistry.final = parseFloat(r['化学期末']);
      }
      if (isSchool2) {
        if (!isEmptyCell(r['经济期中'])) obj.internal.Economics.mid = parseFloat(r['经济期中']);
        if (!isEmptyCell(r['经济期末'])) obj.internal.Economics.final = parseFloat(r['经济期末']);
      }
      if (isSchool3) {
        if (!isEmptyCell(r['生物期中'])) obj.internal.Biology.mid = parseFloat(r['生物期中']);
        if (!isEmptyCell(r['生物期末'])) obj.internal.Biology.final = parseFloat(r['生物期末']);
      }

      if (isIAL) {
        // 数学 P1-P4, M1, 以及理科/经济 U1
        for (const k of ['数学P1', '数学P2', '数学M1']) {
          const parsed = parseScoreCell(r[k]);
          if (parsed) obj.ial.Mathematics[k.replace('数学', '')] = parsed;
        }
        for (const k of ['数学P3', '数学P4']) {
          const parsed = parseScoreCell(r[k]);
          if (parsed) obj.ial.FurtherMathematics[k.replace('数学', '')] = parsed;
        }
        const phy = parseScoreCell(r['物理U1']);
        if (phy) obj.ial.Physics['U1'] = phy;
        const chem = parseScoreCell(r['化学U1']);
        if (chem) obj.ial.Chemistry['U1'] = chem;
        const bio = parseScoreCell(r['生物U1']);
        if (bio) obj.ial.Biology['U1'] = bio;
        const econ = parseScoreCell(r['经济U1']);
        if (econ) obj.ial.Economics['U1'] = econ;
      }
    }
  }

  return Array.from(byName.values());
}

function run() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ database.sqlite not found:', DB_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(MD_PATH)) {
    console.error('❌ markdown not found:', MD_PATH);
    process.exit(1);
  }

  const md = fs.readFileSync(MD_PATH, 'utf8');
  const data = parseMarkdownTables(md);

  const bak = backupSqlite();
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const tx = db.transaction(() => {
    // 1) 把理科课程单元 max_score 改为 UMS 满分（120/60），以匹配表格里的 /120
    const scienceCourses = ['Physics', 'Chemistry', 'Biology'];
    const courseIdByName = new Map(
      db.prepare('SELECT id,name FROM courses WHERE grade_level=?').all(TARGET_GRADE).map(r => [r.name, r.id])
    );
    const updUnit = db.prepare('UPDATE course_units SET max_score=? WHERE course_id=? AND unit_code=?');
    for (const cn of scienceCourses) {
      const cid = courseIdByName.get(cn);
      if (!cid) continue;
      for (const u of ['U1', 'U2', 'U4', 'U5']) updUnit.run(120, cid, u);
      for (const u of ['U3', 'U6']) updUnit.run(60, cid, u);
    }

    // 2) 选课记录必须存在（前一步已批量选课，但这里仍做 ensure）
    const findStudent = db.prepare('SELECT id FROM students WHERE grade=? AND name=? LIMIT 1');
    const findCourse = db.prepare('SELECT id FROM courses WHERE grade_level=? AND name=? LIMIT 1');
    const findEnrollment = db.prepare('SELECT id FROM student_courses WHERE student_id=? AND course_id=? LIMIT 1');
    const insertEnrollment = db.prepare(
      `INSERT INTO student_courses
       (id, student_id, course_id, internal_grade, internal_score, mock_grade, mock_score, final_grade, final_score,
        status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const ensureEnrollment = (studentId, courseName) => {
      const c = findCourse.get(TARGET_GRADE, courseName);
      if (!c?.id) throw new Error(`Missing course: ${courseName} (${TARGET_GRADE})`);
      const ex = findEnrollment.get(studentId, c.id);
      if (ex?.id) return ex.id;
      const id = randomUUID();
      insertEnrollment.run(id, studentId, c.id, '', null, '', null, '', null, 'enrolled', NOW, NOW);
      return id;
    };

    // 3) unit_grades 去重插入
    const hasUnitGrade = db.prepare(
      `SELECT id FROM unit_grades
       WHERE student_course_id=?
         AND unit_code=?
         AND exam_type=?
         AND score=?
         AND max_score=?
       LIMIT 1`
    );
    const insertUnitGrade = db.prepare(
      `INSERT INTO unit_grades
       (id, student_course_id, unit_name, unit_code, score, max_score, grade, exam_date, exam_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const addUnit = (studentCourseId, { unit_code, unit_name, score, max_score, grade, exam_date, exam_type }) => {
      if (hasUnitGrade.get(studentCourseId, unit_code, exam_type, score, max_score)?.id) return false;
      insertUnitGrade.run(
        randomUUID(),
        studentCourseId,
        unit_name || unit_code,
        unit_code,
        score,
        max_score,
        grade || '',
        exam_date || null,
        exam_type,
        NOW
      );
      return true;
    };

    let created = 0;
    let skipped = 0;
    let missingStudents = 0;

    for (const s of data) {
      const stu = findStudent.get(TARGET_GRADE, s.name);
      if (!stu?.id) {
        missingStudents += 1;
        continue;
      }

      // === 校内成绩 ===
      const internalMap = [
        { course: 'Mathematics', src: s.internal.Mathematics },
        { course: 'Physics', src: s.internal.Physics },
        { course: 'Chemistry', src: s.internal.Chemistry },
        { course: 'Biology', src: s.internal.Biology },
        { course: 'Economics', src: s.internal.Economics },
      ];
      for (const { course, src } of internalMap) {
        if (src.mid === null && src.final === null) continue;
        const scId = ensureEnrollment(stu.id, course);
        if (src.mid !== null) {
          const ok = addUnit(scId, {
            unit_code: 'INT-Mid',
            unit_name: '校内期中',
            score: Math.round(src.mid * 10),
            max_score: 1000,
            grade: '',
            exam_date: INTERNAL_MID_DATE,
            exam_type: 'internal',
          });
          ok ? (created += 1) : (skipped += 1);
        }
        if (src.final !== null) {
          const ok = addUnit(scId, {
            unit_code: 'INT-Final',
            unit_name: '校内期末',
            score: Math.round(src.final * 10),
            max_score: 1000,
            grade: '',
            exam_date: INTERNAL_FINAL_DATE,
            exam_type: 'internal',
          });
          ok ? (created += 1) : (skipped += 1);
        }
      }

      // === IAL 实考（目前表里仅给出：数学 P1-P4/M1 与各科 U1）===
      const ialMap = [
        { course: 'Mathematics', units: s.ial.Mathematics },
        { course: 'Further Mathematics', units: s.ial.FurtherMathematics },
        { course: 'Physics', units: s.ial.Physics },
        { course: 'Chemistry', units: s.ial.Chemistry },
        { course: 'Biology', units: s.ial.Biology },
        { course: 'Economics', units: s.ial.Economics },
      ];
      for (const { course, units } of ialMap) {
        const keys = Object.keys(units || {});
        if (keys.length === 0) continue;
        const scId = ensureEnrollment(stu.id, course);
        for (const unitCode of keys) {
          const u = units[unitCode];
          if (!u) continue;
          const ok = addUnit(scId, {
            unit_code: unitCode,
            unit_name: unitCode,
            score: u.score,
            max_score: u.max_score,
            grade: u.grade,
            exam_date: IAL_EXAM_DATE,
            exam_type: 'final',
          });
          ok ? (created += 1) : (skipped += 1);
        }
      }
    }

    return { created, skipped, missingStudents, parsedStudents: data.length };
  });

  try {
    const r = tx();
    console.log('✅ 成绩导入完成');
    console.log(`- 解析到学生: ${r.parsedStudents}`);
    console.log(`- 新增 unit_grades: ${r.created}`);
    console.log(`- 跳过重复: ${r.skipped}`);
    console.log(`- 未匹配到库中学生(grade=2025级): ${r.missingStudents}`);
    console.log(`- 数据库备份: ${bak}`);
  } catch (e) {
    console.error('❌ 成绩导入失败（已回滚事务）:', e?.message || e);
    console.error('可用备份恢复:', bak);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

run();

