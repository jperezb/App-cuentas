#!/usr/bin/env bash
#
# deploy/ssl.sh
# Obtiene/renueva certificado SSL Let's Encrypt para cuentas.metadata.cl
#
# Uso:
#   ./deploy/ssl.sh tu@email.com
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "${SCRIPT_DIR}/.env.deploy" ]; then
  source "${SCRIPT_DIR}/.env.deploy"
fi

EMAIL="${1:-}"
SERVER_IP="${ELASTIC_IP:-}"
KEY="${KEY_FILE:-deploy/miscuentas-key.pem}"
DOMAIN="${DOMAIN:-cuentas.metadata.cl}"
SSH_USER="ec2-user"
SSH_CMD="ssh -i ${KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${SERVER_IP}"

if [ -z "${EMAIL}" ]; then
  echo "Uso: ./deploy/ssl.sh tu@email.com"
  exit 1
fi

if [ -z "${SERVER_IP}" ]; then
  echo "Error: ejecuta setup-infra.sh primero."
  exit 1
fi

echo "[→] Obteniendo certificado SSL para ${DOMAIN}..."

${SSH_CMD} "sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m ${EMAIL}"

echo ""
echo "[✓] SSL configurado. La app ahora está disponible en:"
echo "    https://${DOMAIN}"
echo ""
echo "    Certbot renueva automáticamente. Para verificar:"
echo "    ${SSH_CMD} \"sudo certbot renew --dry-run\""
