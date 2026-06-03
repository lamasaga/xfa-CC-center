'use strict';

/**
 * 将 admin / staff / supervisor / teacher 四个账号的密码重置为强口令，并写入仓库根目录
 * doc/运营账号口令-本地留存.md（该文件应加入 .gitignore，勿提交）。
 *
 * 会先加载 `db.js` 并执行 `initDb()`，以便对旧库运行迁移（例如 users.role 增加 supervisor）。
 *
 * 用法（在 app 目录）：
 *   node server/scripts/reset-staff-passwords.cjs
 *   $env:SQLITE_PATH="D:\path\to\database.sqlite"; node server/scripts/reset-staff-passwords.cjs
 *
 * 使用环境变量指定明文口令（不随机生成）：
 *   $env:RESET_ADMIN_PASSWORD="..."; $env:RESET_STAFF_PASSWORD="..."; $env:RESET_SUPERVISOR_PASSWORD="..."; $env:RESET_TEACHER_PASSWORD="..."; node server/scripts/reset-staff-passwords.cjs
 *
 * 仅预览不写库、不写文件：
 *   node server/scripts/reset-staff-passwords.cjs --dry-run
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// 避免 % $ = 等与 Markdown/Shell/URL 易混淆的字符，减少复制错误
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#-_*@';

function generatePassword(length = 22) {
  const bytes = crypto.randomBytes(length);
  let s = '';
  for (let i = 0; i < length; i += 1) {
    s += ALPH[bytes[i] % ALPH.length];
  }
  return s;
}

function resolveDbPath() {
  return process.env.SQLITE_PATH
    ? String(process.env.SQLITE_PATH).trim()
    : path.join(__dirname, '../../database.sqlite');
}

function resolveDocPath() {
  return path.join(__dirname, '../../../doc/运营账号口令-本地留存.md');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dbPath = resolveDbPath();
  const docPath = resolveDocPath();

  const plain = {
    admin: process.env.RESET_ADMIN_PASSWORD ? String(process.env.RESET_ADMIN_PASSWORD) : generatePassword(),
    staff: process.env.RESET_STAFF_PASSWORD ? String(process.env.RESET_STAFF_PASSWORD) : generatePassword(),
    supervisor: process.env.RESET_SUPERVISOR_PASSWORD
      ? String(process.env.RESET_SUPERVISOR_PASSWORD)
      : generatePassword(),
    teacher: process.env.RESET_TEACHER_PASSWORD
      ? String(process.env.RESET_TEACHER_PASSWORD)
      : generatePassword(),
  };

  const rows = [
    { username: 'admin', role: '管理员', password: plain.admin },
    { username: 'staff', role: '教务', password: plain.staff },
    { username: 'supervisor', role: '指导老师', password: plain.supervisor },
    { username: 'teacher', role: '任课教师', password: plain.teacher },
  ];

  const now = new Date().toISOString();
  const md = `<!-- 本文件含明文口令，请勿提交 Git；勿截图发群。 -->

# 运营账号口令（本地留存）

　　生成时间（UTC）：${now}

　　数据库文件：\`${dbPath.replace(/\\/g, '/')}\`

| 用户名 | 角色 | 登录口令 |
|--------|------|------------|
| admin | 管理员 | \`${plain.admin}\` |
| staff | 教务 | \`${plain.staff}\` |
| supervisor | 指导老师 | \`${plain.supervisor}\` |
| teacher | 任课教师 | \`${plain.teacher}\` |

　　请自行备份到密码管理器；修改口令后可再次运行 \`npm run reset-staff-passwords\`（在 app 目录）重新生成并写库。
`;

  if (dryRun) {
    console.log('[dry-run] 不会修改数据库或写入文件。\n');
    console.log(md);
    return;
  }

  if (!fs.existsSync(dbPath)) {
    console.error('找不到数据库文件:', dbPath);
    console.error('请设置环境变量 SQLITE_PATH 或在 app/database.sqlite 放置数据库后重试。');
    process.exit(1);
  }

  process.env.SQLITE_PATH = path.resolve(dbPath);
  const dbModulePath = require.resolve('../db.js');
  delete require.cache[dbModulePath];
  const { initDb, getDb, closeDb } = require('../db.js');

  await initDb();
  const db = getDb();

  try {
    db.pragma('foreign_keys = ON');
    const upd = db.prepare(
      'UPDATE users SET password = ?, updated_at = ? WHERE username = ?'
    );
    const ins = db.prepare(
      `INSERT INTO users (id, username, password, name, email, role, student_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of rows) {
      const hash = bcrypt.hashSync(r.password, 10);
      const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(r.username);
      if (exists) {
        upd.run(hash, now, r.username);
        console.log('已更新:', r.username, r.role);
      } else {
        const dbRole =
          r.username === 'admin'
            ? 'admin'
            : r.username === 'staff'
              ? 'staff'
              : r.username === 'teacher'
                ? 'teacher'
                : 'supervisor';
        ins.run(uuidv4(), r.username, hash, r.role, '', dbRole, null, now, now);
        console.log('已创建:', r.username, r.role);
      }
    }
  } finally {
    closeDb();
  }

  const dir = path.dirname(docPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(docPath, md, 'utf8');
  console.log('\n已写入:', docPath);
  console.log('请妥善保管该文件，勿提交版本库。\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
