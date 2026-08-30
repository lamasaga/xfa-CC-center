#!/usr/bin/env bash
# 为仅有公网 IP 的部署启用 Let's Encrypt 短期证书；要求 Certbot >= 5.4。
set -euo pipefail

PUBLIC_IP="${1:-}"
[[ "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || {
  echo "用法: $0 <公网 IPv4>"
  exit 1
}

command -v certbot >/dev/null || { echo "ERROR: 需要 Certbot 5.4 或更高版本"; exit 1; }
command -v nginx >/dev/null || { echo "ERROR: 找不到 nginx"; exit 1; }

WEBROOT="/var/www/letsencrypt"
SITE="/etc/nginx/sites-available/alevelinfo.conf"
BACKUP="${SITE}.pre-https-$(date +%Y%m%d-%H%M%S).bak"
CERT_DIR="/etc/letsencrypt/live/$PUBLIC_IP"

sudo cp -a "$SITE" "$BACKUP"
sudo install -d -m 755 "$WEBROOT/.well-known/acme-challenge"

TEMP_HTTP="$(mktemp)"
TEMP_HTTPS="$(mktemp)"
cleanup() { rm -f "$TEMP_HTTP" "$TEMP_HTTPS"; }
trap cleanup EXIT

cat >"$TEMP_HTTP" <<NGINX
server {
    listen 80;
    server_name _;

    location ^~ /.well-known/acme-challenge/ {
        root $WEBROOT;
        default_type text/plain;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

sudo install -m 644 "$TEMP_HTTP" "$SITE"
sudo nginx -t
sudo systemctl reload nginx

sudo certbot certonly \
  --preferred-profile shortlived \
  --webroot \
  --webroot-path "$WEBROOT" \
  --ip-address "$PUBLIC_IP" \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email

cat >"$TEMP_HTTPS" <<NGINX
server {
    listen 80;
    server_name _;

    location ^~ /.well-known/acme-challenge/ {
        root $WEBROOT;
        default_type text/plain;
    }

    location / {
        return 308 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_timeout 1d;
    ssl_session_cache shared:alevelinfo_tls:10m;
    ssl_session_tickets off;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

sudo install -m 644 "$TEMP_HTTPS" "$SITE"
sudo nginx -t
sudo systemctl reload nginx

sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/usr/bin/env bash' 'systemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx >/dev/null
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx

echo "HTTPS_STATUS=enabled URL=https://$PUBLIC_IP/ CONFIG_BACKUP=$BACKUP"
