const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// SQLite 数据库文件路径
const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');

// 创建数据库连接
let db;
try {
  db = new Database(DB_PATH);
  console.log('Connected to SQLite database:', DB_PATH);
} catch (error) {
  console.error('SQLite connection error:', error);
  throw error;
}

// 启用外键约束
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 查询辅助函数 - 保持与原来相同的接口
const dbQuery = {
  query: (text, params = []) => {
    // 将 PostgreSQL 的 $1, $2 转换为 SQLite 的 ?, ?
    const sqliteQuery = text.replace(/\$(\d+)/g, '?');
    return db.prepare(sqliteQuery).all(...params);
  },
  run: (text, params = []) => {
    const sqliteQuery = text.replace(/\$(\d+)/g, '?');
    return db.prepare(sqliteQuery).run(...params);
  },
  get: (text, params = []) => {
    const sqliteQuery = text.replace(/\$(\d+)/g, '?');
    return db.prepare(sqliteQuery).get(...params);
  }
};

// 与原来 LowDB/PostgreSQL 兼容的异步接口
const dbAsync = {
  // 创建记录
  create: async (table, data) => {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => '?').join(', ');
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
    `;
    
    const result = db.prepare(query).run(...values);
    
    // 返回插入的记录
    const inserted = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(data.id || result.lastInsertRowid);
    return inserted;
  },

  // 查询所有
  findAll: async (table, filter = {}) => {
    let query = `SELECT * FROM ${table}`;
    const values = [];
    
    const conditions = Object.entries(filter);
    if (conditions.length > 0) {
      const whereClause = conditions
        .map(([key]) => {
          values.push(filter[key]);
          return `${key} = ?`;
        })
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
    }
    
    return db.prepare(query).all(...values);
  },

  // 查询单个
  findOne: async (table, filter = {}) => {
    const results = await dbAsync.findAll(table, filter);
    return results[0] || null;
  },

  // 根据ID查询
  findById: async (table, id) => {
    const query = `SELECT * FROM ${table} WHERE id = ?`;
    return db.prepare(query).get(id) || null;
  },

  // 更新
  update: async (table, id, data) => {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;
    
    const setClause = entries
      .map(([key]) => `${key} = ?`)
      .join(', ');
    
    const values = [...entries.map(([, value]) => value), id];
    
    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE id = ?
    `;
    
    db.prepare(query).run(...values);
    return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) || null;
  },

  // 删除
  delete: async (table, id) => {
    const query = `DELETE FROM ${table} WHERE id = ?`;
    const result = db.prepare(query).run(id);
    return result.changes > 0;
  },

  // 获取原始数据对象（用于复杂查询）
  getData: async () => {
    // 为了保持兼容性，返回一个对象包含所有表的数据
    const tables = [
      'users', 'students', 'courses', 'student_courses', 'unit_grades',
      'target_universities', 'student_universities', 'language_scores',
      'standardized_tests', 'extracurriculars', 'tasks', 'exam_schedule'
    ];
    
    const data = {};
    for (const table of tables) {
      try {
        data[table] = db.prepare(`SELECT * FROM ${table}`).all();
      } catch (e) {
        data[table] = []; // 表不存在时返回空数组
      }
    }
    return data;
  },

  // 执行自定义查询
  query: async (text, params = []) => {
    const sqliteQuery = text.replace(/\$(\d+)/g, '?');
    return db.prepare(sqliteQuery).all(...params);
  }
};

// 获取原始数据库实例（用于直接操作）
const getDb = () => db;

/**
 * 将旧版 users（admin/editor/viewer）迁移为 admin/staff/student，并增加 student_id。
 * SQLite 无法直接修改 CHECK，需重建表。
 */
function migrateUsersRbac(dbInstance) {
  const cols = dbInstance.prepare('PRAGMA table_info(users)').all();
  let hasStudentIdCol = cols.some((c) => c.name === 'student_id');
  if (!hasStudentIdCol) {
    dbInstance.exec('ALTER TABLE users ADD COLUMN student_id TEXT');
    hasStudentIdCol = true;
    console.log('✓ Migrated: added users.student_id');
  }

  const meta = dbInstance
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  const sql = meta && meta.sql ? String(meta.sql) : '';
  const alreadyNew =
    sql.includes("'admin', 'staff', 'student'") ||
    sql.includes("'admin','staff','student'") ||
    sql.includes("'supervisor'");
  if (alreadyNew) {
    return;
  }

  if (!sql.includes('editor') && !sql.includes('viewer')) {
    return;
  }

  const studentIdSelect = hasStudentIdCol ? 'u.student_id' : 'NULL';

  console.log('Migrating users table to RBAC roles (admin/staff/student)...');
  // 关闭外键检查：students.advisor_id 引用 users，否则无法 DROP users；student_id 不在 DB 层做 FK（与 init-db 一致）
  dbInstance.pragma('foreign_keys = OFF');
  try {
    dbInstance.exec(`
      BEGIN;
      CREATE TABLE users__rbac_new (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'supervisor', 'student')),
        student_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users__rbac_new (id, username, password, name, email, role, student_id, created_at, updated_at)
      SELECT
        u.id,
        u.username,
        u.password,
        u.name,
        u.email,
        CASE u.role
          WHEN 'admin' THEN 'admin'
          WHEN 'student' THEN 'student'
          WHEN 'editor' THEN 'staff'
          WHEN 'viewer' THEN 'staff'
          ELSE 'staff'
        END,
        ${studentIdSelect},
        u.created_at,
        u.updated_at
      FROM users u;
      DROP TABLE users;
      ALTER TABLE users__rbac_new RENAME TO users;
      COMMIT;
    `);
    console.log('✓ users table migrated to RBAC roles');
  } finally {
    dbInstance.pragma('foreign_keys = ON');
  }
}

/**
 * 在 users.role CHECK 中加入 supervisor（指导老师），与 init-db 新库一致。
 */
function migrateUsersSupervisorRole(dbInstance) {
  const meta = dbInstance
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  const sql = meta && meta.sql ? String(meta.sql) : '';
  if (sql.includes("'supervisor'") || sql.includes("'supervisor',")) {
    return;
  }

  console.log('Migrating users table to add supervisor role...');
  dbInstance.pragma('foreign_keys = OFF');
  try {
    dbInstance.exec(`
      BEGIN;
      CREATE TABLE users__sup_new (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'supervisor', 'student')),
        student_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users__sup_new (id, username, password, name, email, role, student_id, created_at, updated_at)
      SELECT id, username, password, name, email, role, student_id, created_at, updated_at FROM users;
      DROP TABLE users;
      ALTER TABLE users__sup_new RENAME TO users;
      COMMIT;
    `);
    console.log('✓ users table: supervisor role supported');
  } finally {
    dbInstance.pragma('foreign_keys = ON');
  }
}

function migrateUsersTeacherRole(dbInstance) {
  const meta = dbInstance
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  const sql = meta && meta.sql ? String(meta.sql) : '';
  if (sql.includes("'teacher'")) {
    return;
  }

  console.log('Migrating users table to add teacher role...');
  dbInstance.pragma('foreign_keys = OFF');
  try {
    dbInstance.exec(`
      BEGIN;
      CREATE TABLE users__teacher_new (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'supervisor', 'teacher', 'student')),
        student_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users__teacher_new (id, username, password, name, email, role, student_id, created_at, updated_at)
      SELECT id, username, password, name, email, role, student_id, created_at, updated_at FROM users;
      DROP TABLE users;
      ALTER TABLE users__teacher_new RENAME TO users;
      COMMIT;
    `);
    console.log('✓ users table: teacher role supported');
  } finally {
    dbInstance.pragma('foreign_keys = ON');
  }
}

// 初始化数据库
async function initDb() {
  try {
    // 测试连接
    const result = db.prepare('SELECT sqlite_version() as version').get();
    console.log('SQLite version:', result.version);
    console.log('Database path:', DB_PATH);

    // ---- auto-create tables on first run ----
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();
    if (tables.length === 0) {
      console.log('First run detected – creating schema...');
      const initDbPath = path.join(__dirname, 'init-db.js');
      const initSrc = fs.readFileSync(initDbPath, 'utf8');
      const sqlMatch = initSrc.match(/const initSQL = `([\s\S]*?)`;/);
      if (sqlMatch) {
        db.exec(sqlMatch[1]);
        console.log('✓ Schema created');
      }

      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');
      const seedUsers = [
        {
          username: 'admin',
          password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
          name: '管理员',
          role: 'admin',
        },
        {
          username: 'staff',
          password: process.env.SEED_STAFF_PASSWORD || 'staff123',
          name: '教务',
          role: 'staff',
        },
        {
          username: 'supervisor',
          password: process.env.SEED_SUPERVISOR_PASSWORD || 'supervisor123',
          name: '指导老师',
          role: 'supervisor',
        },
        {
          username: 'teacher',
          password: process.env.SEED_TEACHER_PASSWORD || 'teacher123',
          name: '任课教师',
          role: 'teacher',
        },
      ];
      const insert = db.prepare(
        'INSERT OR IGNORE INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)'
      );
      for (const u of seedUsers) {
        insert.run(uuidv4(), u.username, bcrypt.hashSync(u.password, 10), u.name, u.role);
      }
      console.log('✓ Default users seeded');
    }

    // ---- lightweight migrations (non-destructive) ----
    // Ensure course_units.allowed_months exists (used by exam session planner restrictions)
    try {
      const cols = db.prepare("PRAGMA table_info(course_units)").all();
      const hasAllowedMonths = cols.some(c => c.name === 'allowed_months');
      if (!hasAllowedMonths) {
        db.exec('ALTER TABLE course_units ADD COLUMN allowed_months TEXT');
        console.log('✓ Migrated: added course_units.allowed_months');
      }
      const hasRequiredFlag = cols.some(c => c.name === 'is_required');
      if (!hasRequiredFlag) {
        db.exec('ALTER TABLE course_units ADD COLUMN is_required INTEGER DEFAULT 1');
        console.log('✓ Migrated: added course_units.is_required');
      }

      // IAL Mathematics / Further Mathematics 采用“固定单元 + 候选单元任选”的六单元结构。
      // 选择逻辑由学生已有成绩和考季计划识别，不能把 D1 这一个单元静态标为可选。
      // 以下仅补全、修正未被任何成绩/计划引用的课程配置，绝不修改成绩或考季记录。
      const { v4: uuidv4 } = require('uuid');
      const flexibleCourses = db.prepare(
        `SELECT id, subject_code FROM courses
         WHERE upper(trim(subject_code)) IN ('IAL-MATH', 'IAL-FM', 'IAL-FMATH')`
      ).all();
      const getUnit = db.prepare(
        'SELECT * FROM course_units WHERE course_id = ? AND upper(trim(unit_code)) = ? LIMIT 1'
      );
      const insertUnit = db.prepare(
        `INSERT INTO course_units
           (id, course_id, unit_code, unit_name, is_advanced, is_required, max_score, weight, description, sort_order)
         VALUES (?, ?, ?, ?, 0, 1, 100, 1, '', ?)`
      );
      const hasUnitReference = db.prepare(
        `SELECT 1
         WHERE EXISTS (
           SELECT 1 FROM session_unit_plans p
           JOIN student_courses sc ON sc.id = p.student_course_id
           WHERE sc.course_id = ? AND p.course_unit_id = ?
         )
         OR EXISTS (
           SELECT 1 FROM unit_grades ug
           JOIN student_courses sc ON sc.id = ug.student_course_id
           WHERE sc.course_id = ? AND upper(trim(COALESCE(ug.unit_code, ''))) = ?
         )`
      );

      for (const course of flexibleCourses) {
        const code = String(course.subject_code || '').trim().toUpperCase();
        db.prepare('UPDATE course_units SET is_required = 1 WHERE course_id = ? AND is_required <> 1').run(course.id);

        if (code === 'IAL-MATH' && !getUnit.get(course.id, 'D1')) {
          const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM course_units WHERE course_id = ?').get(course.id);
          insertUnit.run(uuidv4(), course.id, 'D1', 'Decision Mathematics 1', nextOrder.next_order);
          console.log('✓ Migrated: added IAL Mathematics D1 as a candidate unit');
        }

        if (code === 'IAL-FM' || code === 'IAL-FMATH') {
          const replacements = [
            { from: 'S3', to: 'M1', name: 'Mechanics 1' },
            { from: 'M3', to: 'S1', name: 'Statistics 1' },
          ];
          for (const replacement of replacements) {
            const source = getUnit.get(course.id, replacement.from);
            const target = getUnit.get(course.id, replacement.to);
            if (source && !target) {
              const referenced = hasUnitReference.get(course.id, source.id, course.id, replacement.from);
              if (!referenced) {
                db.prepare('UPDATE course_units SET unit_code = ?, unit_name = ?, is_required = 1 WHERE id = ?')
                  .run(replacement.to, replacement.name, source.id);
                console.log(`✓ Migrated: corrected IAL Further Mathematics ${replacement.from} to ${replacement.to}`);
              } else {
                console.warn(`Skipped IAL Further Mathematics ${replacement.from} correction because it has historical references`);
              }
            }
          }

          for (const missing of [
            { code: 'M1', name: 'Mechanics 1' },
            { code: 'S1', name: 'Statistics 1' },
          ]) {
            if (!getUnit.get(course.id, missing.code)) {
              const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM course_units WHERE course_id = ?').get(course.id);
              insertUnit.run(uuidv4(), course.id, missing.code, missing.name, nextOrder.next_order);
              console.log(`✓ Migrated: added IAL Further Mathematics ${missing.code} candidate unit`);
            }
          }
        }
      }
    } catch (e) {
      // ignore if table missing in early init scenarios
    }

    // Ensure university_programs structured requirement columns exist
    try {
      const cols = db.prepare("PRAGMA table_info(university_programs)").all();
      const hasCol = (name) => cols.some(c => c.name === name);
      const addCol = (name, type) => {
        db.exec(`ALTER TABLE university_programs ADD COLUMN ${name} ${type}`);
        console.log(`✓ Migrated: added university_programs.${name}`);
      };

      if (!hasCol('requirements_struct')) addCol('requirements_struct', 'TEXT'); // JSON
      if (!hasCol('alevel_required_grades')) addCol('alevel_required_grades', 'TEXT'); // JSON: ["A*","A","A"]
      if (!hasCol('subject_requirements_struct')) addCol('subject_requirements_struct', 'TEXT'); // JSON: { include:[], minGrades: {Math:"A"} }
      if (!hasCol('extra_exams')) addCol('extra_exams', 'TEXT'); // JSON: ["STEP","MAT"]
      if (!hasCol('language_type')) addCol('language_type', 'TEXT'); // IELTS/TOEFL/...
      if (!hasCol('language_overall_min')) addCol('language_overall_min', 'REAL');
      if (!hasCol('language_component_mins')) addCol('language_component_mins', 'TEXT'); // JSON: { overall:7, l:7, r:7, w:7, s:7 }

      if (!hasCol('us_major_selectivity')) addCol('us_major_selectivity', 'TEXT');
      if (!hasCol('us_prerequisites_text')) addCol('us_prerequisites_text', 'TEXT');
      if (!hasCol('portfolio_required')) addCol('portfolio_required', 'INTEGER');
      if (!hasCol('portfolio_notes')) addCol('portfolio_notes', 'TEXT');
    } catch (e) {
      // ignore
    }

    // target_universities: 体系/美本轻量/结构化要求
    try {
      const cols = db.prepare("PRAGMA table_info(target_universities)").all();
      const hasCol = (name) => cols.some((c) => c.name === name);
      const addCol = (name, type) => {
        db.exec(`ALTER TABLE target_universities ADD COLUMN ${name} ${type}`);
        console.log(`✓ Migrated: added target_universities.${name}`);
      };
      if (!hasCol('degree_level')) addCol('degree_level', 'TEXT');
      if (!hasCol('edu_system')) addCol('edu_system', 'TEXT');
      if (!hasCol('school_type')) addCol('school_type', 'TEXT');
      if (!hasCol('admit_rate')) addCol('admit_rate', 'REAL');
      if (!hasCol('application_systems')) addCol('application_systems', 'TEXT'); // JSON array
      if (!hasCol('rounds_supported')) addCol('rounds_supported', 'TEXT'); // JSON array
      if (!hasCol('costs')) addCol('costs', 'TEXT'); // JSON
      if (!hasCol('location_text')) addCol('location_text', 'TEXT');
      if (!hasCol('campus_size_text')) addCol('campus_size_text', 'TEXT');
      if (!hasCol('requirements_struct')) addCol('requirements_struct', 'TEXT'); // JSON
    } catch (e) {
      // ignore
    }

    // students: 预毕业年月（YYYY-MM）
    try {
      const cols = db.prepare("PRAGMA table_info(students)").all();
      const hasCol = (name) => cols.some((c) => c.name === name);
      if (!hasCol('expected_graduation_month')) {
        db.exec('ALTER TABLE students ADD COLUMN expected_graduation_month TEXT');
        console.log('✓ Migrated: added students.expected_graduation_month');
      }
      if (!hasCol('class_track')) {
        db.exec('ALTER TABLE students ADD COLUMN class_track TEXT');
        console.log('✓ Migrated: added students.class_track');
      }
      if (!hasCol('avatar_url')) {
        db.exec('ALTER TABLE students ADD COLUMN avatar_url TEXT');
        console.log('✓ Migrated: added students.avatar_url');
      }
    } catch (e) {
      // ignore
    }

    // student_universities: 专业、匹配偏好、录取详情
    try {
      const cols = db.prepare("PRAGMA table_info(student_universities)").all();
      const hasCol = (name) => cols.some((c) => c.name === name);
      const addCol = (name, type) => {
        db.exec(`ALTER TABLE student_universities ADD COLUMN ${name} ${type}`);
        console.log(`✓ Migrated: added student_universities.${name}`);
      };
      if (!hasCol('program_id')) addCol('program_id', 'TEXT');
      if (!hasCol('matching_prefs')) addCol('matching_prefs', 'TEXT');
      if (!hasCol('matching_profile')) addCol('matching_profile', 'TEXT');
      if (!hasCol('offer_detail')) addCol('offer_detail', 'TEXT');
    } catch (e) {
      // ignore
    }

    // language_scores: component_scores（用于 Duolingo 等非 IELTS/TOEFL 四项结构）
    try {
      const cols = db.prepare("PRAGMA table_info(language_scores)").all();
      const hasCol = (name) => cols.some((c) => c.name === name);
      if (!hasCol('component_scores')) {
        db.exec('ALTER TABLE language_scores ADD COLUMN component_scores TEXT');
        console.log('✓ Migrated: added language_scores.component_scores');
      }
    } catch (e) {
      // ignore
    }

    // 回填预毕业月份与入学年份（仅空值）
    try {
      const { computeExpectedGraduationMonth, extractYear } = require('./utils/gradeMatch');
      const rows = db.prepare('SELECT id, enrollment_year, study_duration, grade, expected_graduation_month FROM students').all();
      const updGrad = db.prepare(
        'UPDATE students SET expected_graduation_month = ? WHERE id = ? AND (expected_graduation_month IS NULL OR expected_graduation_month = \'\')'
      );
      const updEy = db.prepare('UPDATE students SET enrollment_year = ? WHERE id = ? AND enrollment_year IS NULL');
      for (const r of rows) {
        let ey = r.enrollment_year;
        if (ey == null && r.grade) {
          const y = extractYear(r.grade);
          if (y) {
            ey = parseInt(y, 10);
            updEy.run(ey, r.id);
          }
        }
        if (ey == null) continue;
        const sd = r.study_duration || 2;
        const computed = computeExpectedGraduationMonth(ey, sd);
        if (computed && (!r.expected_graduation_month || String(r.expected_graduation_month).trim() === '')) {
          updGrad.run(computed, r.id);
        }
      }
    } catch (e) {
      console.warn('Migration backfill students:', e.message);
    }

    // 课程不按届别拆分：统一为 ALL，避免同名课逐年复制、难以管理
    try {
      const r = db
        .prepare(
          `UPDATE courses SET grade_level = 'ALL' 
           WHERE grade_level IS NULL OR upper(trim(grade_level)) != 'ALL'`
        )
        .run();
      if (r.changes > 0) {
        console.log(`✓ Migrated: normalized ${r.changes} course row(s) to grade_level ALL`);
      }
    } catch (e) {
      console.warn('Migration courses.grade_level:', e.message);
    }

    // users：RBAC（admin / staff / student）+ student_id 绑定
    try {
      migrateUsersRbac(db);
    } catch (e) {
      console.warn('Migration users RBAC:', e.message);
    }

    try {
      migrateUsersSupervisorRole(db);
    } catch (e) {
      console.warn('Migration users supervisor:', e.message);
    }

    try {
      migrateUsersTeacherRole(db);
    } catch (e) {
      console.warn('Migration users teacher:', e.message);
    }

    // 已有数据库升级后补种子指导老师账号（用户名冲突则跳过）
    try {
      const hasSup = db.prepare("SELECT id FROM users WHERE username = ?").get('supervisor');
      if (!hasSup) {
        const bcrypt = require('bcryptjs');
        const { v4: uuidv4 } = require('uuid');
        db.prepare(
          'INSERT INTO users (id, username, password, name, email, role, student_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          uuidv4(),
          'supervisor',
          bcrypt.hashSync(process.env.SEED_SUPERVISOR_PASSWORD || 'supervisor123', 10),
          '指导老师',
          '',
          'supervisor',
          null,
          new Date().toISOString(),
          new Date().toISOString()
        );
        console.log('✓ Seeded default supervisor (supervisor / supervisor123)');
      }
    } catch (e) {
      console.warn('Seed supervisor user:', e.message);
    }

    try {
      const hasTeacher = db.prepare("SELECT id FROM users WHERE username = ?").get('teacher');
      if (!hasTeacher) {
        const bcrypt = require('bcryptjs');
        const { v4: uuidv4 } = require('uuid');
        db.prepare(
          'INSERT INTO users (id, username, password, name, email, role, student_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          uuidv4(),
          'teacher',
          bcrypt.hashSync(process.env.SEED_TEACHER_PASSWORD || 'teacher123', 10),
          '任课教师',
          '',
          'teacher',
          null,
          new Date().toISOString(),
          new Date().toISOString()
        );
        console.log('✓ Seeded default teacher (teacher / teacher123)');
      }
    } catch (e) {
      console.warn('Seed teacher user:', e.message);
    }

    try {
      const { normalizeAllowedMonthsList } = require('./utils/examSessionRange');
      const sixRows = db
        .prepare('SELECT id, year, board FROM exam_sessions WHERE month = 6')
        .all();
      let merged = 0;
      let renamed = 0;
      const reassignPlans = db.prepare(
        'UPDATE session_unit_plans SET exam_session_id = ? WHERE exam_session_id = ?'
      );
      const deleteSession = db.prepare('DELETE FROM exam_sessions WHERE id = ?');
      const renameSession = db.prepare(
        `UPDATE exam_sessions SET month = 5, label = REPLACE(label, '6月', '5月') WHERE id = ?`
      );
      for (const row of sixRows) {
        const five = db
          .prepare(
            'SELECT id FROM exam_sessions WHERE year = ? AND month = 5 AND board = ? LIMIT 1'
          )
          .get(row.year, row.board);
        if (five) {
          reassignPlans.run(five.id, row.id);
          deleteSession.run(row.id);
          merged += 1;
        } else {
          renameSession.run(row.id);
          renamed += 1;
        }
      }
      if (merged > 0 || renamed > 0) {
        console.log(
          `✓ exam_sessions 6→5: merged ${merged}, renamed ${renamed}`
        );
      }
      const unitRows = db
        .prepare(
          `SELECT id, allowed_months FROM course_units WHERE allowed_months IS NOT NULL AND allowed_months LIKE '%6%'`
        )
        .all();
      const unitUpd = db.prepare('UPDATE course_units SET allowed_months = ? WHERE id = ?');
      let unitChanged = 0;
      for (const row of unitRows) {
        try {
          const parsed = JSON.parse(row.allowed_months);
          if (!Array.isArray(parsed)) continue;
          const next = normalizeAllowedMonthsList(parsed);
          unitUpd.run(JSON.stringify(next), row.id);
          unitChanged += 1;
        } catch {
          // ignore invalid JSON
        }
      }
      if (unitChanged > 0) {
        console.log(`✓ Migrated ${unitChanged} course_units allowed_months: 6 → 5`);
      }
    } catch (e) {
      console.warn('Migration exam month 6→5:', e.message);
    }

    // 考季与单元计划的防重复保护：使用触发器而非重建表，兼容已有数据库中的历史重复记录。
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_exam_sessions_identity
          ON exam_sessions(year, month, board);
        CREATE INDEX IF NOT EXISTS idx_session_unit_plans_identity
          ON session_unit_plans(student_course_id, course_unit_id, exam_session_id, plan_type);

        CREATE TRIGGER IF NOT EXISTS trg_exam_sessions_unique_identity_insert
        BEFORE INSERT ON exam_sessions
        WHEN EXISTS (
          SELECT 1 FROM exam_sessions
          WHERE year = NEW.year
            AND (CASE WHEN month = 6 THEN 5 ELSE month END) = (CASE WHEN NEW.month = 6 THEN 5 ELSE NEW.month END)
            AND COALESCE(board, 'Edexcel') = COALESCE(NEW.board, 'Edexcel')
        )
        BEGIN
          SELECT RAISE(ABORT, 'duplicate exam session');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_exam_sessions_unique_identity_update
        BEFORE UPDATE OF year, month, board ON exam_sessions
        WHEN EXISTS (
          SELECT 1 FROM exam_sessions
          WHERE id <> NEW.id
            AND year = NEW.year
            AND (CASE WHEN month = 6 THEN 5 ELSE month END) = (CASE WHEN NEW.month = 6 THEN 5 ELSE NEW.month END)
            AND COALESCE(board, 'Edexcel') = COALESCE(NEW.board, 'Edexcel')
        )
        BEGIN
          SELECT RAISE(ABORT, 'duplicate exam session');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_session_unit_plans_unique_identity_insert
        BEFORE INSERT ON session_unit_plans
        WHEN NEW.status <> 'cancelled' AND EXISTS (
          SELECT 1 FROM session_unit_plans
          WHERE student_course_id = NEW.student_course_id
            AND course_unit_id = NEW.course_unit_id
            AND exam_session_id = NEW.exam_session_id
            AND plan_type = NEW.plan_type
            AND status <> 'cancelled'
        )
        BEGIN
          SELECT RAISE(ABORT, 'duplicate session unit plan');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_session_unit_plans_unique_identity_update
        BEFORE UPDATE OF student_course_id, course_unit_id, exam_session_id, plan_type, status ON session_unit_plans
        WHEN NEW.status <> 'cancelled' AND EXISTS (
          SELECT 1 FROM session_unit_plans
          WHERE id <> NEW.id
            AND student_course_id = NEW.student_course_id
            AND course_unit_id = NEW.course_unit_id
            AND exam_session_id = NEW.exam_session_id
            AND plan_type = NEW.plan_type
            AND status <> 'cancelled'
        )
        BEGIN
          SELECT RAISE(ABORT, 'duplicate session unit plan');
        END;
      `);
      console.log('✓ Added non-destructive exam session duplicate guards');
    } catch (e) {
      console.warn('Migration exam session duplicate guards:', e.message);
    }

    return true;
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    throw error;
  }
}

// 关闭数据库连接
function closeDb() {
  if (db) {
    db.close();
    console.log('SQLite database connection closed');
  }
}

module.exports = { 
  db: dbQuery, 
  dbAsync, 
  initDb, 
  getDb,
  closeDb,
  pool: db  // 保持兼容性
};
