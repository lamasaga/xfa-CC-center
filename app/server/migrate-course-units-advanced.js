const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');

function migrate() {
  console.log('Migrating database for course_units.is_advanced...\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const hasTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='course_units'")
    .get();

  if (!hasTable) {
    console.log('  [SKIP] course_units table not found');
    db.close();
    console.log('\nMigration completed.');
    return;
  }

  const cols = db.prepare('PRAGMA table_info(course_units)').all();
  const hasIsAdvanced = cols.some((c) => c.name === 'is_advanced');

  if (hasIsAdvanced) {
    console.log('  [SKIP] Add is_advanced to course_units — already done');
  } else {
    db.exec('ALTER TABLE course_units ADD COLUMN is_advanced INTEGER DEFAULT 0');
    console.log('  [OK]   Add is_advanced to course_units');
  }

  db.close();
  console.log('\nMigration completed.');
}

migrate();

