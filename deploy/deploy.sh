#!/usr/bin/env bash
#
# deploy/deploy.sh
# Despliega (o actualiza) la aplicación en el servidor EC2
#
# Uso:
#   ./deploy/deploy.sh           # deploy completo
#   ./deploy/deploy.sh --quick   # solo pull + restart (sin reinstalar deps)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "${SCRIPT_DIR}")"

# Cargar variables
if [ -f "${SCRIPT_DIR}/.env.deploy" ]; then
  source "${SCRIPT_DIR}/.env.deploy"
fi

SERVER_IP="${ELASTIC_IP:-}"
KEY="${KEY_FILE:-deploy/miscuentas-key.pem}"
DOMAIN="${DOMAIN:-cuentas.metadata.cl}"
SSH_USER="ec2-user"
APP_DIR="/home/ec2-user/app"
QUICK="${1:-}"

if [ -z "${SERVER_IP}" ]; then
  echo "Error: ejecuta setup-infra.sh primero, o crea deploy/.env.deploy"
  exit 1
fi

SSH_CMD="ssh -i ${KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${SERVER_IP}"
SCP_CMD="scp -i ${KEY} -o StrictHostKeyChecking=no"

echo "══════════════════════════════════════════════════════"
echo " Desplegando MisCuentas → ${DOMAIN}"
echo " Servidor: ${SERVER_IP}"
echo "══════════════════════════════════════════════════════"

# ── 1. Build local ────────────────────────────────────────────
echo "[→] Construyendo la aplicación localmente..."
cd "${PROJECT_DIR}"
npm ci --prefer-offline 2>/dev/null || npm install
npx next build

echo "[✓] Build completado."

# ── 2. Sincronizar archivos ───────────────────────────────────
echo "[→] Sincronizando archivos al servidor..."

# Crear archivo tar excluyendo node_modules, .git, mobile
tar czf /tmp/miscuentas-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='mobile' \
  --exclude='deploy/*.pem' \
  --exclude='deploy/.env.deploy' \
  -C "${PROJECT_DIR}" .

${SCP_CMD} /tmp/miscuentas-deploy.tar.gz "${SSH_USER}@${SERVER_IP}:/tmp/"
rm -f /tmp/miscuentas-deploy.tar.gz

echo "[✓] Archivos transferidos."

# ── 3. Instalar y reiniciar en el servidor ────────────────────
echo "[→] Instalando en el servidor..."

${SSH_CMD} <<DEPLOY_REMOTE
set -euo pipefail

APP_DIR="${APP_DIR}"
DOMAIN="${DOMAIN}"

# Extraer archivos
mkdir -p "\${APP_DIR}"
cd "\${APP_DIR}"
tar xzf /tmp/miscuentas-deploy.tar.gz
rm -f /tmp/miscuentas-deploy.tar.gz

# Instalar dependencias
echo "Instalando dependencias..."
npm ci --prefer-offline 2>/dev/null || npm install --production

# Crear .env.local si no existe
if [ ! -f .env.local ]; then
  cat > .env.local <<ENV
# Fintoc - Open Banking Chile (opcional)
# NEXT_PUBLIC_FINTOC_PUBLIC_KEY=tu_public_key
# FINTOC_SECRET_KEY=tu_secret_key

# App
NODE_ENV=production
PORT=3000
ENV
  echo "Archivo .env.local creado (edítalo para configurar Fintoc)."
fi

# Reiniciar con PM2
echo "Reiniciando aplicación..."
cd "\${APP_DIR}"

if pm2 describe miscuentas &>/dev/null; then
  pm2 restart miscuentas --update-env
else
  pm2 start npm --name miscuentas -- start
  pm2 save
fi

# Verificar que está corriendo
sleep 3
if pm2 show miscuentas | grep -q "online"; then
  echo "Aplicación corriendo correctamente."
else
  echo "Error: la aplicación no inició. Logs:"
  pm2 logs miscuentas --lines 20 --nostream
  exit 1
fi
DEPLOY_REMOTE

echo ""
echo "══════════════════════════════════════════════════════"
echo " Deploy completado"
echo "══════════════════════════════════════════════════════"
echo ""
echo "  URL:  http://${DOMAIN}"
echo "  IP:   http://${SERVER_IP}:3000"
echo ""
echo "  Para SSL (primera vez):"
echo "    ${SSH_CMD} \"sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m tu@email.com\""
echo ""
echo "  Logs en vivo:"
echo "    ${SSH_CMD} \"pm2 logs miscuentas\""
echo ""
echo "  Para re-desplegar:"
echo "    ./deploy/deploy.sh"
echo ""
echo "══════════════════════════════════════════════════════"
