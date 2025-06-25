#!/bin/bash

# Script de déploiement pour le bot de trading COLLAT
# Ce script doit être exécuté sur le serveur VPS

set -e

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Déploiement du bot de trading COLLAT${NC}"
echo "--------------------------------------------------------"

# Vérifier que le script est exécuté en tant que root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Ce script doit être exécuté en tant que root${NC}"
  exit 1
fi

# Définir le répertoire d'installation
INSTALL_DIR="/home/ubuntu/bot_collat"
SERVICE_NAME="collat-bot"
GITHUB_REPO="https://github.com/votre-repo/bot_collat.git"

# Mettre à jour le système
echo -e "${YELLOW}Mise à jour du système...${NC}"
apt-get update
apt-get upgrade -y

# Installer les dépendances
echo -e "${YELLOW}Installation des dépendances...${NC}"
apt-get install -y curl git build-essential postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# Installer Node.js
echo -e "${YELLOW}Installation de Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Vérifier que Node.js et npm sont installés
node -v
npm -v

# Créer l'utilisateur ubuntu s'il n'existe pas
if ! id "ubuntu" &>/dev/null; then
    echo -e "${YELLOW}Création de l'utilisateur ubuntu...${NC}"
    useradd -m -s /bin/bash ubuntu
    # Ajouter l'utilisateur au groupe sudo
    usermod -aG sudo ubuntu
fi

# Configurer PostgreSQL
echo -e "${YELLOW}Configuration de PostgreSQL...${NC}"
sudo -u postgres psql -c "CREATE USER collat_bot WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "CREATE DATABASE collat_bot OWNER collat_bot;"

# Cloner le dépôt Git
echo -e "${YELLOW}Clonage du dépôt Git...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo "Le répertoire $INSTALL_DIR existe déjà"
    cd "$INSTALL_DIR"
    git pull
else
    git clone "$GITHUB_REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Configurer le backend
echo -e "${YELLOW}Configuration du backend...${NC}"
cd "$INSTALL_DIR/backend"

# Créer le fichier .env
echo -e "${YELLOW}Création du fichier .env...${NC}"
cat > .env << EOL
# Application
NODE_ENV=production
PORT=3001
API_SECRET=$(openssl rand -hex 32)

# Database
DATABASE_URL="postgresql://collat_bot:secure_password@localhost:5432/collat_bot?schema=public"

# Solana RPC
PRIMARY_RPC_ENDPOINT="https://kamel-solanam-876d.mainnet.rpcpool.com"
SECONDARY_RPC_ENDPOINT="https://rpc.triton.one"

# Wallet (IMPORTANT: Remplacer par votre clé privée chiffrée)
WALLET_PRIVATE_KEY=your_encrypted_private_key_here

# Trading Configuration
SELL_THRESHOLD=10
BUY_THRESHOLD=5
SLIPPAGE_TOLERANCE=1.5
MAX_TRANSACTION_PERCENTAGE=50

# Notifications
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
EMAIL_SERVICE=smtp.example.com
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_email_password
NOTIFICATION_EMAIL=alerts@example.com
EOL

# Installer les dépendances
echo -e "${YELLOW}Installation des dépendances du backend...${NC}"
npm install

# Générer les types Prisma
echo -e "${YELLOW}Génération des types Prisma...${NC}"
npx prisma generate

# Appliquer les migrations de base de données
echo -e "${YELLOW}Application des migrations de base de données...${NC}"
npx prisma migrate deploy

# Compiler le code TypeScript
echo -e "${YELLOW}Compilation du code TypeScript...${NC}"
npm run build

# Initialiser la base de données
echo -e "${YELLOW}Initialisation de la base de données...${NC}"
npm run init:db

# Configurer le service systemd
echo -e "${YELLOW}Configuration du service systemd...${NC}"
cp "$INSTALL_DIR/backend/deployment/collat-bot.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

# Configurer Nginx comme proxy inverse
echo -e "${YELLOW}Configuration de Nginx...${NC}"
cat > /etc/nginx/sites-available/$SERVICE_NAME << EOL
server {
    listen 80;
    server_name api.collat-bot.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOL

# Activer le site
ln -sf /etc/nginx/sites-available/$SERVICE_NAME /etc/nginx/sites-enabled/

# Vérifier la configuration Nginx
nginx -t

# Redémarrer Nginx
systemctl restart nginx

# Configurer HTTPS avec Certbot
echo -e "${YELLOW}Configuration de HTTPS avec Certbot...${NC}"
certbot --nginx -d api.collat-bot.com --non-interactive --agree-tos --email your-email@example.com

# Afficher le statut du service
echo -e "${YELLOW}Statut du service:${NC}"
systemctl status $SERVICE_NAME

echo -e "${GREEN}Déploiement terminé avec succès!${NC}"
echo "--------------------------------------------------------"
echo -e "${YELLOW}URL de l'API:${NC} https://api.collat-bot.com"
echo -e "${YELLOW}Pour voir les logs:${NC} journalctl -u $SERVICE_NAME -f"
echo "--------------------------------------------------------"
