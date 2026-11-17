#!/usr/bin/env bash
# One-shot bootstrap for the Wi-Fi Ads stack on a small Ubuntu VPS.
# Idempotent: safe to re-run after editing .env or nginx.conf.
#
# Usage:
#   cd ~/go-wifiads/deploy/vps
#   cp .env.production.example ../.env && nano ../.env
#   sudo bash setup.sh
set -euo pipefail

DOMAIN="wifiads.smartscales.web.id"
EMAIL="favcreamyy@gmail.com"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "jalankan pakai sudo"
[[ -f "$APP_DIR/.env" ]] || die "file $APP_DIR/.env belum ada. Copy dari deploy/vps/.env.production.example"
grep -qE '^[A-Z_]+=.*<CHANGE_ME>' "$APP_DIR/.env" && die ".env masih berisi <CHANGE_ME>, isi dulu semua nilainya"

# --- nginx + certbot (only what a 1 GB host can afford) ----------------------
log "Install nginx, certbot, git"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx git >/dev/null

# --- nginx site -------------------------------------------------------------
log "Pasang konfigurasi nginx"
install -d /var/www/html
install -Dm644 "$VPS_DIR/wifiads-proxy.conf" /etc/nginx/snippets/wifiads-proxy.conf

# The TLS server block references certificates and the options-ssl file that
# certbot only creates after issuing. Until then, serve a plain HTTP responder
# so the ACME challenge can complete.
HAS_CERT=0
if [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  HAS_CERT=1
  install -Dm644 "$VPS_DIR/nginx.conf" /etc/nginx/sites-available/wifiads
else
  log "Belum ada sertifikat -> pasang konfigurasi HTTP sementara"
  cat >/etc/nginx/sites-available/wifiads <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 200 'wifiads bootstrapping'; add_header Content-Type text/plain; }
}
EOF
fi

ln -sf /etc/nginx/sites-available/wifiads /etc/nginx/sites-enabled/wifiads
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# --- TLS --------------------------------------------------------------------
if [[ $HAS_CERT -eq 0 ]]; then
  log "Terbitkan sertifikat Let's Encrypt untuk $DOMAIN"
  certbot certonly --webroot -w /var/www/html -d "$DOMAIN" \
    --email "$EMAIL" --agree-tos --non-interactive --keep-until-expiring
  install -Dm644 "$VPS_DIR/nginx.conf" /etc/nginx/sites-available/wifiads
  nginx -t
  systemctl reload nginx
else
  log "Sertifikat sudah ada, lewati penerbitan"
fi

# Renewal hook so nginx picks up a rotated certificate.
install -d /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

# --- containers -------------------------------------------------------------
log "Build image aplikasi"
cd "$VPS_DIR"
ln -sfn "$APP_DIR/.env" .env
docker compose build api

log "Jalankan stack"
docker compose up -d

log "Tunggu API sehat"
for i in {1..30}; do
  if curl -fsS -m 3 http://127.0.0.1:8080/health/live >/dev/null 2>&1; then
    log "API sehat"
    break
  fi
  [[ $i -eq 30 ]] && die "API tidak sehat setelah 30 percobaan. Cek: docker compose logs api"
  sleep 2
done

log "Selesai. Buka https://$DOMAIN/admin"
docker compose ps
