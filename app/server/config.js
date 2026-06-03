// 数据库配置
// 已切换到 SQLite，无需配置密码

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const fallback = 'your-secret-key-change-this-in-production';

  // 开发环境允许没配，方便本地快速跑；生产环境必须显式配置
  if (!secret || String(secret).trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing required env JWT_SECRET in production');
    }
    return fallback;
  }

  // 防止把默认值/弱值带到线上
  if (process.env.NODE_ENV === 'production') {
    const s = String(secret);
    if (s === fallback) {
      throw new Error('JWT_SECRET must not use the default placeholder value in production');
    }
    // 长度下限：避免过短密钥被爆破（不是强密码学证明，但能挡住明显风险）
    if (s.length < 32) {
      throw new Error('JWT_SECRET is too short in production (min 32 characters recommended)');
    }
  }

  return String(secret);
}

/** 教务新建学生时自动创建登录账号的初始密码（入库前经 bcrypt；可用环境变量覆盖） */
const defaultStudentInitialPassword =
  process.env.DEFAULT_STUDENT_INITIAL_PASSWORD != null &&
  String(process.env.DEFAULT_STUDENT_INITIAL_PASSWORD).trim() !== ''
    ? String(process.env.DEFAULT_STUDENT_INITIAL_PASSWORD).trim()
    : 'xfa19852026';

module.exports = {
  database: {
    // SQLite 配置
    type: 'sqlite',
    path: process.env.SQLITE_PATH || './database.sqlite',
    
    // 保留 PostgreSQL 配置（备用）
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'alevel_management',
  },
  // JWT 配置
  jwt: {
    secret: getJwtSecret(),
    expiresIn: '24h'
  },
  getJwtSecret,
  defaultStudentInitialPassword,
};
