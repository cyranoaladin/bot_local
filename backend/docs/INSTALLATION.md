# Guide d'Installation du Bot de Trading $COLLAT

Ce document détaille les étapes nécessaires pour installer et configurer le bot de trading $COLLAT sur un serveur VPS.

## Prérequis

- Un serveur VPS sous Ubuntu 22.04 LTS
- Minimum 2 CPU, 4GB RAM, 50GB SSD
- Un nom de domaine configuré pour pointer vers votre VPS
- Une paire de clés Solana pour le portefeuille de trading

## Installation Automatique

Le moyen le plus simple d'installer le bot est d'utiliser notre script de déploiement automatique.

1. Connectez-vous à votre VPS en tant que root :
   ```bash
   ssh root@votre-serveur
   ```

2. Clonez le dépôt Git :
   ```bash
   git clone https://github.com/votre-repo/bot_collat.git /tmp/bot_collat
   ```

3. Exécutez le script de déploiement :
   ```bash
   cd /tmp/bot_collat/backend/deployment
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. Suivez les instructions à l'écran pour terminer l'installation.

## Installation Manuelle

Si vous préférez installer le bot manuellement, suivez ces étapes :

### 1. Préparer le Serveur

```bash
# Mettre à jour le système
apt-get update
apt-get upgrade -y

# Installer les dépendances
apt-get install -y curl git build-essential postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
```

### 2. Configurer PostgreSQL

```bash
# Créer un utilisateur et une base de données
sudo -u postgres psql -c "CREATE USER collat_bot WITH PASSWORD 'votre_mot_de_passe_securise';"
sudo -u postgres psql -c "CREATE DATABASE collat_bot OWNER collat_bot;"
```

### 3. Configurer le Bot

```bash
# Cloner le dépôt
git clone https://github.com/votre-repo/bot_collat.git /home/ubuntu/bot_collat
cd /home/ubuntu/bot_collat/backend

# Installer les dépendances
npm install

# Copier le fichier d'environnement exemple
cp .env.example .env

# Éditer le fichier .env avec vos paramètres
nano .env
```

### 4. Initialiser la Base de Données

```bash
# Générer les types Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Initialiser la base de données
npm run init:db
```

### 5. Compiler le Code

```bash
# Compiler le TypeScript en JavaScript
npm run build
```

### 6. Configurer le Service Systemd

```bash
# Copier le fichier de service
cp /home/ubuntu/bot_collat/backend/deployment/collat-bot.service /etc/systemd/system/

# Activer et démarrer le service
systemctl daemon-reload
systemctl enable collat-bot
systemctl start collat-bot
```

### 7. Configurer Nginx

```bash
# Créer la configuration Nginx
cat > /etc/nginx/sites-available/collat-bot << EOL
server {
    listen 80;
    server_name api.votre-domaine.com;

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
ln -sf /etc/nginx/sites-available/collat-bot /etc/nginx/sites-enabled/

# Vérifier la configuration
nginx -t

# Redémarrer Nginx
systemctl restart nginx
```

### 8. Configurer HTTPS

```bash
# Obtenir un certificat SSL avec Certbot
certbot --nginx -d api.votre-domaine.com
```

## Configuration du Portefeuille

Pour configurer le portefeuille Solana, vous devez générer une paire de clés et la stocker de manière sécurisée :

1. Générez une paire de clés Solana :
   ```bash
   solana-keygen new --outfile /tmp/wallet-keypair.json
   ```

2. Notez l'adresse publique affichée.

3. Convertissez la clé privée en format Base64 pour le fichier .env :
   ```bash
   cat /tmp/wallet-keypair.json | base64 -w 0
   ```

4. Copiez la sortie et mettez-la dans votre fichier .env comme valeur de WALLET_PRIVATE_KEY.

5. Supprimez le fichier temporaire :
   ```bash
   shred -u /tmp/wallet-keypair.json
   ```

6. Approvisionnez le portefeuille avec SOL, USDC et $COLLAT.

## Configuration des Sauvegardes

Pour configurer des sauvegardes automatiques :

1. Rendez le script de sauvegarde exécutable :
   ```bash
   chmod +x /home/ubuntu/bot_collat/backend/deployment/backup.sh
   ```

2. Configurez une tâche cron pour exécuter le script quotidiennement :
   ```bash
   crontab -e
   ```

3. Ajoutez la ligne suivante pour exécuter la sauvegarde tous les jours à 2h du matin :
   ```
   0 2 * * * /home/ubuntu/bot_collat/backend/deployment/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
   ```

## Vérification de l'Installation

Pour vérifier que le bot fonctionne correctement :

1. Vérifiez le statut du service :
   ```bash
   systemctl status collat-bot
   ```

2. Consultez les journaux :
   ```bash
   journalctl -u collat-bot -f
   ```

3. Testez l'API en accédant à `https://api.votre-domaine.com/health`

## Dépannage

Si vous rencontrez des problèmes :

1. Vérifiez les journaux du service :
   ```bash
   journalctl -u collat-bot -e
   ```

2. Vérifiez les journaux de l'application :
   ```bash
   cat /home/ubuntu/bot_collat/backend/logs/error.log
   ```

3. Redémarrez le service :
   ```bash
   systemctl restart collat-bot
   ```

Pour plus d'informations, consultez la documentation complète dans le dossier `docs/`.
