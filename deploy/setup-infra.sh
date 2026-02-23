#!/usr/bin/env bash
#
# deploy/setup-infra.sh
# Crea la infraestructura AWS para MisCuentas (capa gratuita)
#
# Recursos creados:
#   - Key Pair SSH (si no existe)
#   - Security Group (HTTP 80, HTTPS 443, SSH 22)
#   - EC2 t2.micro (Amazon Linux 2023, free tier)
#   - Elastic IP (1 gratis si está asociada a instancia running)
#   - Route 53 record: cuentas.metadata.cl → Elastic IP
#
# Uso:
#   chmod +x deploy/setup-infra.sh
#   ./deploy/setup-infra.sh
#
set -euo pipefail

# ── Configuración ──────────────────────────────────────────────
AWS_PROFILE="metadata"
AWS_REGION="us-east-1"
APP_NAME="miscuentas"
DOMAIN="cuentas.metadata.cl"
KEY_NAME="${APP_NAME}-key"
SG_NAME="${APP_NAME}-sg"
INSTANCE_TYPE="t2.micro"
# Amazon Linux 2023 (free tier eligible) - se resuelve automáticamente
AMI_SSM_PARAM="/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"

export AWS_PROFILE AWS_REGION

echo "══════════════════════════════════════════════════════"
echo " MisCuentas — Despliegue AWS (capa gratuita)"
echo " Dominio: ${DOMAIN}"
echo " Perfil:  ${AWS_PROFILE}"
echo " Región:  ${AWS_REGION}"
echo "══════════════════════════════════════════════════════"

# ── 1. Key Pair ────────────────────────────────────────────────
KEY_FILE="deploy/${KEY_NAME}.pem"

if aws ec2 describe-key-pairs --key-names "${KEY_NAME}" --region "${AWS_REGION}" &>/dev/null; then
  echo "[✓] Key Pair '${KEY_NAME}' ya existe."
else
  echo "[→] Creando Key Pair '${KEY_NAME}'..."
  aws ec2 create-key-pair \
    --key-name "${KEY_NAME}" \
    --key-type ed25519 \
    --query 'KeyMaterial' \
    --output text \
    --region "${AWS_REGION}" > "${KEY_FILE}"
  chmod 400 "${KEY_FILE}"
  echo "[✓] Key guardada en ${KEY_FILE}"
fi

# ── 2. Security Group ─────────────────────────────────────────
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=is-default,Values=true" \
  --query 'Vpcs[0].VpcId' --output text \
  --region "${AWS_REGION}")

echo "[i] VPC por defecto: ${VPC_ID}"

SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${SG_NAME}" "Name=vpc-id,Values=${VPC_ID}" \
  --query 'SecurityGroups[0].GroupId' --output text \
  --region "${AWS_REGION}" 2>/dev/null || echo "None")

if [ "${SG_ID}" != "None" ] && [ -n "${SG_ID}" ]; then
  echo "[✓] Security Group '${SG_NAME}' ya existe: ${SG_ID}"
else
  echo "[→] Creando Security Group '${SG_NAME}'..."
  SG_ID=$(aws ec2 create-security-group \
    --group-name "${SG_NAME}" \
    --description "MisCuentas - HTTP, HTTPS, SSH" \
    --vpc-id "${VPC_ID}" \
    --query 'GroupId' --output text \
    --region "${AWS_REGION}")

  # SSH
  aws ec2 authorize-security-group-ingress \
    --group-id "${SG_ID}" --protocol tcp --port 22 --cidr 0.0.0.0/0 \
    --region "${AWS_REGION}"
  # HTTP
  aws ec2 authorize-security-group-ingress \
    --group-id "${SG_ID}" --protocol tcp --port 80 --cidr 0.0.0.0/0 \
    --region "${AWS_REGION}"
  # HTTPS
  aws ec2 authorize-security-group-ingress \
    --group-id "${SG_ID}" --protocol tcp --port 443 --cidr 0.0.0.0/0 \
    --region "${AWS_REGION}"

  echo "[✓] Security Group creado: ${SG_ID}"
fi

# ── 3. Obtener AMI ────────────────────────────────────────────
AMI_ID=$(aws ssm get-parameters \
  --names "${AMI_SSM_PARAM}" \
  --query 'Parameters[0].Value' --output text \
  --region "${AWS_REGION}")
echo "[i] AMI Amazon Linux 2023: ${AMI_ID}"

# ── 4. Verificar si ya existe una instancia ───────────────────
EXISTING_INSTANCE=$(aws ec2 describe-instances \
  --filters \
    "Name=tag:Name,Values=${APP_NAME}" \
    "Name=instance-state-name,Values=running,stopped" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text \
  --region "${AWS_REGION}" 2>/dev/null || echo "None")

if [ "${EXISTING_INSTANCE}" != "None" ] && [ -n "${EXISTING_INSTANCE}" ]; then
  INSTANCE_ID="${EXISTING_INSTANCE}"
  echo "[✓] Instancia existente encontrada: ${INSTANCE_ID}"

  # Asegurar que esté corriendo
  STATE=$(aws ec2 describe-instances \
    --instance-ids "${INSTANCE_ID}" \
    --query 'Reservations[0].Instances[0].State.Name' --output text \
    --region "${AWS_REGION}")
  if [ "${STATE}" = "stopped" ]; then
    echo "[→] Iniciando instancia detenida..."
    aws ec2 start-instances --instance-ids "${INSTANCE_ID}" --region "${AWS_REGION}" >/dev/null
    aws ec2 wait instance-running --instance-ids "${INSTANCE_ID}" --region "${AWS_REGION}"
    echo "[✓] Instancia iniciada."
  fi
else
  echo "[→] Lanzando instancia EC2 ${INSTANCE_TYPE}..."
  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "${AMI_ID}" \
    --instance-type "${INSTANCE_TYPE}" \
    --key-name "${KEY_NAME}" \
    --security-group-ids "${SG_ID}" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${APP_NAME}}]" \
    --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
    --query 'Instances[0].InstanceId' --output text \
    --region "${AWS_REGION}")

  echo "[→] Esperando que la instancia esté running..."
  aws ec2 wait instance-running --instance-ids "${INSTANCE_ID}" --region "${AWS_REGION}"
  echo "[✓] Instancia creada: ${INSTANCE_ID}"
fi

# ── 5. Elastic IP ─────────────────────────────────────────────
ALLOC_ID=$(aws ec2 describe-addresses \
  --filters "Name=tag:Name,Values=${APP_NAME}" \
  --query 'Addresses[0].AllocationId' --output text \
  --region "${AWS_REGION}" 2>/dev/null || echo "None")

if [ "${ALLOC_ID}" != "None" ] && [ -n "${ALLOC_ID}" ]; then
  ELASTIC_IP=$(aws ec2 describe-addresses \
    --allocation-ids "${ALLOC_ID}" \
    --query 'Addresses[0].PublicIp' --output text \
    --region "${AWS_REGION}")
  echo "[✓] Elastic IP existente: ${ELASTIC_IP}"
else
  echo "[→] Asignando Elastic IP..."
  ALLOC_ID=$(aws ec2 allocate-address \
    --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=${APP_NAME}}]" \
    --query 'AllocationId' --output text \
    --region "${AWS_REGION}")
  ELASTIC_IP=$(aws ec2 describe-addresses \
    --allocation-ids "${ALLOC_ID}" \
    --query 'Addresses[0].PublicIp' --output text \
    --region "${AWS_REGION}")
  echo "[✓] Elastic IP asignada: ${ELASTIC_IP}"
fi

# Asociar a la instancia
CURRENT_ASSOC=$(aws ec2 describe-addresses \
  --allocation-ids "${ALLOC_ID}" \
  --query 'Addresses[0].InstanceId' --output text \
  --region "${AWS_REGION}" 2>/dev/null || echo "None")

if [ "${CURRENT_ASSOC}" != "${INSTANCE_ID}" ]; then
  echo "[→] Asociando Elastic IP a instancia..."
  aws ec2 associate-address \
    --allocation-id "${ALLOC_ID}" \
    --instance-id "${INSTANCE_ID}" \
    --region "${AWS_REGION}" >/dev/null
  echo "[✓] IP asociada."
fi

# ── 6. Route 53 ───────────────────────────────────────────────
BASE_DOMAIN="metadata.cl"
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "${BASE_DOMAIN}" \
  --query "HostedZones[?Name=='${BASE_DOMAIN}.'].Id" --output text \
  | sed 's|/hostedzone/||')

if [ -n "${HOSTED_ZONE_ID}" ] && [ "${HOSTED_ZONE_ID}" != "None" ]; then
  echo "[→] Actualizando registro DNS: ${DOMAIN} → ${ELASTIC_IP}"
  aws route53 change-resource-record-sets \
    --hosted-zone-id "${HOSTED_ZONE_ID}" \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"UPSERT\",
        \"ResourceRecordSet\": {
          \"Name\": \"${DOMAIN}\",
          \"Type\": \"A\",
          \"TTL\": 300,
          \"ResourceRecords\": [{\"Value\": \"${ELASTIC_IP}\"}]
        }
      }]
    }" >/dev/null
  echo "[✓] DNS configurado: ${DOMAIN} → ${ELASTIC_IP}"
else
  echo "[!] No se encontró Hosted Zone para ${BASE_DOMAIN}."
  echo "    Crea un registro A manualmente: ${DOMAIN} → ${ELASTIC_IP}"
fi

# ── Resumen ────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo " Infraestructura lista"
echo "══════════════════════════════════════════════════════"
echo "  Instance ID : ${INSTANCE_ID}"
echo "  Elastic IP  : ${ELASTIC_IP}"
echo "  Key Pair    : ${KEY_FILE}"
echo "  Domain      : ${DOMAIN}"
echo ""
echo " Siguiente paso:"
echo "   ./deploy/setup-server.sh ${ELASTIC_IP}"
echo "══════════════════════════════════════════════════════"

# Guardar variables para otros scripts
cat > deploy/.env.deploy <<EOF
INSTANCE_ID=${INSTANCE_ID}
ELASTIC_IP=${ELASTIC_IP}
KEY_FILE=${KEY_FILE}
DOMAIN=${DOMAIN}
AWS_PROFILE=${AWS_PROFILE}
AWS_REGION=${AWS_REGION}
APP_NAME=${APP_NAME}
EOF

echo "[✓] Variables guardadas en deploy/.env.deploy"
