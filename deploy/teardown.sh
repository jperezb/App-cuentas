#!/usr/bin/env bash
#
# deploy/teardown.sh
# Elimina TODA la infraestructura AWS (para dejar de pagar)
#
# Uso:
#   ./deploy/teardown.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "${SCRIPT_DIR}/.env.deploy" ]; then
  source "${SCRIPT_DIR}/.env.deploy"
fi

AWS_PROFILE="${AWS_PROFILE:-metadata}"
AWS_REGION="${AWS_REGION:-us-east-1}"
APP_NAME="${APP_NAME:-miscuentas}"
DOMAIN="${DOMAIN:-cuentas.metadata.cl}"

export AWS_PROFILE AWS_REGION

echo "══════════════════════════════════════════════════════"
echo " ELIMINAR toda la infraestructura de ${APP_NAME}"
echo "══════════════════════════════════════════════════════"
echo ""
read -p "¿Estás seguro? Esto eliminará la instancia, IP y datos. (escribe 'si'): " CONFIRM
if [ "${CONFIRM}" != "si" ]; then
  echo "Cancelado."
  exit 0
fi

# 1. Terminar instancia EC2
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${APP_NAME}" "Name=instance-state-name,Values=running,stopped" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text \
  --region "${AWS_REGION}" 2>/dev/null || echo "None")

if [ "${INSTANCE_ID}" != "None" ] && [ -n "${INSTANCE_ID}" ]; then
  echo "[→] Terminando instancia ${INSTANCE_ID}..."
  aws ec2 terminate-instances --instance-ids "${INSTANCE_ID}" --region "${AWS_REGION}" >/dev/null
  echo "[→] Esperando terminación..."
  aws ec2 wait instance-terminated --instance-ids "${INSTANCE_ID}" --region "${AWS_REGION}"
  echo "[✓] Instancia terminada."
else
  echo "[i] No se encontró instancia."
fi

# 2. Liberar Elastic IP
ALLOC_ID=$(aws ec2 describe-addresses \
  --filters "Name=tag:Name,Values=${APP_NAME}" \
  --query 'Addresses[0].AllocationId' --output text \
  --region "${AWS_REGION}" 2>/dev/null || echo "None")

if [ "${ALLOC_ID}" != "None" ] && [ -n "${ALLOC_ID}" ]; then
  echo "[→] Liberando Elastic IP..."
  aws ec2 release-address --allocation-id "${ALLOC_ID}" --region "${AWS_REGION}"
  echo "[✓] Elastic IP liberada."
else
  echo "[i] No se encontró Elastic IP."
fi

# 3. Eliminar Security Group
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${APP_NAME}-sg" \
  --query 'SecurityGroups[0].GroupId' --output text \
  --region "${AWS_REGION}" 2>/dev/null || echo "None")

if [ "${SG_ID}" != "None" ] && [ -n "${SG_ID}" ]; then
  echo "[→] Eliminando Security Group..."
  # A veces hay que esperar a que la instancia se termine completamente
  sleep 5
  aws ec2 delete-security-group --group-id "${SG_ID}" --region "${AWS_REGION}" 2>/dev/null || \
    echo "[!] No se pudo eliminar SG (puede tardar unos minutos después de terminar la instancia)"
  echo "[✓] Security Group eliminado."
fi

# 4. Eliminar Key Pair
KEY_NAME="${APP_NAME}-key"
if aws ec2 describe-key-pairs --key-names "${KEY_NAME}" --region "${AWS_REGION}" &>/dev/null; then
  echo "[→] Eliminando Key Pair..."
  aws ec2 delete-key-pair --key-name "${KEY_NAME}" --region "${AWS_REGION}"
  echo "[✓] Key Pair eliminado."
fi

# 5. Eliminar registro DNS
BASE_DOMAIN="metadata.cl"
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "${BASE_DOMAIN}" \
  --query "HostedZones[?Name=='${BASE_DOMAIN}.'].Id" --output text \
  2>/dev/null | sed 's|/hostedzone/||')

if [ -n "${HOSTED_ZONE_ID}" ] && [ "${HOSTED_ZONE_ID}" != "None" ]; then
  CURRENT_IP=$(aws route53 list-resource-record-sets \
    --hosted-zone-id "${HOSTED_ZONE_ID}" \
    --query "ResourceRecordSets[?Name=='${DOMAIN}.'].ResourceRecords[0].Value" \
    --output text 2>/dev/null || echo "")

  if [ -n "${CURRENT_IP}" ] && [ "${CURRENT_IP}" != "None" ]; then
    echo "[→] Eliminando registro DNS ${DOMAIN}..."
    aws route53 change-resource-record-sets \
      --hosted-zone-id "${HOSTED_ZONE_ID}" \
      --change-batch "{
        \"Changes\": [{
          \"Action\": \"DELETE\",
          \"ResourceRecordSet\": {
            \"Name\": \"${DOMAIN}\",
            \"Type\": \"A\",
            \"TTL\": 300,
            \"ResourceRecords\": [{\"Value\": \"${CURRENT_IP}\"}]
          }
        }]
      }" >/dev/null
    echo "[✓] Registro DNS eliminado."
  fi
fi

# Limpiar archivos locales
rm -f "${SCRIPT_DIR}/.env.deploy"

echo ""
echo "══════════════════════════════════════════════════════"
echo " Infraestructura eliminada completamente"
echo " Ya no se generarán costos."
echo "══════════════════════════════════════════════════════"
