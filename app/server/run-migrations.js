const fs = require('fs');
const path = require('path');

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const hasMigration = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?');
  const recordMigration = db.prepare('INSERT INTO schema_migrations (version) VALUES (?)');

  for (const file of files) {
    if (hasMigration.get(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      recordMigration.run(file);
    })();
    console.log(`✓ Applied migration ${file}`);
  }
}

module.exports = { runMigrations };
