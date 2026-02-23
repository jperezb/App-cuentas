#!/usr/bin/env bash
#
# deploy/status.sh
# Muestra el estado actual de la infraestructura y la app
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "${SCRIPT_DIR}/.env.deploy" ]; then
  source "${SCRIPT_DIR}/.env.deploy"
fi

SERVER_IP="${ELASTIC_IP:-}"
KEY="${KEY_FILE:-deploy/miscuentas-key.pem}"
DOMAIN="${DOMAIN:-cuentas.metadata.cl}"
SSH_USER="ec2-user"
AWS_PROFILE="${AWS_PROFILE:-metadata}"
AWS_REGION="${AWS_REGION:-us-east-1}"
APP_NAME="${APP_NAME:-miscuentas}"

export AWS_PROFILE AWS_REGION

echo "══════════════════════════════════════════════════════"
echo " MisCuentas — Estado"
echo "══════════════════════════════════════════════════════"

# EC2
INSTANCE_STATE=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${APP_NAME}" "Name=instance-state-name,Values=running,stopped,pending" \
  --query 'Reservations[0].Instances[0].State.Name' --output text \
  --region "${AWS_REGION}" 2>/dev/null || echo "no encontrada")

echo "  EC2:        ${INSTANCE_STATE}"
echo "  IP:         ${SERVER_IP:-no asignada}"
echo "  Dominio:    ${DOMAIN}"

# Verificar si la app responde
if [ -n "${SERVER_IP}" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://${SERVER_IP}:3000" 2>/dev/null || echo "000")
  if [ "${HTTP_CODE}" = "200" ]; then
    echo "  App HTTP:   OK (${HTTP_CODE})"
  else
    echo "  App HTTP:   No responde (${HTTP_CODE})"
  fi

  HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://${DOMAIN}" 2>/dev/null || echo "000")
  if [ "${HTTPS_CODE}" = "200" ]; then
    echo "  App HTTPS:  OK (${HTTPS_CODE})"
  else
    echo "  App HTTPS:  No disponible (${HTTPS_CODE})"
  fi
fi

# PM2 status remoto
if [ -n "${SERVER_IP}" ] && [ -f "${KEY}" ]; then
  echo ""
  echo "── PM2 ──"
  ssh -i "${KEY}" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "${SSH_USER}@${SERVER_IP}" \
    "pm2 status" 2>/dev/null || echo "  No se pudo conectar al servidor."
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo " Costos estimados (capa gratuita 12 meses):"
echo "   EC2 t2.micro:   $0 (750 hrs/mes gratis)"
echo "   EBS 20GB gp3:   $0 (30GB gratis)"
echo "   Elastic IP:     $0 (gratis si asociada a instancia running)"
echo "   Route 53:       ~$0.50/mes (hosted zone)"
echo "   Transferencia:  $0 (15GB/mes gratis)"
echo "   SSL:            $0 (Let's Encrypt)"
echo "   Total:          ~$0.50/mes"
echo "══════════════════════════════════════════════════════"
