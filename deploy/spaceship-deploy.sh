#!/bin/bash
# ===================================================================
# Saturn Studio — Déploiement automatisé sur VPS Spaceship
# Usage : ssh root@<IP_VPS> 'bash -s' < spaceship-deploy.sh
# Prérequis : VPS Ubuntu 22.04/24.04 fraîchement créé sur Spaceship
# ===================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-}"
REPO="https://github.com/falilouthiane28-cloud/saturn-studio.git"
APP_DIR="/srv/saturn"

echo "=== Saturn Studio — Installation sur VPS Spaceship ==="

# 1. Mise à jour système
echo "[1/7] Mise à jour du système..."
apt-get update -qq && apt-get upgrade -y -qq

# 2. Installer Docker
echo "[2/7] Installation de Docker..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

# 3. Installer Docker Compose plugin
echo "[3/7] Vérification Docker Compose..."
if ! docker compose version &>/dev/null; then
    apt-get install -y -qq docker-compose-plugin
fi

# 4. Cloner le repo
echo "[4/7] Clonage du repo..."
if [ -d "$APP_DIR" ]; then
    echo "    Dossier existant, pull..."
    cd "$APP_DIR" && git pull
else
    git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

# 5. Configurer les secrets
echo "[5/7] Configuration des secrets..."
ENV_FILE="$APP_DIR/naiom-platform/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    cp "$APP_DIR/naiom-platform/.env.production.example" "$ENV_FILE"
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  IMPORTANT : Édite les secrets avant de continuer !    ║"
    echo "║  nano $ENV_FILE                                        ║"
    echo "║                                                        ║"
    echo "║  Clés à remplir :                                      ║"
    echo "║  - ANTHROPIC_API_KEY (obligatoire)                     ║"
    echo "║  - GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET             ║"
    echo "║  - GOOGLE_REDIRECT_URI = https://DOMAINE/api/...       ║"
    echo "║  - TIKTOK_ACCESS_TOKEN                                 ║"
    echo "║  - APIFY_TOKEN                                         ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo "Après avoir édité, relance ce script."
    exit 0
fi

# 6. Build + démarrage
echo "[6/7] Build et démarrage Docker..."
docker compose up -d --build
echo "    Container lancé. Vérification..."
sleep 5
if docker compose ps | grep -q "running"; then
    echo "    ✓ Saturn Studio tourne sur le port 3000"
else
    echo "    ✗ Erreur — vérifie avec : docker compose logs"
    exit 1
fi

# 7. Installer Caddy (reverse proxy HTTPS automatique)
echo "[7/7] Installation de Caddy (HTTPS)..."
if ! command -v caddy &>/dev/null; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy
fi

if [ -n "$DOMAIN" ]; then
    cat > /etc/caddy/Caddyfile <<CADDYEOF
$DOMAIN {
    reverse_proxy 127.0.0.1:3000
}
CADDYEOF
    systemctl reload caddy
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  ✓ Saturn Studio est en ligne !                        ║"
    echo "║  URL : https://$DOMAIN                                 ║"
    echo "║                                                        ║"
    echo "║  N'oublie pas d'ajouter dans Google Cloud :            ║"
    echo "║  URI autorisée : https://$DOMAIN/api/integrations/     ║"
    echo "║                  google/callback                       ║"
    echo "╚══════════════════════════════════════════════════════════╝"
else
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  ✓ Saturn Studio tourne sur http://<IP>:3000           ║"
    echo "║                                                        ║"
    echo "║  Pour activer HTTPS avec un domaine :                  ║"
    echo "║  DOMAIN=ton-domaine.com bash spaceship-deploy.sh       ║"
    echo "╚══════════════════════════════════════════════════════════╝"
fi

echo ""
echo "Commandes utiles :"
echo "  docker compose logs -f        # voir les logs"
echo "  docker compose restart        # redémarrer"
echo "  cd $APP_DIR && git pull && docker compose up -d --build  # mettre à jour"
