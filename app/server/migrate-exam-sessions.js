const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');

function migrate() {
  console.log('Migrating database for exam sessions...\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrations = [
    {
      name: 'Add study_duration to students',
      check: () => {
        const cols = db.prepare("PRAGMA table_info(students)").all();
        return cols.some(c => c.name === 'study_duration');
      },
      run: () => {
        db.exec('ALTER TABLE students ADD COLUMN study_duration INTEGER DEFAULT 2');
      }
    },
    {
      name: 'Create exam_sessions table',
      check: () => {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='exam_sessions'").all();
        return tables.length > 0;
      },
      run: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS exam_sessions (
              id TEXT PRIMARY KEY,
              year INTEGER NOT NULL,
              month INTEGER NOT NULL,
              label TEXT NOT NULL,
              board TEXT DEFAULT 'Edexcel',
              registration_deadline DATE,
              results_date DATE,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_exam_sessions_year_month ON exam_sessions(year, month);
        `);
      }
    },
    {
      name: 'Create session_unit_plans table',
      check: () => {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='session_unit_plans'").all();
        return tables.length > 0;
      },
      run: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS session_unit_plans (
              id TEXT PRIMARY KEY,
              student_course_id TEXT NOT NULL REFERENCES student_courses(id) ON DELETE CASCADE,
              course_unit_id TEXT NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
              exam_session_id TEXT NOT NULL REFERENCES exam_sessions(id),
              plan_type TEXT DEFAULT 'first_sit' CHECK (plan_type IN ('first_sit', 'resit')),
              status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'registered', 'completed', 'cancelled')),
              notes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_session_unit_plans_student_course ON session_unit_plans(student_course_id);
          CREATE INDEX IF NOT EXISTS idx_session_unit_plans_session ON session_unit_plans(exam_session_id);
          CREATE INDEX IF NOT EXISTS idx_session_unit_plans_unit ON session_unit_plans(course_unit_id);
        `);
      }
    },
    {
      name: 'Add allowed_months to course_units',
      check: () => {
        const cols = db.prepare("PRAGMA table_info(course_units)").all();
        return cols.some(c => c.name === 'allowed_months');
      },
      run: () => {
        db.exec('ALTER TABLE course_units ADD COLUMN allowed_months TEXT');
      }
    }
  ];

  for (const m of migrations) {
    if (m.check()) {
      console.log(`  [SKIP] ${m.name} — already done`);
    } else {
      m.run();
      console.log(`  [OK]   ${m.name}`);
    }
  }

  db.close();
  console.log('\nMigration completed.');
}

migrate();
