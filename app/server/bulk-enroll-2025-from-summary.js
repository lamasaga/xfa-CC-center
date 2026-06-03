/**
 * 根据「启赋一班学生成绩与申请信息汇总.md」自动为 2025级学生批量选课。
 *
 * 规则：
 * - 仅对 grade=2025级 的学生处理（按姓名匹配）
 * - 不包含英语课（用户要求）
 * - 课程范围（必须已存在于 courses 表，grade_level=2025级）：
 *   - Mathematics
 *   - Further Mathematics
 *   - Physics
 *   - Chemistry
 *   - Biology
 *   - Economics
 * - 判断学生是否“需要选入某课程”的依据：
 *   - 校内成绩表对应科目任一分数非空，或
 *   - A-Level IAL 单元成绩表对应单元非空
 * - 去重：已选课的不重复插入
 *
 * 安全：
 * - 写入前备份 database.sqlite
 * - 单事务执行，失败回滚
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

function parseMarkdownTables(md) {
  const lines = md.split(/\r?\n/);

  // 解析 markdown 表格：给定表头行，读取直到非表格行
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
      for (let c = 0; c < headers.length; c += 1) {
        row[headers[c]] = cells[c] ?? '';
      }
      rows.push(row);
    }
    return { headers, rows };
  }

  // 定位三个校内成绩表 + IAL 单元表
  const tables = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith('| 姓名 |')) {
      const t = readTable(i);
      if (t) tables.push(t);
    }
  }

  // 合并每位学生的“是否涉及科目”
  const byName = new Map();
  const ensure = (name) => {
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        has: {
          Mathematics: false,
          FurtherMathematics: false,
          Physics: false,
          Chemistry: false,
          Biology: false,
          Economics: false,
        },
      });
    }
    return byName.get(name);
  };

  // 根据表头判断表类型并提取
  for (const t of tables) {
    const h = t.headers.join('|');

    // 校内成绩表1：数学/物理/化学
    const isSchool1 = h.includes('数学期中') || h.includes('物理期中') || h.includes('化学期中');
    // 校内成绩表2：英语/经济/AI/IT（英语忽略）
    const isSchool2 = h.includes('AI期中') || h.includes('IT期中') || h.includes('经济期中');
    // 校内成绩表3：生物/心理（心理不建课）
    const isSchool3 = h.includes('生物期中') || h.includes('心理期中');
    // IAL 单元表：数学P1..M1、物理U1、化学U1、生物U1、经济U1
    const isIAL = h.includes('数学P1') || h.includes('物理U1') || h.includes('经济U1');

    for (const r of t.rows) {
      const name = String(r['姓名'] || '').trim();
      if (!name) continue;
      const obj = ensure(name);

      if (isSchool1) {
        if (!isEmptyCell(r['数学期中']) || !isEmptyCell(r['数学期末'])) obj.has.Mathematics = true;
        if (!isEmptyCell(r['物理期中']) || !isEmptyCell(r['物理期末'])) obj.has.Physics = true;
        if (!isEmptyCell(r['化学期中']) || !isEmptyCell(r['化学期末'])) obj.has.Chemistry = true;
      }
      if (isSchool2) {
        if (!isEmptyCell(r['经济期中']) || !isEmptyCell(r['经济期末'])) obj.has.Economics = true;
      }
      if (isSchool3) {
        if (!isEmptyCell(r['生物期中']) || !isEmptyCell(r['生物期末'])) obj.has.Biology = true;
      }
      if (isIAL) {
        // 数学：任一 P1/P2/S1/M1 => Mathematics
        const mathUnits = ['数学P1', '数学P2', '数学M1'];
        const hasMath = mathUnits.some(k => !isEmptyCell(r[k]));
        // P3/P4 单元存在即认为需要 Further Mathematics（你要求进阶数学包含P3/P4等）
        const fmUnits = ['数学P3', '数学P4'];
        const hasFM = fmUnits.some(k => !isEmptyCell(r[k]));
        if (hasMath) obj.has.Mathematics = true;
        if (hasFM) obj.has.FurtherMathematics = true;

        if (!isEmptyCell(r['物理U1'])) obj.has.Physics = true;
        if (!isEmptyCell(r['化学U1'])) obj.has.Chemistry = true;
        if (!isEmptyCell(r['生物U1'])) obj.has.Biology = true;
        if (!isEmptyCell(r['经济U1'])) obj.has.Economics = true;
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
    console.error('❌ summary markdown not found:', MD_PATH);
    process.exit(1);
  }

  const md = fs.readFileSync(MD_PATH, 'utf8');
  const needs = parseMarkdownTables(md);

  const bak = backupSqlite();
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const tx = db.transaction(() => {
    // 课程ID映射：按名称 + 年级
    const courseRows = db.prepare('SELECT id, name FROM courses WHERE grade_level = ?').all(TARGET_GRADE);
    const courseIdByName = new Map(courseRows.map(c => [c.name, c.id]));
    const requiredCourseNames = ['Mathematics', 'Further Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics'];
    for (const n of requiredCourseNames) {
      if (!courseIdByName.has(n)) throw new Error(`Missing course for ${TARGET_GRADE}: ${n}`);
    }

    const findStudent = db.prepare('SELECT id FROM students WHERE grade = ? AND name = ? LIMIT 1');
    const findEnrollment = db.prepare('SELECT id FROM student_courses WHERE student_id = ? AND course_id = ? LIMIT 1');
    const insertEnrollment = db.prepare(
      `INSERT INTO student_courses
       (id, student_id, course_id, internal_grade, internal_score, mock_grade, mock_score, final_grade, final_score,
        status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    let created = 0;
    let skipped = 0;
    let missingStudents = 0;

    for (const s of needs) {
      const stu = findStudent.get(TARGET_GRADE, s.name);
      if (!stu?.id) {
        missingStudents += 1;
        continue;
      }

      const add = (courseName) => {
        const courseId = courseIdByName.get(courseName);
        if (!courseId) return;
        const ex = findEnrollment.get(stu.id, courseId);
        if (ex?.id) {
          skipped += 1;
          return;
        }
        insertEnrollment.run(
          randomUUID(),
          stu.id,
          courseId,
          '',
          null,
          '',
          null,
          '',
          null,
          'enrolled',
          NOW,
          NOW
        );
        created += 1;
      };

      if (s.has.Mathematics) add('Mathematics');
      if (s.has.FurtherMathematics) add('Further Mathematics');
      if (s.has.Physics) add('Physics');
      if (s.has.Chemistry) add('Chemistry');
      if (s.has.Biology) add('Biology');
      if (s.has.Economics) add('Economics');
    }

    return { created, skipped, missingStudents, parsedStudents: needs.length };
  });

  try {
    const r = tx();
    console.log('✅ 批量选课完成');
    console.log(`- 解析到学生: ${r.parsedStudents}`);
    console.log(`- 新增选课: ${r.created}`);
    console.log(`- 跳过已存在: ${r.skipped}`);
    console.log(`- 未匹配到库中学生(grade=2025级): ${r.missingStudents}`);
    console.log(`- 数据库备份: ${bak}`);
  } catch (e) {
    console.error('❌ 批量选课失败（已回滚事务）:', e?.message || e);
    console.error('可用备份恢复:', bak);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

run();

