/**
 * 本地测试：为学生档案创建登录账号（role=student，绑定 students.id）。
 *
 * 用法（在 app 目录下）：
 *   node server/scripts/create-student-login.cjs
 *   node server/scripts/create-student-login.cjs --username stu01 --password test123
 *   node server/scripts/create-student-login.cjs --student-id <UUID>
 *
 * 环境变量：
 *   SQLITE_PATH  数据库文件路径（默认与 server/db.js 一致）
 */

const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../../database.sqlite');

function parseArgs() {
  const out = { username: 'teststudent', password: 'test123456', studentId: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--username' && argv[i + 1]) out.username = argv[++i];
    else if (argv[i] === '--password' && argv[i + 1]) out.password = argv[++i];
    else if (argv[i] === '--student-id' && argv[i + 1]) out.studentId = argv[++i];
  }
  return out;
}

async function main() {
  const { username, password, studentId: sidArg } = parseArgs();

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 8000');

  const cols = db.prepare('PRAGMA table_info(users)').all();
  if (!cols.some((c) => c.name === 'student_id')) {
    console.error('users 表缺少 student_id，请先正常启动一次后端以完成数据库迁移。');
    process.exit(1);
  }

  let studentId = sidArg;
  if (!studentId) {
    const row = db
      .prepare(
        `SELECT id, name FROM students WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
      )
      .get();
    if (!row) {
      console.error('数据库中没有 status=active 的学生，请先在「学生管理」中添加学生。');
      process.exit(1);
    }
    studentId = row.id;
    console.log(`未指定 --student-id，使用最近一名在读学生: ${row.name} (${studentId})`);
  } else {
    const st = db.prepare('SELECT id, name FROM students WHERE id = ?').get(studentId);
    if (!st) {
      console.error('找不到该 student_id 对应的学生记录。');
      process.exit(1);
    }
    console.log(`绑定学生: ${st.name} (${studentId})`);
  }

  const existingUser = db.prepare('SELECT id, username FROM users WHERE student_id = ?').get(studentId);
  if (existingUser) {
    console.error(`该学生已绑定账号: ${existingUser.username} (${existingUser.id})`);
    process.exit(1);
  }

  const dup = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (dup) {
    console.error(`用户名已存在: ${username}`);
    process.exit(1);
  }

  const stu = db.prepare('SELECT name FROM students WHERE id = ?').get(studentId);
  const name = stu?.name || '学生';

  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, username, password, name, email, role, student_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?)`
  ).run(id, username, hash, name, '', studentId, now, now);

  console.log('\n已创建学生登录账号：');
  console.log(`  用户名: ${username}`);
  console.log(`  密码:   ${password}`);
  console.log(`  绑定学生 ID: ${studentId}`);
  console.log('\n请使用上述账号在登录页登录测试。\n');

  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
