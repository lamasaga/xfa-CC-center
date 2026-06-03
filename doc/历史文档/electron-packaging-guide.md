# Electron 桌面应用打包指南

> **存档说明：** 当前项目以浏览器 / 服务器部署为主，已不再维护 Electron 打包流程。以下内容仅保留作历史对照。  
> 适用于 Vite + React + Express + better-sqlite3 技术栈  
> 最后更新：2026-03-25

---

## 一、架构概述

```
打包后的应用结构：

A-Level升学管理.exe
├─ Electron 主进程 (electron/main.cjs)
│   ├─ 启动内嵌 Express 服务器 (server/index.js)
│   └─ 创建 BrowserWindow → 加载 http://127.0.0.1:3001/
├─ app.asar              ← 前端 dist/ + 服务端代码 + node_modules
├─ app.asar.unpacked/    ← 原生模块 (.node) 不能放入 asar
│   └─ node_modules/better-sqlite3/build/Release/better_sqlite3.node
└─ resources/            ← Electron 运行时
```

## 二、核心问题与解决方案

### 问题 1：better-sqlite3 ABI 不匹配

**症状**：打包后启动闪退，startup.log 报错 `NODE_MODULE_VERSION 137, requires 130`

**原因**：  
- 系统 Node.js（如 v24）编译的 `.node` 二进制使用 ABI 137
- Electron 33 内嵌的 Node.js 需要 ABI 130
- `@electron/rebuild` 和 `electron-builder install-app-deps` 在某些环境下不能正确替换二进制文件

**解决方案**：  
使用 `prebuild-install` 直接下载 Electron 专用预编译二进制：

```bash
cd node_modules/better-sqlite3
npx prebuild-install -r electron -t <ELECTRON_VERSION> --platform win32 --arch x64 --force
```

在 `package.json` 中配置：
```json
{
  "scripts": {
    "native:electron": "cd node_modules/better-sqlite3 && npx prebuild-install -r electron -t 33.4.11 --platform win32 --arch x64 --force && cd ../.."
  },
  "build": {
    "npmRebuild": false
  }
}
```

- `npmRebuild: false` 禁止 electron-builder 在打包时自动执行 `@electron/rebuild`（因其行为不可靠）
- `native:electron` 脚本在打包前手动安装正确的预编译二进制

### 问题 2：找不到 Express 等 server 依赖

**症状**：`Error: Cannot find module 'express'`

**原因**：服务端依赖原本在 `server/node_modules` 中，但 electron-builder 只打包根目录的 `node_modules`

**解决方案**：将所有服务端运行时依赖提升到根 `package.json` 的 `dependencies`：
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "better-sqlite3": "^12.8.0",
    "uuid": "^9.0.1"
  }
}
```

### 问题 3：首次启动数据库为空

**症状**：应用启动后 API 返回 500，数据库文件只有 4KB

**原因**：打包应用使用 `%APPDATA%\my-app\database.sqlite` 作为数据库路径，首次启动时是一个空文件

**解决方案**：在 `server/db.js` 的 `initDb()` 中自动检测并创建表结构和种子数据：
```javascript
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();
if (tables.length === 0) {
  // 从 init-db.js 提取建表 SQL 并执行
  // 创建默认用户
}
```

## 三、关键配置文件

### package.json build 配置

```json
{
  "build": {
    "appId": "com.alevelinfo.desktop",
    "productName": "A-Level升学管理",
    "npmRebuild": false,
    "asar": true,
    "asarUnpack": [
      "**/*.node",
      "**/node_modules/better-sqlite3/**"
    ],
    "files": [
      "dist/**/*",
      "electron/**/*",
      "server/**/*",
      "package.json",
      "node_modules/**/*"
    ],
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ]
    }
  }
}
```

重点说明：
- `npmRebuild: false`：禁用自动原生模块重建（由我们手动控制）
- `asarUnpack`：原生 `.node` 文件必须从 asar 归档中解包，否则无法动态加载
- `files`：明确包含 `node_modules/**/*`，确保所有依赖被打包

### electron/main.cjs 关键逻辑

1. 设置 `SQLITE_PATH` 为 `%APPDATA%\my-app\database.sqlite`（生产模式）
2. `require('server/index.js')` 并 `await startServer()` 等待服务器就绪
3. 创建 BrowserWindow 加载 `http://127.0.0.1:3001/`
4. 所有错误写入 `startup.log` 并弹出错误对话框

## 四、打包步骤（操作手册）

### 前置条件
- Node.js v20+
- 项目已能通过 `npm run start` 正常运行

### 步骤

```bash
# 1. 进入 app 目录
cd app

# 2. 安装依赖
npm install

# 3. 为系统 Node 重建 better-sqlite3（确保 server 开发正常）
npm run native:node

# 4. 验证 Web 版正常
npm run start
# → 浏览器访问 http://localhost:5173 确认可用

# 5. 快速打包验证（生成目录版，不生成安装包）
npm run electron:pack
# → 启动 release/win-unpacked/A-Level升学管理.exe 确认可用

# 6. 正式打包（生成 NSIS 安装包 + 便携版）
npm run dist:desktop
# → 产物在 release/ 目录
```

### 验证清单

| 检查项 | 方法 |
|--------|------|
| 应用启动不闪退 | 双击 exe，窗口持续显示 |
| 无 startup.log 错误 | 检查 `%APPDATA%\my-app\startup.log` 不存在 |
| 服务器正常运行 | 浏览器打开 `http://127.0.0.1:3001/api/auth/login` 返回 405 |
| 可正常登录 | 在应用界面输入 admin / admin123 |
| 数据库正常 | `%APPDATA%\my-app\database.sqlite` 存在且 > 4KB |

## 五、常见故障排查

| 症状 | 可能原因 | 排查方法 |
|------|----------|----------|
| 双击无反应 | 端口 3001 被占用 | `netstat -ano \| findstr 3001` |
| 闪退 | ABI 不匹配 | 查看 `%APPDATA%\my-app\startup.log` |
| 登录 500 | 数据库未初始化 | 删除 `%APPDATA%\my-app\database.sqlite` 后重启 |
| 找不到模块 | 依赖未打包 | 确认依赖在根 `package.json` 的 `dependencies` 中 |
| 第二次打开无响应 | 单例锁 | 任务管理器结束残留进程 |

## 六、npm scripts 说明

| 脚本 | 用途 |
|------|------|
| `npm run dev` | 前端开发服务器 |
| `npm run server` | 后端服务器（系统 Node ABI） |
| `npm run start` | 同时启动前后端 |
| `npm run native:node` | 为系统 Node 重建 better-sqlite3 |
| `npm run native:electron` | 为 Electron 安装 better-sqlite3 预编译二进制 |
| `npm run electron:dev` | Electron 开发模式（热重载） |
| `npm run electron:pack` | 快速打包（目录版，用于验证） |
| `npm run dist:desktop` | 正式打包（NSIS 安装包 + 便携版） |

## 七、注意事项

1. **切换开发/打包后需要重建原生模块**：
   - 运行 Web 版前：`npm run native:node`
   - 运行 Electron 版前：`npm run native:electron`
   - 打包脚本已自动包含此步骤

2. **升级 Electron 版本时**，必须同步更新 `native:electron` 脚本中的 `-t` 版本号

3. **添加新的服务端依赖时**，必须安装到根 `package.json`（不是 `server/package.json`）

4. **数据库文件位置**：
   - 开发：项目根目录 `database.sqlite`
   - 打包：`%APPDATA%\my-app\database.sqlite`（Windows）
