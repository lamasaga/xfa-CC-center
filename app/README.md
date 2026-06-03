# A-Level 升学管理 · `app` 目录说明

　　本目录为**单体 Web 应用**：前端 **Vite + React + TypeScript**，后端 **Express（CommonJS）+ SQLite（better-sqlite3）**。仓库根目录另有汇总文档 **`../doc/`**（部署、备份、安全、可观测性等），**以 `../doc/README.md` 为文档索引**。

---

## 1. 给后续维护者 / Agent 的速览

| 项目 | 说明 |
|------|------|
| 前端入口 | `src/main.tsx`，路由与页面在 `src/` |
| 后端入口 | `server/index.js`（监听 `PORT`，默认 `3001`） |
| 数据库 | `server/db.js` 在加载时连接 SQLite；路径见下文 `SQLITE_PATH` |
| 首次建库 | `initDb()` 在 `server/db.js`：空库建表、种子用户、轻量迁移 |
| 权限模型 | `admin` / `staff` / `supervisor` / `student`；中间件见 `server/middleware/auth.js` |
| API 前缀 | `/api/*`；探活与健康见 `server/routes/health.js`（`/api/health`、`/api/metrics`） |

　　**不要**再假设文档里的旧账号体系为主力：`editor` / `viewer` 为历史数据或旧脚本残留；当前产品与种子账号以 **`admin` / `staff` / `supervisor`** 为准（首次空库默认弱口令见 `db.js`，生产请用环境变量或 `reset-staff-passwords`）。

---

## 2. 环境要求

- **Node.js**：建议使用 LTS；切换 **主版本**后必须对原生模块重建（见 §7）。
- **包管理**：`npm`（`package-lock.json` 在 `app` 下）。
- **操作系统**：常在 **Windows（PowerShell）** 开发；部署多为 Linux（详见 `../doc/部署指南.md`）。

---

## 3. 安装与本地启动（PowerShell）

```powershell
Set-Location "d:\…\Alevelinfo\app"
npm install
npm start
```

- **`npm start`**：`concurrently` 同时跑 **`npm run server`**（Express + `--watch`）与 **`npm run dev`**（Vite，默认 `http://localhost:5173`）。
- **`npm run start:lan`**：后端 `HOST=0.0.0.0` + Vite `--host 0.0.0.0`，便于局域网调试。

　　亦可双击 **`app/start.bat`**：等价于在 `app` 内首次无 `node_modules` 时执行 `npm install` 再 `npm start`。该批处理**正文保持纯英文**，避免 `cmd.exe` 按系统代码页解析 UTF-8 中文时破坏 `if (...)` 语法。

　　浏览器打开 **http://localhost:5173**；API 默认 **http://127.0.0.1:3001**。若端口被占用，以终端实际输出为准（Vite 可能递增端口）。

---

## 4. `npm` 脚本一览

| 脚本 | 作用 |
|------|------|
| `npm start` | 后端 + 前端联调 |
| `npm run server` / `server:lan` | 仅后端 |
| `npm run dev` / `dev:lan` | 仅前端 |
| `npm run build` | `tsc -b` + Vite 生产构建，输出 `dist/` |
| `npm run preview` | 预览构建结果 |
| `npm run lint` | ESLint |
| `npm run test:api` | Node 内置 test + supertest，临时 SQLite，不污染开发库 |
| `npm run native:node` | **`npm rebuild better-sqlite3`**，换 Node 大版本后必做 |
| `npm run reset-staff-passwords` | 重置 `admin`/`staff`/`supervisor` 强口令并写 `../doc/运营账号口令-本地留存.md`（勿提交） |
| `npm run student:create-login` | 学生登录相关脚本（见 `server/scripts/create-student-login.cjs`） |

　　历史/一次性数据迁移：`node server/migrate-data.js`（依赖 `database.json` 等，新环境未必需要）。

---

## 5. 环境变量（常用）

| 变量 | 说明 |
|------|------|
| `SQLITE_PATH` | SQLite 文件绝对或相对路径；未设置时默认为 **`app/database.sqlite`**（相对 `server/db.js` 解析） |
| `JWT_SECRET` | JWT 密钥；**生产环境必填**且长度建议 ≥32，见 `server/config.js` |
| `PORT` / `HOST` | 后端端口与绑定地址 |
| `NODE_ENV` | `production` 时启用更严格校验（如 JWT、静态资源策略） |
| `CORS_ORIGIN` | 生产跨域白名单（逗号分隔）。**非生产**下除白名单外，还允许 **`localhost` / `127.0.0.1` / `::1` 任意端口**，避免 Vite 改用 5174 等端口时登录被 CORS 拦截 |
| `DEFAULT_STUDENT_INITIAL_PASSWORD` | 教务新建学生时的初始登录密码（默认见 `server/config.js`） |
| `SEED_*_PASSWORD` | 仅**首次空库**种子用户：`SEED_ADMIN_PASSWORD`、`SEED_STAFF_PASSWORD`、`SEED_SUPERVISOR_PASSWORD` |
| `HTTP_LOG_SLOW_MS` | 结构化 HTTP 日志慢请求阈值（毫秒） |
| `METRICS_TOKEN` | 设置后 `/api/metrics` 需带 Token，见 `../doc/工程质量与可观测性.md` |
| `SENTRY_DSN` 等 | 可选错误上报，同见可观测性文档 |

---

## 6. 目录结构（`app` 内）

| 路径 | 说明 |
|------|------|
| `src/` | 前端页面、组件、`services/api.ts` 等与后端对接 |
| `server/index.js` | Express 应用、中间件顺序、静态 `dist`、全局错误处理 |
| `server/db.js` | SQLite 连接、`initDb`、迁移与兼容逻辑 |
| `server/init-db.js` | 建表 SQL 字符串（被 `db.js` 解析执行） |
| `server/routes/` | 各业务路由模块 |
| `server/middleware/` | 鉴权、HTTP 日志、指标等 |
| `server/telemetry/` | Sentry 可选封装 |
| `server/scripts/` | 运维/重置口令等 `.cjs` 脚本 |
| `server/test/` | API 冒烟测试 |
| `database.sqlite` | 本地运行时库（勿误删；备份见 `../doc/服务器数据库备份与维护.md`） |
| `database.json` | 旧迁移数据源，供 `migrate-data.js` |

---

## 7. 故障排查（红字 / 起不来）

1. **`better-sqlite3` / `NODE_MODULE_VERSION` / `ERR_DLOPEN_FAILED`**  
   　在 **`app` 目录**执行：`npm run native:node`（与 `npm rebuild better-sqlite3` 相同）。**每次 `npm install` 后** `package.json` 里的 `postinstall` 也会自动重建一次；若仍红字，请先 **完全退出** `npm start`（Ctrl+C，必要时结束残留 `node.exe`），再重新启动——`node --watch` 在原生模块报错后有时不会替你换好新的 `.node` 文件。  
   　若 `postinstall` 在你的机器上编译失败，需安装 **Desktop development with C++**（Visual Studio Build Tools）等环境，或临时用 `npm install --ignore-scripts` 后再手动 `npm run native:node`。

2. **端口占用**  
   　关闭多余的 `node` / 旧终端；Windows 可在任务管理器结束残留 `node.exe`。

3. **生产启动失败**  
   　检查是否缺少 `JWT_SECRET` 或过短，见 `server/config.js` 抛错信息。

---

## 8. 与仓库文档的衔接

| 文档 | 路径 |
|------|------|
| 文档总索引 | [`../doc/README.md`](../doc/README.md) |
| 部署（含 Docker） | [`../doc/部署指南.md`](../doc/部署指南.md) |
| 备份与 SQLite 维护 | [`../doc/服务器数据库备份与维护.md`](../doc/服务器数据库备份与维护.md) |
| 安全与角色 | [`../doc/安全与账号机制科普.md`](../doc/安全与账号机制科普.md) |
| 运营账号强口令 | [`../doc/运营账号口令说明.md`](../doc/运营账号口令说明.md) |
| 日志 / 探活 / Sentry / 指标 | [`../doc/工程质量与可观测性.md`](../doc/工程质量与可观测性.md) |

　　更旧的总览与迁移记录部分在 [`../doc/历史文档/`](../doc/历史文档/)（如旧版 `项目.md`、`RECOVERY_PLAN.md`）。

---

## License

MIT
