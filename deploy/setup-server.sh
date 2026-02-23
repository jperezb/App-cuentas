#!/usr/bin/env bash
#
# deploy/setup-server.sh
# Configura el servidor EC2 con Node.js, nginx, PM2, Let's Encrypt
#
# Uso:
#   ./deploy/setup-server.sh [IP]
#   (si no se pasa IP, la lee de deploy/.env.deploy)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Cargar variables
if [ -f "${SCRIPT_DIR}/.env.deploy" ]; then
  source "${SCRIPT_DIR}/.env.deploy"
fi

SERVER_IP="${1:-${ELASTIC_IP:-}}"
KEY="${KEY_FILE:-deploy/miscuentas-key.pem}"
DOMAIN="${DOMAIN:-cuentas.metadata.cl}"
SSH_USER="ec2-user"

if [ -z "${SERVER_IP}" ]; then
  echo "Error: proporciona la IP del servidor."
  echo "Uso: ./deploy/setup-server.sh <IP>"
  exit 1
fi

echo "══════════════════════════════════════════════════════"
echo " Configurando servidor: ${SERVER_IP}"
echo " Dominio: ${DOMAIN}"
echo "══════════════════════════════════════════════════════"

SSH_CMD="ssh -i ${KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${SSH_USER}@${SERVER_IP}"

# Esperar a que SSH esté disponible
echo "[→] Esperando conexión SSH..."
for i in $(seq 1 30); do
  if ${SSH_CMD} "echo ok" &>/dev/null; then
    echo "[✓] SSH disponible."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[✗] Timeout esperando SSH."
    exit 1
  fi
  sleep 5
done

# ── Enviar script de provisioning al servidor ──────────────────
cat <<'REMOTE_SCRIPT' | ${SSH_CMD} "cat > /tmp/provision.sh && chmod +x /tmp/provision.sh"
#!/usr/bin/env bash
set -euo pipefail

DOMAIN="$1"
APP_DIR="/home/ec2-user/app"

echo "──── Actualizando sistema ────"
sudo dnf update -y -q

echo "──── Instalando Node.js 22 LTS ────"
if ! command -v node &>/dev/null; then
  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
  sudo dnf install -y nodejs
fi
echo "Node.js $(node --version)"

echo "──── Instalando nginx ────"
sudo dnf install -y nginx
sudo systemctl enable nginx

echo "──── Instalando PM2 ────"
if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2
fi

echo "──── Instalando certbot ────"
if ! command -v certbot &>/dev/null; then
  sudo dnf install -y certbot python3-certbot-nginx
fi

echo "──── Instalando git ────"
sudo dnf install -y git

echo "──── Creando directorio app ────"
mkdir -p "${APP_DIR}"

echo "──── Configurando nginx ────"
sudo tee /etc/nginx/conf.d/miscuentas.conf > /dev/null <<NGINX_CONF
server {
    listen 80;
    server_name ${DOMAIN};

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
NGINX_CONF

# Eliminar el server block default si existe
sudo rm -f /etc/nginx/conf.d/default.conf
# Deshabilitar el default server en nginx.conf si lo tiene
if sudo grep -q "listen.*80.*default_server" /etc/nginx/nginx.conf; then
  sudo sed -i 's/listen\s*80\s*default_server/listen 80/' /etc/nginx/nginx.conf
  sudo sed -i 's/listen\s*\[::\]:80\s*default_server/listen [::]:80/' /etc/nginx/nginx.conf
fi

sudo nginx -t
sudo systemctl restart nginx

echo "──── Configurando PM2 startup ────"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user 2>/dev/null || true

echo "──── Configurando swap (free tier tiene poca RAM) ────"
if [ ! -f /swapfile ]; then
  sudo dd if=/dev/zero of=/swapfile bs=128M count=8 2>/dev/null
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "Swap de 1GB creado."
fi

echo "──── Servidor provisionado correctamente ────"
REMOTE_SCRIPT

# Ejecutar provisioning
echo "[→] Provisionando servidor (Node.js, nginx, PM2, certbot)..."
${SSH_CMD} "/tmp/provision.sh ${DOMAIN}"

echo ""
echo "══════════════════════════════════════════════════════"
echo " Servidor configurado correctamente"
echo "══════════════════════════════════════════════════════"
echo ""
echo " Siguiente paso: desplegar la aplicación"
echo "   ./deploy/deploy.sh"
echo ""
echo " Después del primer deploy, obtener certificado SSL:"
echo "   ssh -i ${KEY} ${SSH_USER}@${SERVER_IP}"
echo "   sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m tu@email.com"
echo ""
echo "══════════════════════════════════════════════════════"
