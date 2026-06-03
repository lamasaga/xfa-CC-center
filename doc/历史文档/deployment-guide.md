# A-Level 升学管理系统 — 公网部署指南

面向：**单机开发已完成，希望将同一套 Node + Express + SQLite 应用部署到云服务器**，通过域名 HTTPS 访问。可按阶段执行，不必一次做完。

---

## 一、架构与发布形态（你需要先明确的）

当前应用形态：

- **构建后**：Vite 产出静态文件目录 `app/dist/`；Express 在 `server/index.js` 中既提供 `/api/*`，又用 `express.static` 托管 `dist`，并 `sendFile` 返回 `index.html`（单页应用）。
- **开发时**：前端跑在 5173，通过 Vite 代理把 `/api` 转到 3001；**生产环境**应只暴露 **一个** HTTP 端口（默认 3001），由 Express 同时服务页面与 API（与开发机「双端口」不同）。

**推荐生产访问路径：**

```text
用户浏览器 → HTTPS（443）→ Nginx 反向代理 → Node（127.0.0.1:3001）→ Express + dist + SQLite
```

SQLite 数据文件需落在服务器磁盘固定路径，并做好备份与权限控制。

---

## 二、部署前检查清单（代码与配置）

1. **在服务器上执行构建**（或与 CI 一致的环境构建后上传 `dist/`）  
   - 在 `app` 目录：`npm ci` 或 `npm install`  
   - `npm run build` 生成 `dist/`  
   - `npm run native:node`（即 `npm rebuild better-sqlite3`）在 **目标系统** 上编译原生模块（Linux 与 Windows 二进制不同，必须在部署机或同架构 Docker 内执行）。

2. **环境变量（至少）**  
   - `NODE_ENV=production`  
   - `JWT_SECRET`：强随机字符串，**勿使用仓库默认值**  
   - `PORT`：如 `3001`（或与 Nginx upstream 一致）  
   - `HOST`：监听地址。对外部署时通常设为 **`0.0.0.0`**，否则只监听本机回环时，Nginx 无法从本机转发到 Node（本仓库 `server/index.js` 支持 `HOST` 环境变量）。

3. **HTTPS 与 Cookie**  
   若未来使用 Cookie 会话，需 `Secure`/`SameSite` 等策略；当前为 JWT 存 localStorage，主要依赖 **HTTPS** 防窃听。

4. **CORS**  
   生产环境页面与 API **同源**（同一域名、由 Express 提供）时，一般无需额外 CORS。若前后端分域名，需在 `server` 中配置允许的 `Origin`。

---

## 三、推荐部署流程（VPS + Ubuntu 系为例）

### 阶段 A：准备服务器

1. 购买云主机（1 核 2G 可起步，视并发与数据库大小调整）。  
2. 绑定域名，DNS **A 记录** 指向服务器公网 IP。  
3. 防火墙：**仅开放** 22（SSH）、80（HTTP）、443（HTTPS）；不要直接暴露非标准端口给公网（Node 只监听内网或 127.0.0.1，由 Nginx 对外）。

### 阶段 B：安装运行环境

1. 安装 **Node.js LTS**（建议使用 [nvm](https://github.com/nvm-sh/nvm) 或发行版自带方式，版本与开发环境尽量接近）。  
2. 安装 **Nginx**：`sudo apt install nginx`（包名以实际系统为准）。  
3. 将项目代码同步到服务器（`git clone`、SFTP、或 CI 制品），在 **`app`** 目录安装依赖并构建（见第二节）。

### 阶段 C：进程守护（PM2 示例）

使用 PM2 可在崩溃后自动重启、开机自启：

```bash
cd /path/to/Alevelinfo/app
npm install
npm run build
npm rebuild better-sqlite3
sudo npm i -g pm2
```

编写启动命令（Linux 下设置环境变量示例）：

```bash
export NODE_ENV=production
export HOST=0.0.0.0
export PORT=3001
export JWT_SECRET='请替换为长随机串'
node server/index.js
```

用 PM2 托管（示例）：

```bash
pm2 start server/index.js --name alevelinfo --cwd /path/to/Alevelinfo/app
pm2 save
pm2 startup
```

确保工作目录下有 **`dist/`** 与 **`database.sqlite`**（及 `init-db` 等初始化流程是否已在首次部署执行）。

### 阶段 D：Nginx 反向代理与 HTTPS

1. **Nginx** 监听 443，`proxy_pass` 到 `http://127.0.0.1:3001`。  
2. 使用 **Let’s Encrypt**（`certbot`）申请证书，自动续期。  
3. 将 HTTP 重定向到 HTTPS。

配置要点（示意，勿直接复制为唯一真理，需按域名与路径调整）：

```nginx
server {
    listen 443 ssl http2;
    server_name your.domain.com;

    ssl_certificate     /etc/letsencrypt/live/your.domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 阶段 E：数据库与备份

- **SQLite 文件**路径：默认在 `app/database.sqlite`（与 `server` 相对路径相关，部署时保持工作目录一致）。  
- **备份**：定时任务（cron）复制 `database.sqlite` 到异地或对象存储；备份前可用 SQLite `VACUUM` 或确保应用无写入窗口（小规模可短时停服务后备份）。  
- **权限**：仅运行 Node 的系统用户可读写该文件。

### 阶段 F：上线后验证

- 首页与登录页可打开，静态资源 200。  
- 登录后 API 正常，`/api` 无 404/500。  
- 强制 HTTPS 后功能仍正常。

---

## 四、可选方案：Docker

若希望环境可复现、便于换机器：

- 用官方 Node 镜像，在镜像内 `npm install`、`npm run build`、`npm rebuild better-sqlite3`。  
- 将 `database.sqlite` 挂卷到宿主机持久化。  
- 仍建议前面加 **Nginx + HTTPS** 或云平台负载均衡终止 TLS。

---

## 五、与「桌面 Electron 打包」的关系

历史桌面版通过 Electron 内嵌页面与后端；**公网部署不需要 Electron**。当前仓库已移除桌面打包脚本与依赖，部署焦点是 **Node + 构建产物 + SQLite + 反向代理**。

Electron 时期的踩坑记录见 [历史文档/electron-packaging-guide.md](./历史文档/electron-packaging-guide.md)，仅供对照，不参与线上发布。

---

## 六、常见问题

| 现象 | 可能原因 | 处理方向 |
|------|----------|----------|
| `better-sqlite3` 报错 | 服务器架构与本地不同，未在服务器上 rebuild | 在服务器执行 `npm rebuild better-sqlite3` |
| 外网无法访问 | `HOST` 为 127.0.0.1 或防火墙未放行 | `HOST=0.0.0.0`；云安全组放行 80/443 |
| 页面空白、资源 404 | 未执行 `npm run build` 或工作目录不对 | 确认 `dist` 存在且 `pm2`/`node` 工作目录为 `app` |
| API 401 大面积出现 | `JWT_SECRET` 变更或环境不一致 | 统一密钥并重新登录 |

---

## 七、建议的后续增强（非必须）

- 使用 **PostgreSQL / MySQL** 替代 SQLite，便于多实例与托管数据库备份（需改 `server/db` 层，工作量较大）。  
- CI/CD：GitHub Actions 推送后自动测试、构建、部署。  
- 监控与日志：PM2 日志轮转、或接入云监控。

按上述顺序完成 **构建 → 环境变量 → 进程守护 → Nginx + HTTPS → 备份**，即可完成一次标准的中小型 Node 全栈站点上线。
