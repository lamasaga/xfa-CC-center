#!/usr/bin/env bash
# 在服务器上执行：解压覆盖代码、安装依赖、构建、重启 systemd。
# 环境变量：APP、TAR、SERVICE_NAME（systemd 单元名，默认 alevelinfo）
set -euo pipefail

APP="${APP:-/opt/alevelinfo/app}"
TAR="${TAR:-/tmp/alevelinfo-deploy.tgz}"
SERVICE_NAME="${SERVICE_NAME:-alevelinfo}"

if [[ ! -f "$TAR" ]]; then
  echo "ERROR: 找不到压缩包: $TAR"
  exit 1
fi
if [[ ! -d "$APP" ]]; then
  echo "ERROR: 应用目录不存在: $APP"
  exit 1
fi

# 以可写应用目录的用户执行 npm（一般为 ubuntu）
RUN_USER="${SUDO_USER:-${USER:-ubuntu}}"
if [[ "$RUN_USER" == "root" ]]; then
  RUN_USER=ubuntu
fi

echo "==> 停止服务 $SERVICE_NAME（避免覆盖时文件被占用）"
sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true

echo "==> 备份 SQLite（若存在）"
if [[ -f "$APP/database.sqlite" ]]; then
  cp "$APP/database.sqlite" "$APP/database.sqlite.bak-$(date +%F-%H%M%S)"
  echo "    已写入: $APP/database.sqlite.bak-$(date +%F)*"
fi

echo "==> 解压覆盖到 $APP（不删除库与 uploads 等未打包文件）"
cd "$APP"
tar -xzf "$TAR"

echo "==> 修正属主（按需）"
if id "$RUN_USER" &>/dev/null; then
  sudo chown -R "$RUN_USER:$RUN_USER" "$APP" || true
fi

echo "==> npm ci / build / rebuild better-sqlite3"
cd "$APP"
sudo -u "$RUN_USER" env HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)" bash -lc "
  set -e
  cd \"$APP\"
  command -v npm >/dev/null || { echo 'ERROR: 未找到 npm'; exit 1; }
  npm ci
  npm run build
  npm rebuild better-sqlite3
"

echo "==> 启动服务 $SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"
sleep 1
sudo systemctl is-active "$SERVICE_NAME" && echo "==> 服务状态: active" || {
  echo "ERROR: 服务未处于 active，请执行: sudo systemctl status $SERVICE_NAME -l --no-pager"
  exit 1
}

echo "==> 完成。可删除临时包: rm -f $TAR"
