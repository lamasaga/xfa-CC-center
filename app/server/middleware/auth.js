const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config');
const { getDb } = require('../db');
const { findSession } = require('../security/session');
const { requirePermission } = require('../security/permissions');

const JWT_SECRET = jwtConfig.secret;

/** 兼容旧库中的 editor / viewer，统一视为教务 staff */
function normalizeRole(role) {
  if (role === 'editor' || role === 'viewer') return 'staff';
  return role;
}

const generateToken = (user) => {
  if (!user || user.id == null || user.username == null) {
    throw new Error('generateToken: user id/username missing');
  }
  const role = normalizeRole(user.role);
  const roleStr = role != null && role !== '' ? String(role) : 'student';
  return jwt.sign(
    {
      id: String(user.id),
      username: String(user.username),
      role: roleStr,
      name: user.name != null ? String(user.name) : '',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * 校验 JWT 后从数据库加载用户，保证角色 / student_id 与库一致，避免旧 token 绕过。
 */
const authenticateToken = (req, res, next) => {
  const session = findSession(req);
  if (session) {
    const role = normalizeRole(session.role);
    req.authMode = 'session';
    req.sessionId = session.session_id;
    req.user = {
      id: session.id,
      username: session.username,
      role,
      name: session.name,
      email: session.email || null,
      student_id: session.student_id || null,
    };
    if (role === 'student' && !req.user.student_id) {
      return res.status(403).json({ error: '学生账号未绑定学生档案，请联系管理员' });
    }
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LEGACY_BEARER !== 'true') {
    return res.status(401).json({ error: 'Session cookie required' });
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const row = getDb()
      .prepare(
        'SELECT id, username, role, name, email, student_id FROM users WHERE id = ?'
      )
      .get(payload.id);

    if (!row) {
      return res.status(403).json({ error: 'User not found' });
    }

    const role = normalizeRole(row.role);
    req.user = {
      id: row.id,
      username: row.username,
      role,
      name: row.name,
      email: row.email || null,
      student_id: row.student_id || null,
    };
    req.authMode = 'legacy_bearer';

    if (role === 'student' && !req.user.student_id) {
      return res.status(403).json({
        error: '学生账号未绑定学生档案，请联系管理员',
      });
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
    }

    next();
  };
};

/**
 * 教务 / 指导老师 / 管理员：日常业务写入（成绩、任务、学生申请关联等）
 * 学生、教师账号不可写。
 */
const canModify = requireRole('admin', 'staff', 'supervisor');

/**
 * 考季排期：教务 / 指导老师 / 管理员 / 教师
 */
const canModifyExamSessions = requireRole('admin', 'staff', 'supervisor', 'teacher');

/** 仅教务或管理员：新增 / 删除学生档案（及自动绑定学生登录账号） */
const canManageStudentLifecycle = requireRole('admin', 'staff');

/** 仅管理员或指导老师：维护「院校库」主数据（学校与专业目录） */
const canManageUniversityCatalog = requireRole('admin', 'supervisor');

const isAdmin = requireRole('admin');

/** 禁止学生访问（年级概览、工作台、课程管理后台等） */
const requireNotStudent = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role === 'student') {
    return res.status(403).json({ error: '学生账号无权访问该功能' });
  }
  next();
};

/**
 * 学生仅能操作 URL 中与本人 student_id 一致的资源；教务/管理员直接放行。
 * @param {string} paramName 路由参数名，如 'id'、'studentId'
 */
const assertOwnStudentParam = (paramName = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== 'student') {
      return next();
    }
    const target = req.params[paramName];
    if (!target || target !== req.user.student_id) {
      return res.status(403).json({ error: '无权访问该学生数据' });
    }
    next();
  };
};

module.exports = {
  generateToken,
  authenticateToken,
  requireRole,
  canModify,
  canModifyExamSessions,
  canManageStudentLifecycle,
  canManageUniversityCatalog,
  isAdmin,
  requireNotStudent,
  assertOwnStudentParam,
  normalizeRole,
  JWT_SECRET,
  requirePermission,
};
