/**
 * 从 `院系申请信息.md` 导入「院校库」并替换现有内容，同时完善 2025级学生的目标院校关联。
 *
 * 安全策略（响应“禁止可能导致文件损坏的操作”）：
 * - 导入前先做 SQLite 文件备份（拷贝为 .bak-时间戳）
 * - 所有写操作放在单个事务中，失败则自动回滚
 * - 替换逻辑尽量保留同名院校的 id（避免学生关联断裂）
 *
 * 数据落库策略：
 * - `target_universities`：按“院校名称”去重，写入国家、一个代表性专业、A-Level/语言要求、备注等
 * - `university_programs`：每条推荐方案写入一个 program（对应专业与要求）
 * - `student_universities`：按学生段落的 推荐方案一/二/三 写入 reach/target/safety
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');
const MD_PATH = path.join(ROOT, '院系申请信息.md');

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

function normName(s) {
  return (s || '').trim().replace(/\s+/g, ' ');
}

function parseCountryToken(raw) {
  const t = (raw || '').trim();
  if (!t) return '';
  // 标题括号里可能是：英国 / MIT，美国 / ETH Zurich，瑞士 / 香港科技大学（HKUST）
  const last = t.split(/[，,]/).map(x => x.trim()).filter(Boolean).slice(-1)[0] || t;
  if (/英国|UK/i.test(last)) return 'UK';
  if (/美国|US|USA/i.test(last)) return 'US';
  if (/澳洲|澳大利亚|Australia/i.test(last)) return 'Australia';
  if (/香港|Hong Kong/i.test(last)) return 'Hong Kong';
  if (/新加坡|Singapore/i.test(last)) return 'Singapore';
  if (/加拿大|Canada/i.test(last)) return 'Canada';
  if (/瑞士|Switzerland/i.test(last)) return 'Other';
  return last; // 兜底：保留原文
}

function extractAfterColon(line) {
  const m = line.match(/[:：]\s*(.+)\s*$/);
  return m ? m[1].trim() : '';
}

function parseMarkdown(md) {
  const lines = md
    .split(/\r?\n/)
    // 兼容 `院系申请信息.md` 里对 Markdown 语法的转义写法（如：\###、\##、\*\*）
    // 例：`\*\*专业\*\*：...` => `**专业**：...`
    // 同时兼容转义的列表项（如：`\- A-Level: ...`）
    .map((l) => l.replace(/\\([#*\-])/g, '$1'));

  // 解析学生表（用于后续匹配 student section）
  const studentNames = new Set();
  const studentBaseInfo = new Map(); // name -> {regions, majorPriority, majorBackup, courseCombo, languageReq}
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes('学生姓名') && lines[i].includes('申请国家/地区')) {
      // 表头后面至少两行（分隔线），然后是数据行，直到空行
      for (let j = i + 2; j < lines.length; j += 1) {
        const row = lines[j].trim();
        if (!row) continue; // 表格在该文件中每行之间可能有空行
        if (!row.startsWith('|')) break;
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        const name = cells[0];
        if (name && name !== '学生姓名') {
          // 跳过分隔线行（如：|---------|-----...）
          if (/^-+$/.test(name)) continue;
          studentNames.add(name);
          studentBaseInfo.set(name, {
            regions: cells[1] || '',
            majorPriority: cells[2] || '',
            majorBackup: cells[3] || '',
            courseCombo: cells[4] || '',
            languageReq: cells[5] || '',
          });
        }
      }
      break;
    }
  }

  const recs = [];
  let currentStudent = null;
  let currentRec = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // 学生段落标题：## 1. 马逸轩（...）
    const sm = line.match(/^##\s+\d+\.\s+([^\（(]+?)\s*[\（(]/);
    if (sm) {
      const name = sm[1].trim();
      currentStudent = studentNames.has(name) ? name : name; // 即使不在表里也保留
      continue;
    }

    // 推荐方案标题：### 🎯 推荐方案一：帝国理工学院（英国）
    const rm = line.match(/^###\s+🎯\s+推荐方案([一二三四五六七八九十])：(.+?)(?:\s*[\（(](.+?)[\）)])?\s*$/);
    if (rm) {
      if (currentRec) recs.push(currentRec);
      const schemeCn = rm[1];
      const uniName = normName(rm[2]);
      const countryRaw = rm[3] || '';
      currentRec = {
        studentName: currentStudent,
        schemeCn,
        universityName: uniName,
        country: parseCountryToken(countryRaw),
        programName: '',
        aLevelRequirement: '',
        languageRequirement: '',
        subjectRequirements: '',
        applicationDeadline: null,
        notes: '',
      };
      continue;
    }

    if (!currentRec) continue;

    // 专业行：**专业**：...
    if (/\*\*专业\*\*/.test(line) && line.includes('：')) {
      const v = line.replace(/\\\*/g, '*'); // 兼容转义
      currentRec.programName = extractAfterColon(v);
      continue;
    }

    // 入学要求块内的要点：- A-Level: ... / - 雅思：... / - 托福...
    if (/^\- /.test(line)) {
      const bullet = line.replace(/^\-\s*/, '').trim();
      if (/^A-?Level/i.test(bullet)) {
        currentRec.aLevelRequirement = extractAfterColon(bullet);
      } else if (/雅思|IELTS|托福|TOEFL|PTE|Duolingo/i.test(bullet)) {
        // 语言要求可能写成 “雅思：总分6.5...” 或 “托福110+或雅思7.5+”
        currentRec.languageRequirement = extractAfterColon(bullet) || bullet;
      } else if (/必须包含|必修|需包含|数学必须|需提交/i.test(bullet)) {
        currentRec.subjectRequirements = (currentRec.subjectRequirements ? `${currentRec.subjectRequirements}；` : '') + bullet;
      } else if (/截止|deadline/i.test(bullet)) {
        const val = extractAfterColon(bullet);
        currentRec.applicationDeadline = val || null;
      }
      continue;
    }

    // 优势/说明：把“优势”段落合并为 notes
    if (line.includes('**优势**')) {
      // 取本行后面的文本 + 之后连续的非空行（直到遇到下一个标题或分隔线）
      const start = extractAfterColon(line.replace(/\\\*/g, '*'));
      const chunks = [];
      if (start) chunks.push(start);
      for (let j = i + 1; j < lines.length; j += 1) {
        const l = lines[j].trim();
        if (!l) break;
        if (/^(###|##|\-\-\-)/.test(l)) break;
        chunks.push(l);
      }
      currentRec.notes = chunks.join(' ');
      continue;
    }
  }
  if (currentRec) recs.push(currentRec);

  // 生成院校聚合
  const universities = new Map(); // name -> {name,country,course_name,...,programs:[]}
  for (const r of recs) {
    if (!r.universityName) continue;
    const key = r.universityName.toLowerCase();
    if (!universities.has(key)) {
      universities.set(key, {
        name: r.universityName,
        country: r.country || '',
        ranking: null,
        course_name: r.programName || '',
        a_level_requirement: r.aLevelRequirement || '',
        language_requirement: r.languageRequirement || '',
        subject_requirements: r.subjectRequirements || '',
        application_deadline: null,
        notes: r.notes || '',
        programs: [],
      });
    }
    const u = universities.get(key);
    // 若后续记录补充了 country/代表性要求，则填充
    if (!u.country && r.country) u.country = r.country;
    if (!u.course_name && r.programName) u.course_name = r.programName;
    if (!u.a_level_requirement && r.aLevelRequirement) u.a_level_requirement = r.aLevelRequirement;
    if (!u.language_requirement && r.languageRequirement) u.language_requirement = r.languageRequirement;
    if (!u.notes && r.notes) u.notes = r.notes;

    u.programs.push({
      program_name: r.programName || '',
      department: '',
      a_level_requirement: r.aLevelRequirement || '',
      language_requirement: r.languageRequirement || '',
      subject_requirements: r.subjectRequirements || '',
      application_deadline: r.applicationDeadline || null,
      tuition_fee: '',
      duration: '',
      notes: r.notes || '',
      _studentName: r.studentName,
      _schemeCn: r.schemeCn,
    });
  }

  // 二次整理：尽可能用同院校的其他方案补齐缺失字段
  for (const u of universities.values()) {
    const firstNonEmpty = (arr, key) => arr.map(x => (x[key] || '').trim()).find(v => v) || '';
    const uniAL = (u.a_level_requirement || '').trim() || firstNonEmpty(u.programs, 'a_level_requirement');
    const uniLang = (u.language_requirement || '').trim() || firstNonEmpty(u.programs, 'language_requirement');
    if (!u.a_level_requirement) u.a_level_requirement = uniAL;
    if (!u.language_requirement) u.language_requirement = uniLang;
    // 回填到 program
    for (const p of u.programs) {
      if (!p.a_level_requirement) p.a_level_requirement = uniAL;
      if (!p.language_requirement) p.language_requirement = uniLang;
    }
  }

  // 学生推荐院校映射（用于 student_universities）
  const studentTargets = new Map(); // studentName -> [{universityName, application_type}]
  const schemeMap = { '一': 'reach', '二': 'target', '三': 'safety' };
  for (const r of recs) {
    if (!r.studentName || !r.universityName) continue;
    const t = schemeMap[r.schemeCn] || 'target';
    if (!studentTargets.has(r.studentName)) studentTargets.set(r.studentName, []);
    studentTargets.get(r.studentName).push({ universityName: r.universityName, application_type: t });
  }

  return { universities: Array.from(universities.values()), studentTargets, studentBaseInfo };
}

function run() {
  if (!fs.existsSync(MD_PATH)) {
    console.error('❌ 找不到 Markdown 文件:', MD_PATH);
    process.exit(1);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error('❌ 找不到 SQLite 数据库:', DB_PATH);
    process.exit(1);
  }

  const md = fs.readFileSync(MD_PATH, 'utf8');
  const { universities, studentTargets, studentBaseInfo } = parseMarkdown(md);
  console.log(`解析完成：院校 ${universities.length} 所；学生 ${studentTargets.size} 人`);

  const bak = backupSqlite();
  console.log('已备份数据库到:', bak);

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const tx = db.transaction(() => {
    // 读取现有院校
    const existing = db.prepare('SELECT * FROM target_universities').all();
    const existingByName = new Map(existing.map(u => [u.name.toLowerCase(), u]));

    const incomingNames = new Set(universities.map(u => u.name.toLowerCase()));

    // 1) Upsert 院校（同名保留 id）
    const upserted = new Map(); // nameLower -> id
    for (const u of universities) {
      const key = u.name.toLowerCase();
      const ex = existingByName.get(key);
      if (ex) {
        db.prepare(
          `UPDATE target_universities
           SET country = ?, ranking = ?, course_name = ?, a_level_requirement = ?,
               language_requirement = ?, subject_requirements = ?, application_deadline = ?,
               notes = ?
           WHERE id = ?`
        ).run(
          u.country || ex.country || '',
          u.ranking ?? ex.ranking ?? null,
          u.course_name || '',
          u.a_level_requirement || '',
          u.language_requirement || '',
          u.subject_requirements || '',
          u.application_deadline || null,
          u.notes || '',
          ex.id
        );
        upserted.set(key, ex.id);
      } else {
        const id = randomUUID();
        db.prepare(
          `INSERT INTO target_universities
           (id, name, country, ranking, course_name, a_level_requirement, language_requirement,
            subject_requirements, application_deadline, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          u.name,
          u.country || '',
          u.ranking ?? null,
          u.course_name || '',
          u.a_level_requirement || '',
          u.language_requirement || '',
          u.subject_requirements || '',
          u.application_deadline || null,
          u.notes || '',
          NOW
        );
        upserted.set(key, id);
      }
    }

    // 2) 替换 programs：先清空这些院校下的旧 programs，再写入新 programs
    const deletePrograms = db.prepare('DELETE FROM university_programs WHERE university_id = ?');
    const insertProgram = db.prepare(
      `INSERT INTO university_programs
       (id, university_id, program_name, department, a_level_requirement, language_requirement,
        subject_requirements, application_deadline, tuition_fee, duration, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const u of universities) {
      const uniId = upserted.get(u.name.toLowerCase());
      deletePrograms.run(uniId);
      for (const p of u.programs) {
        if (!p.program_name) continue;
        insertProgram.run(
          randomUUID(),
          uniId,
          p.program_name,
          p.department || '',
          p.a_level_requirement || '',
          p.language_requirement || '',
          p.subject_requirements || '',
          p.application_deadline || null,
          p.tuition_fee || '',
          p.duration || '',
          p.notes || '',
          NOW
        );
      }
    }

    // 3) 删除不在新名单的院校（连同学生关联与 programs 一并清理）
    const toRemove = existing.filter(u => !incomingNames.has(u.name.toLowerCase()));
    const delStudentUnisByUni = db.prepare('DELETE FROM student_universities WHERE university_id = ?');
    const delProgramsByUni = db.prepare('DELETE FROM university_programs WHERE university_id = ?');
    const delUni = db.prepare('DELETE FROM target_universities WHERE id = ?');
    for (const u of toRemove) {
      delStudentUnisByUni.run(u.id);
      delProgramsByUni.run(u.id);
      delUni.run(u.id);
    }

    // 4) 完善 2025级学生目标院校：按学生姓名匹配，先清空再写入（仅影响 2025级）
    const findStudent = db.prepare('SELECT id FROM students WHERE name = ? AND grade = ? LIMIT 1');
    const delStudentUnis = db.prepare('DELETE FROM student_universities WHERE student_id = ?');
    const insertStudentUni = db.prepare(
      `INSERT INTO student_universities
       (id, student_id, university_id, application_type, status, personal_statement_status,
        reference_status, submitted_at, decision_date, conditions, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const [studentName, targets] of studentTargets.entries()) {
      const stu = findStudent.get(studentName, GRADE);
      if (!stu?.id) continue;
      delStudentUnis.run(stu.id);
      for (const t of targets) {
        const uniId = upserted.get(t.universityName.toLowerCase());
        if (!uniId) continue;
        insertStudentUni.run(
          randomUUID(),
          stu.id,
          uniId,
          t.application_type || 'target',
          'interested',
          '',
          '',
          null,
          null,
          '',
          '',
          NOW,
          NOW
        );
      }
    }

    // 5) 写入学生规划信息到 tasks（申请类），便于在学生详情页直接查看
    const findExistingPlanTask = db.prepare(
      'SELECT id FROM tasks WHERE student_id = ? AND title = ? LIMIT 1'
    );
    const deleteTask = db.prepare('DELETE FROM tasks WHERE id = ?');
    const insertTask = db.prepare(
      `INSERT INTO tasks
       (id, student_id, title, description, category, priority, deadline, status, assigned_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const [studentName, info] of studentBaseInfo.entries()) {
      const stu = findStudent.get(studentName, GRADE);
      if (!stu?.id) continue;

      const title = '申请规划信息（自动导入）';
      const desc = [
        `申请国家/地区：${info.regions || ''}`,
        `优先专业：${info.majorPriority || ''}`,
        `保底专业：${info.majorBackup || ''}`,
        `课程组合要求：${info.courseCombo || ''}`,
        `语言要求：${info.languageReq || ''}`,
      ].join('\n');

      const existingTask = findExistingPlanTask.get(stu.id, title);
      if (existingTask?.id) deleteTask.run(existingTask.id);

      insertTask.run(
        randomUUID(),
        stu.id,
        title,
        desc,
        'application',
        'medium',
        null,
        'pending',
        null,
        NOW,
        NOW
      );
    }

    return {
      universitiesImported: universities.length,
      existingBefore: existing.length,
      removed: toRemove.length,
      studentsUpdated: studentTargets.size,
    };
  });

  try {
    const r = tx();
    console.log('✅ 导入完成');
    console.log(`- 院校导入/更新: ${r.universitiesImported}`);
    console.log(`- 原院校数量: ${r.existingBefore}，已移除: ${r.removed}`);
    console.log(`- 学生目标院校已写入（按解析到的学生数）: ${r.studentsUpdated}`);
    console.log('如需回滚，请用备份文件覆盖 database.sqlite:', bak);
  } catch (e) {
    console.error('❌ 导入失败，已回滚事务。错误:', e?.message || e);
    console.error('数据库备份在此（可手工恢复）:', bak);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

run();

