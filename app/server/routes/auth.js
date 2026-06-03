const express = require('express');
const bcrypt = require('bcryptjs');
const { dbAsync, getDb } = require('../db');
const {
  generateToken,
  authenticateToken,
  normalizeRole,
} = require('../middleware/auth');
const { defaultStudentInitialPassword } = require('../config');

const router = express.Router();

/**
 * 去掉从 Markdown/浏览器误带的 BOM、零宽字符、成对反引号或直引号包裹。
 * 不误删口令中间的合法字符（如 %、$）。
 */
function stripCopyPasteNoise(raw) {
  let s = String(raw ?? '');
  s = s.replace(/\uFEFF/g, '').replace(/[\u200B-\u200D\u2060]/g, '');
  s = s.trim();
  const unwrap = (open, close) => {
    if (s.length >= 2 && s[0] === open && s[s.length - 1] === close) {
      s = s.slice(1, -1);
      s = s.replace(/\uFEFF/g, '').replace(/[\u200B-\u200D\u2060]/g, '').trim();
    }
  };
  unwrap('`', '`');
  unwrap('"', '"');
  unwrap('\u201c', '\u201d');
  return s;
}

// 登录
router.post('/login', async (req, res) => {
  try {
    const username = stripCopyPasteNoise(req.body?.username ?? '');
    const password = stripCopyPasteNoise(req.body?.password ?? '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // 大小写不敏感匹配用户名（避免 Admin / admin）；勿 trim 库内 username 比较侧仅规范入参
    const user = getDb()
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .get(username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (typeof user.password !== 'string' || !user.password) {
      console.error('Login error: user.password missing or invalid type');
      return res.status(500).json({
        error: 'Server error during login',
        details:
          process.env.NODE_ENV !== 'production'
            ? '数据库用户缺少有效 password 字段'
            : undefined,
      });
    }

    let isValidPassword = false;
    try {
      isValidPassword = await bcrypt.compare(password, user.password);
    } catch (compareErr) {
      console.error('Login error (bcrypt):', compareErr);
      return res.status(500).json({
        error: 'Server error during login',
        details:
          process.env.NODE_ENV !== 'production'
            ? `密码字段不是合法的 bcrypt 哈希：${compareErr.message}`
            : undefined,
      });
    }

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let token;
    try {
      token = generateToken(user);
    } catch (tokenErr) {
      console.error('Login error (JWT):', tokenErr);
      return res.status(500).json({
        error: 'Server error during login',
        details:
          process.env.NODE_ENV !== 'production'
            ? `签发 token 失败：${tokenErr.message}`
            : undefined,
      });
    }

    const roleOut = normalizeRole(user.role);
    res.json({
      token,
      user: {
        id: String(user.id),
        username: String(user.username),
        name: user.name != null ? String(user.name) : '',
        email: user.email != null ? String(user.email) : '',
        role: roleOut != null && roleOut !== '' ? String(roleOut) : 'student',
        student_id: user.student_id != null ? String(user.student_id) : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Server error during login',
      details:
        process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbAsync.findById('users', req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 修改密码（已登录用户；学生 / 教务 / 指导老师等均可使用，前端对 admin 可不展示）
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const currentPassword = stripCopyPasteNoise(req.body?.currentPassword ?? '');
    const newPassword = stripCopyPasteNoise(req.body?.newPassword ?? '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请填写当前密码和新密码' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: '新密码至少 8 个字符' });
    }
    if (newPassword.length > 256) {
      return res.status(400).json({ error: '新密码过长' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: '新密码不能与当前密码相同' });
    }

    const user = await dbAsync.findById('users', req.user.id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (typeof user.password !== 'string' || !user.password) {
      return res.status(500).json({ error: '账号缺少有效密码字段，请联系管理员' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: '当前密码不正确' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await dbAsync.update('users', req.user.id, {
      password: hashedPassword,
      updated_at: new Date().toISOString(),
    });

    res.json({ message: '密码已更新' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 获取所有用户（仅 admin）；密码仅存 bcrypt 摘要，无法反查明文
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await dbAsync.findAll('users');
    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const safeUsers = users.map(({ password, ...user }) => ({
      ...user,
      role: normalizeRole(user.role),
      password_is_hashed: true,
      /** 业务约定：教务新建学生账号初始密码见 defaultStudentInitialPassword；用户改密后仅可通过「重置密码」由管理员获知新口令 */
      password_hint:
        user.role === 'student'
          ? `初始密码通常为教务创建时的 ${defaultStudentInitialPassword}（若已修改则仅本人或管理员重置后可知）`
          : '非学生账号无统一初始密码；忘记时请使用重置密码',
    }));

    res.json({
      users: safeUsers,
      securityNote:
        '系统使用 bcrypt 存储密码，技术上无法「查看」历史明文。管理员可通过「重置密码」设置新口令并告知对方；请在安全渠道传递口令并督促首次登录后改密。',
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 更新用户资料/角色（仅 admin；不可把账号改成 student 却未绑定 student_id）
router.patch('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const target = await dbAsync.findById('users', id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, email, role: roleRaw } = req.body;
    if (name === undefined && email === undefined && roleRaw === undefined) {
      return res.status(400).json({ error: 'No valid fields' });
    }

    const updates = { updated_at: new Date().toISOString() };

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: 'name invalid' });
      }
      updates.name = String(name).trim();
    }
    if (email !== undefined) {
      updates.email = email == null ? '' : String(email);
    }

    if (roleRaw !== undefined) {
      const role = normalizeRole(roleRaw);
      if (!['admin', 'staff', 'supervisor', 'teacher', 'student'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      if (role === 'student' && !target.student_id) {
        return res.status(400).json({ error: '不能将无 student_id 的账号改为学生角色' });
      }
      if (role !== 'student' && target.role === 'student') {
        return res.status(400).json({ error: '请通过删除学生档案解除学生账号，勿直接改角色' });
      }
      updates.role = role;
    }

    const updated = await dbAsync.update('users', id, updates);
    const { password, ...safe } = updated;
    res.json(safe);
  } catch (error) {
    console.error('Patch user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 管理员重置任意账号密码
router.post('/users/:id/reset-password', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'newPassword required (min 6 chars)' });
    }

    const target = await dbAsync.findById('users', id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await dbAsync.update('users', id, {
      password: hashedPassword,
      updated_at: new Date().toISOString(),
    });

    res.json({ message: 'Password reset', username: target.username });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 创建用户（仅admin）
router.post('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { username, password, name, email, role: roleRaw, student_id: studentIdBody } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password and name required' });
    }

    let role = normalizeRole(roleRaw || 'staff');
    if (!['admin', 'staff', 'supervisor', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'student') {
      if (!studentIdBody || String(studentIdBody).trim() === '') {
        return res.status(400).json({ error: 'student_id is required when role is student' });
      }
      const st = await dbAsync.findById('students', String(studentIdBody).trim());
      if (!st) {
        return res.status(404).json({ error: 'Student record not found for student_id' });
      }
      const existingLink = await dbAsync.findOne('users', { student_id: st.id });
      if (existingLink) {
        return res.status(409).json({ error: '该学生已绑定其他登录账号' });
      }
    }

    const { v4: uuidv4 } = require('uuid');
    const hashedPassword = await bcrypt.hash(password, 10);

    // 检查用户名是否已存在
    const existingUser = await dbAsync.findOne('users', { username });
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const newUser = await dbAsync.create('users', {
      id: uuidv4(),
      username,
      password: hashedPassword,
      name,
      email: email || '',
      role,
      student_id: role === 'student' ? String(studentIdBody).trim() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    res.status(201).json({ 
      message: 'User created successfully',
      userId: newUser.id 
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
