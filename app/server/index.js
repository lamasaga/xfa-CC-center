const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { initDb } = require('./db');
const { getJwtSecret } = require('./config');
const { httpLog } = require('./middleware/httpLog');
const { tryInit: initSentry, captureException: captureSentryException } = require('./telemetry/sentry');
const healthRoutes = require('./routes/health');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const courseRoutes = require('./routes/courses');
const universityRoutes = require('./routes/universities');
const examSessionRoutes = require('./routes/exam-sessions');

const app = express();
const PORT = Number.parseInt(String(process.env.PORT || '3001'), 10) || 3001;
const HOST =
  process.env.HOST ||
  (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '127.0.0.1');

app.disable('x-powered-by');

initSentry();

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

function simpleRateLimit({ windowMs, max, keyGenerator }) {
  const hits = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [k, v] of hits.entries()) {
      if (now - v.windowStart >= windowMs) hits.delete(k);
    }
  };

  return (req, res, next) => {
    cleanup();
    const key = (keyGenerator ? keyGenerator(req) : req.ip) || 'unknown';
    const now = Date.now();
    const cur = hits.get(key);

    if (!cur || now - cur.windowStart >= windowMs) {
      hits.set(key, { windowStart: now, count: 1 });
      return next();
    }

    cur.count += 1;
    if (cur.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - cur.windowStart)) / 1000)));
      return res.status(429).json({ error: 'Too many requests' });
    }

    next();
  };
}

const loginRateLimit = simpleRateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  keyGenerator: (req) => {
    const username = req?.body?.username ? String(req.body.username).toLowerCase().trim() : '';
    return `${req.ip}|${username}`;
  },
});

// 中间件
app.use(securityHeaders);
app.use((req, res, next) => {
  const id = req.headers['x-request-id'] ? String(req.headers['x-request-id']).slice(0, 80) : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(httpLog());

// 同域部署：生产环境默认不需要 CORS。
// 若未来前端单独部署，可通过 CORS_ORIGIN 配置白名单（逗号分隔）。
const corsOriginRaw = process.env.CORS_ORIGIN ? String(process.env.CORS_ORIGIN) : '';
const corsAllowList = corsOriginRaw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  // 本地开发常见入口（Vite 端口被占用时会用 5174、5175…）
  corsAllowList.push('http://localhost:5173', 'http://127.0.0.1:5173');
}

/** 非生产：允许本机任意端口的前端（避免仅白名单 5173 时换端口即 CORS 失败） */
function isDevLoopbackOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  } catch {
    return false;
  }
}

if (corsAllowList.length > 0) {
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (corsAllowList.includes(origin)) return cb(null, true);
        if (isDevLoopbackOrigin(origin)) return cb(null, true);
        // 勿 cb(Error)：会变成未捕获异常，客户端看到 500 且难排查
        console.warn(`CORS blocked for origin: ${origin}`);
        return cb(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
}

// 登录接口防爆破（只对 /api/auth/login 生效）
app.use('/api/auth/login', loginRateLimit);

// 探活与指标（需在其它 /api 子路由之前注册，以便未匹配请求继续向下传递）
app.use('/api', healthRoutes);

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/exam-sessions', examSessionRoutes);

// 未匹配的 /api 请求返回 JSON 404，避免误落到 SPA 的 index.html（前端曾把 HTML 当 JSON 解析）
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// 学生头像等上传文件（须在 dist 与 SPA fallback 之前，否则会被 index.html 吞掉）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 院校探索静态站（study-app 构建产物 → app/study-dist）
const studyDistPath = path.join(__dirname, '../study-dist');
if (fs.existsSync(studyDistPath)) {
  app.use('/study', express.static(studyDistPath));
  app.get(/^\/study(?:\/.*)?$/, (req, res) => {
    res.sendFile(path.join(studyDistPath, 'index.html'));
  });
}

// 静态文件服务（生产环境）
app.use(express.static(path.join(__dirname, '../dist')));

// 所有其他路由返回前端应用
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  const payload = {
    ts: new Date().toISOString(),
    level: 'error',
    msg: 'unhandled_error',
    path: req.originalUrl || req.url,
    request_id: req.id,
    error_name: err && err.name,
    error_message: err && err.message,
  };
  console.error(JSON.stringify(payload));
  console.error(err);
  captureSentryException(err, { requestId: req.id, path: req.originalUrl || req.url });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    request_id: req.id,
  });
});

// 初始化数据库并启动服务器（供 Electron await；命令行见文件末尾）
async function startServer() {
  // Fail-fast: 确保生产环境 JWT_SECRET 合规
  // eslint-disable-next-line no-unused-vars
  const _jwtSecret = getJwtSecret();
  await initDb();
  console.log('✓ Database connected\n');

  await new Promise((resolve, reject) => {
    const server = app.listen(PORT, HOST, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     A-Level Admission Management System Server               ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  API Server: http://${HOST === '0.0.0.0' ? '0.0.0.0' : HOST}:${PORT}                         ║
║  Database: SQLite                                             ║
║                                                              ║
║  首次建库种子账号（口令可被 SEED_* 环境变量覆盖，见 doc）：    ║
║    • admin / staff / supervisor 默认口令见代码或 reset 脚本  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
      `);
      resolve(server);
    });
    server.on('error', (err) => {
      reject(err);
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error.message || error);
    if (error && error.code === 'EADDRINUSE') {
      console.error(`\n端口 ${PORT} 已被占用，请关闭占用该端口的程序或设置环境变量 PORT 使用其他端口。`);
    } else {
      console.log('\nPlease check:');
      console.log('1. Run: node server/init-db.js to initialize the database');
      console.log('2. Run: node server/migrate-data.js to migrate data from JSON');
    }
    process.exit(1);
  });
}

module.exports = { app, startServer };
