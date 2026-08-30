#!/usr/bin/env bash
# 服务器原子化更新：在线一致性备份 → 生产库副本迁移演练 → 短暂停服切换 → 健康检查 → 失败自动回滚。
# 环境变量：APP、TAR、SERVICE_NAME、RELEASE_ID
set -euo pipefail

APP="${APP:-/opt/alevelinfo/app}"
TAR="${TAR:-/tmp/alevelinfo-deploy.tgz}"
SERVICE_NAME="${SERVICE_NAME:-alevelinfo}"
RELEASE_ID="${RELEASE_ID:-$(date +%Y%m%d-%H%M%S)}"
BASE_DIR="$(dirname "$APP")"
BACKUP_DIR="$BASE_DIR/backup"
RELEASE_DIR="$BASE_DIR/releases/$RELEASE_ID"
RELEASE_APP="$RELEASE_DIR/app"
ROLLBACK_DIR="$BASE_DIR/rollback/$RELEASE_ID"
ROLLBACK_APP="$ROLLBACK_DIR/app"
SOURCE_DB="$APP/database.sqlite"
PREFLIGHT_BACKUP="$BACKUP_DIR/database.sqlite.preflight-$RELEASE_ID.bak"
FINAL_BACKUP="$BACKUP_DIR/database.sqlite.pre-deploy-$RELEASE_ID.bak"
MIGRATION_CHECK="$RELEASE_DIR/migration-check.sqlite"
DOWNTIME_STARTED=0

case "$APP" in
  /opt/alevelinfo/*) ;;
  *) echo "ERROR: APP 必须位于 /opt/alevelinfo 内，当前为 $APP"; exit 1 ;;
esac
case "$TAR" in
  /tmp/*) ;;
  *) echo "ERROR: TAR 必须位于 /tmp 内，当前为 $TAR"; exit 1 ;;
esac
[[ -f "$TAR" ]] || { echo "ERROR: 找不到压缩包: $TAR"; exit 1; }
[[ -d "$APP" ]] || { echo "ERROR: 应用目录不存在: $APP"; exit 1; }
command -v rsync >/dev/null || { echo "ERROR: 服务器需要 rsync 才能进行可回滚切换"; exit 1; }

RUN_USER="${SUDO_USER:-${USER:-ubuntu}}"
if [[ "$RUN_USER" == "root" ]]; then RUN_USER=ubuntu; fi
RUN_HOME="$(getent passwd "$RUN_USER" | cut -d: -f6)"
[[ -n "$RUN_HOME" ]] || { echo "ERROR: 无法解析部署用户 $RUN_USER 的主目录"; exit 1; }

sudo install -d -m 700 -o "$RUN_USER" -g "$RUN_USER" "$BACKUP_DIR"
sudo install -d -m 755 -o "$RUN_USER" -g "$RUN_USER" "$RELEASE_APP" "$ROLLBACK_DIR"

backup_database() {
  local destination="$1"
  [[ -f "$SOURCE_DB" ]] || { echo "ERROR: 找不到数据库 $SOURCE_DB"; return 1; }
  [[ -d "$APP/node_modules/better-sqlite3" ]] || { echo "ERROR: 当前应用缺少 better-sqlite3，无法创建一致性备份"; return 1; }
  cd "$APP"
  node - "$SOURCE_DB" "$destination" <<'NODE'
const Database = require('./node_modules/better-sqlite3');
const source = process.argv[2];
const destination = process.argv[3];
const db = new Database(source, { readonly: true, fileMustExist: true });
db.pragma('busy_timeout = 10000');
db.backup(destination).then(() => {
  db.close();
  const snapshot = new Database(destination, { readonly: true, fileMustExist: true });
  const integrity = snapshot.pragma('integrity_check').map((row) => row.integrity_check);
  snapshot.close();
  if (integrity.length !== 1 || integrity[0] !== 'ok') throw new Error(`backup integrity failed: ${integrity.join(',')}`);
  console.log(`BACKUP_INTEGRITY=ok PATH=${destination}`);
}).catch((error) => { try { db.close(); } catch (_) {} console.error(error); process.exit(1); });
NODE
  chmod 600 "$destination"
  sha256sum "$destination"
}

rollback_release() {
  trap - ERR
  echo "==> 健康检查失败，开始自动回滚"
  sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  if [[ -d "$ROLLBACK_APP" && -f "$FINAL_BACKUP" ]]; then
    sudo rsync -a --delete "$ROLLBACK_APP/" "$APP/"
    sudo rm -f "$APP/database.sqlite" "$APP/database.sqlite-wal" "$APP/database.sqlite-shm"
    sudo cp "$FINAL_BACKUP" "$APP/database.sqlite"
    sudo chown -R "$RUN_USER:$RUN_USER" "$APP"
    sudo systemctl start "$SERVICE_NAME"
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
      echo "ROLLBACK_STATUS=active DATABASE=$FINAL_BACKUP"
    else
      echo "ROLLBACK_STATUS=failed，请立即检查 systemctl status 与 journalctl"
    fi
  else
    echo "ROLLBACK_STATUS=unavailable，回滚目录或最终数据库备份缺失"
  fi
}

on_error() {
  local exit_code=$?
  if [[ "$DOWNTIME_STARTED" -eq 1 ]]; then rollback_release; fi
  exit "$exit_code"
}
trap on_error ERR

echo "==> [1/8] 在线创建预检数据库一致性备份（服务保持运行）"
backup_database "$PREFLIGHT_BACKUP"

echo "==> [2/8] 解压候选版本到独立发布目录"
tar -xzf "$TAR" -C "$RELEASE_APP"
sudo chown -R "$RUN_USER:$RUN_USER" "$RELEASE_DIR"

echo "==> [3/8] 在独立目录安装依赖并构建（服务保持运行）"
sudo -u "$RUN_USER" env HOME="$RUN_HOME" bash -lc "
  set -euo pipefail
  cd \"$RELEASE_APP\"
  command -v npm >/dev/null
  npm ci
  npm run build
  npm rebuild better-sqlite3
"

echo "==> [4/8] 使用生产备份副本演练新迁移并做完整性检查"
cp "$PREFLIGHT_BACKUP" "$MIGRATION_CHECK"
cd "$RELEASE_APP"
node - "$MIGRATION_CHECK" "$RELEASE_APP" <<'NODE'
const Database = require('./node_modules/better-sqlite3');
const dbPath = process.argv[2];
const releaseApp = process.argv[3];
const { runMigrations } = require(`${releaseApp}/server/run-migrations`);
const db = new Database(dbPath, { fileMustExist: true });
db.pragma('foreign_keys = ON');
runMigrations(db);
const integrity = db.pragma('integrity_check').map((row) => row.integrity_check);
const migrations = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
db.close();
if (integrity.length !== 1 || integrity[0] !== 'ok') throw new Error(`migration integrity failed: ${integrity.join(',')}`);
console.log(`MIGRATION_DRY_RUN=ok VERSIONS=${migrations.map((row) => row.version).join(',')}`);
NODE
rm -f "$MIGRATION_CHECK"

echo "==> [5/8] 保存当前完整应用目录用于回滚"
sudo cp -a "$APP" "$ROLLBACK_APP"
sudo chown -R "$RUN_USER:$RUN_USER" "$ROLLBACK_DIR"

echo "==> [6/8] 短暂停服并创建最终数据库备份"
sudo systemctl stop "$SERVICE_NAME"
DOWNTIME_STARTED=1
backup_database "$FINAL_BACKUP"

echo "==> [7/8] 切换候选版本（保留数据库、上传文件与环境配置）"
sudo rsync -a --delete \
  --exclude='database.sqlite' \
  --exclude='database.sqlite-wal' \
  --exclude='database.sqlite-shm' \
  --exclude='uploads/' \
  --exclude='.env' \
  --exclude='.env.*' \
  "$RELEASE_APP/" "$APP/"
sudo chown -R "$RUN_USER:$RUN_USER" "$APP"

echo "==> [8/8] 启动服务并执行健康检查"
if ! sudo systemctl start "$SERVICE_NAME"; then
  rollback_release
  exit 1
fi

healthy=0
for attempt in 1 2 3 4 5 6; do
  if sudo systemctl is-active --quiet "$SERVICE_NAME" && curl --fail --silent --show-error --max-time 5 http://127.0.0.1:3001/api/health >/tmp/alevelinfo-health-$RELEASE_ID.json; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "$healthy" -ne 1 ]]; then
  sudo journalctl -u "$SERVICE_NAME" -n 80 --no-pager || true
  rollback_release
  exit 1
fi

DOWNTIME_STARTED=0

echo "DEPLOY_STATUS=success RELEASE=$RELEASE_ID"
echo "DATABASE_BACKUP=$FINAL_BACKUP"
echo "ROLLBACK_APP=$ROLLBACK_APP"
cat /tmp/alevelinfo-health-$RELEASE_ID.json
rm -f /tmp/alevelinfo-health-$RELEASE_ID.json "$TAR"
