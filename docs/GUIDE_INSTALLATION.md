# Guide d'Installation et d'Utilisation du Bot de Trading $COLLAT

## Table des matières
1. [Introduction](#introduction)
2. [Prérequis](#prérequis)
3. [Installation du Backend](#installation-du-backend)
4. [Installation du Frontend](#installation-du-frontend)
5. [Configuration](#configuration)
6. [Déploiement sur VPS](#déploiement-sur-vps)
7. [Utilisation du Bot](#utilisation-du-bot)
8. [Maintenance](#maintenance)
9. [Dépannage](#dépannage)
10. [FAQ](#faq)

## Introduction

Ce guide détaille l'installation, la configuration et l'utilisation du bot de trading $COLLAT pour la blockchain Solana. Le bot implémente une stratégie à seuils asymétriques pour maximiser les gains en exploitant les fluctuations de prix du token $COLLAT.

### Architecture du système

Le système est composé de deux parties principales :
- **Backend** : Service Node.js autonome qui gère la logique de trading, les interactions avec la blockchain et la persistance des données
- **Frontend** : Interface utilisateur React pour l'administration et la surveillance du bot

## Prérequis

### Matériel recommandé (pour le VPS)
- CPU : 2 cœurs minimum
- RAM : 4 GB minimum
- Stockage : 50 GB SSD minimum
- Connexion Internet stable

### Logiciels requis
- Node.js 18.x ou supérieur
- npm 9.x ou supérieur
- PostgreSQL 14.x ou supérieur
- Git

### Portefeuille Solana
- Un portefeuille Solana avec des fonds en SOL (pour les frais de transaction)
- Tokens $COLLAT et USDC pour le trading

## Installation du Backend

### 1. Cloner le dépôt
```bash
git clone [URL_DU_REPO]
cd bot_collat/backend
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer les variables d'environnement
```bash
cp .env.example .env
```

Éditez le fichier `.env` avec vos informations :
```
# Application
NODE_ENV=production
PORT=3001
API_SECRET=votre_secret_api_ici

# Database
DATABASE_URL="postgresql://username:password@localhost:5432/collat_bot?schema=public"

# Solana RPC
PRIMARY_RPC_ENDPOINT="https://mainnet.helius-rpc.com/?api-key=votre_api_key_ici"
SECONDARY_RPC_ENDPOINT="https://rpc.triton.one"

# Wallet (IMPORTANT: Remplacer par votre clé privée chiffrée)
WALLET_PRIVATE_KEY=votre_cle_privee_chiffree_ici

# Trading Configuration
SELL_THRESHOLD=10
BUY_THRESHOLD=5
SLIPPAGE_TOLERANCE=1.5
MAX_TRANSACTION_PERCENTAGE=50

# Notifications
TELEGRAM_BOT_TOKEN=votre_token_bot_telegram
TELEGRAM_CHAT_ID=votre_chat_id_telegram
EMAIL_SERVICE=smtp.example.com
EMAIL_USER=votre_email@example.com
EMAIL_PASSWORD=votre_mot_de_passe_email
NOTIFICATION_EMAIL=alerts@example.com
```

### 4. Configurer la base de données
```bash
# Créer la base de données PostgreSQL
sudo -u postgres psql -c "CREATE USER collat_bot WITH PASSWORD 'votre_mot_de_passe';"
sudo -u postgres psql -c "CREATE DATABASE collat_bot OWNER collat_bot;"

# Générer les types Prisma
npx prisma generate

# Appliquer les migrations de base de données
npx prisma migrate deploy

# Initialiser la base de données avec les valeurs par défaut
npm run init:db
```

### 5. Compiler et démarrer le backend
```bash
# Compiler le code TypeScript
npm run build

# Démarrer le serveur en mode production
npm run start

# Ou démarrer le serveur en mode développement
npm run dev
```

## Installation du Frontend

### 1. Configurer le frontend
```bash
# Naviguer vers le répertoire du frontend
cd ../

# Installer les dépendances
npm install

# Configurer l'URL de l'API dans .env.local
echo "VITE_API_URL=http://localhost:3001/api" > .env.local
```

### 2. Démarrer le frontend en mode développement
```bash
npm run dev
```

### 3. Construire le frontend pour la production
```bash
npm run build
```

## Configuration

### Configuration du Bot de Trading

La configuration du bot peut être modifiée via l'interface d'administration ou directement dans le fichier `.env` :

| Paramètre | Description | Valeur par défaut |
|-----------|-------------|-------------------|
| SELL_THRESHOLD | Pourcentage d'augmentation du prix qui déclenche une vente | 10 |
| BUY_THRESHOLD | Pourcentage de diminution du prix qui déclenche un achat | 5 |
| SLIPPAGE_TOLERANCE | Pourcentage maximum de slippage accepté | 1.5 |
| MAX_TRANSACTION_PERCENTAGE | Pourcentage maximum des avoirs à utiliser par transaction | 50 |

### Configuration des Notifications

Le bot peut envoyer des notifications via email et Telegram :

#### Email
- `EMAIL_SERVICE` : Service SMTP (ex: gmail, outlook)
- `EMAIL_USER` : Adresse email pour l'envoi
- `EMAIL_PASSWORD` : Mot de passe ou token d'application
- `NOTIFICATION_EMAIL` : Adresse email qui recevra les notifications

#### Telegram
- `TELEGRAM_BOT_TOKEN` : Token du bot Telegram (obtenu via @BotFather)
- `TELEGRAM_CHAT_ID` : ID du chat où envoyer les notifications

## Déploiement sur VPS

### Déploiement automatisé

Le projet inclut un script de déploiement automatisé qui configure l'ensemble du système sur un VPS Ubuntu :

```bash
# Se connecter au VPS en SSH
ssh user@your-vps-ip

# Cloner le dépôt
git clone [URL_DU_REPO]
cd bot_collat/backend/deployment

# Rendre le script exécutable
chmod +x deploy.sh

# Exécuter le script de déploiement (en tant que root)
sudo ./deploy.sh
```

Le script effectue les opérations suivantes :
1. Installation des dépendances système (Node.js, PostgreSQL, Nginx, etc.)
2. Configuration de la base de données PostgreSQL
3. Configuration du backend avec les variables d'environnement
4. Compilation du code TypeScript
5. Configuration du service systemd pour le démarrage automatique
6. Configuration de Nginx comme proxy inverse
7. Configuration de HTTPS avec Let's Encrypt

### Configuration du service systemd

Le bot est configuré pour s'exécuter comme un service systemd, ce qui permet un démarrage automatique et une gestion simplifiée :

```bash
# Vérifier le statut du service
sudo systemctl status collat-bot

# Démarrer le service
sudo systemctl start collat-bot

# Arrêter le service
sudo systemctl stop collat-bot

# Redémarrer le service
sudo systemctl restart collat-bot

# Activer le démarrage automatique
sudo systemctl enable collat-bot
```

### Sauvegardes automatiques

Un script de sauvegarde est fourni pour sauvegarder régulièrement la base de données et les fichiers de configuration :

```bash
# Rendre le script exécutable
chmod +x backup.sh

# Exécuter le script de sauvegarde manuellement
sudo ./backup.sh

# Configurer une tâche cron pour une exécution quotidienne
sudo crontab -e
# Ajouter la ligne suivante pour une exécution quotidienne à 2h du matin
0 2 * * * /home/ubuntu/bot_collat/backend/deployment/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```

## Utilisation du Bot

### Interface d'administration

L'interface d'administration est accessible à l'adresse `http://your-server-ip` ou `https://your-domain.com` si vous avez configuré un nom de domaine.

#### Connexion
1. Accédez à l'interface d'administration
2. Connectez votre portefeuille Phantom en cliquant sur le bouton "Connecter le portefeuille"
3. Authentifiez-vous avec le token API fourni lors de l'initialisation de la base de données

#### Tableau de bord
Le tableau de bord affiche :
- Statut actuel du bot (actif/inactif)
- Valeur actuelle du portefeuille
- Prix actuel du token $COLLAT
- Profit quotidien
- Graphique de performance
- Historique des transactions

#### Contrôle du Bot
- **Démarrer le bot** : Cliquez sur le bouton "Démarrer" pour activer le bot de trading
- **Arrêter le bot** : Cliquez sur le bouton "Arrêter" pour désactiver le bot
- **Configuration** : Modifiez les paramètres du bot dans l'onglet "Configuration"

#### Surveillance des transactions
L'onglet "Transactions" affiche l'historique complet des transactions effectuées par le bot, avec les informations suivantes :
- Type de transaction (achat/vente)
- Montant
- Prix
- Date et heure
- Statut (en attente, confirmée, échouée)
- Hash de transaction

### API REST

Le backend expose une API REST qui peut être utilisée pour intégrer le bot avec d'autres systèmes :

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/bot/status` | GET | Obtenir l'état actuel du bot |
| `/api/bot/start` | POST | Démarrer le bot |
| `/api/bot/stop` | POST | Arrêter le bot |
| `/api/config` | GET | Obtenir la configuration actuelle |
| `/api/config` | PUT | Mettre à jour la configuration |
| `/api/transactions` | GET | Obtenir l'historique des transactions |
| `/api/portfolio/snapshots` | GET | Obtenir les snapshots du portefeuille |
| `/api/wallet/balances` | GET | Obtenir les soldes du portefeuille |
| `/api/logs` | GET | Obtenir les journaux système |

Exemple d'utilisation avec curl :
```bash
# Obtenir le statut du bot
curl -H "Authorization: Bearer votre_token_api" http://your-server-ip:3001/api/bot/status

# Démarrer le bot
curl -X POST -H "Authorization: Bearer votre_token_api" http://your-server-ip:3001/api/bot/start
```

## Maintenance

### Mise à jour du code

Pour mettre à jour le code du bot :

```bash
# Naviguer vers le répertoire du projet
cd /home/ubuntu/bot_collat

# Récupérer les dernières modifications
git pull

# Mettre à jour le backend
cd backend
npm install
npm run build
sudo systemctl restart collat-bot

# Mettre à jour le frontend
cd ..
npm install
npm run build
```

### Surveillance des logs

Les logs du bot sont disponibles via systemd :

```bash
# Afficher les logs en temps réel
sudo journalctl -u collat-bot -f

# Afficher les logs des dernières 24 heures
sudo journalctl -u collat-bot --since "24 hours ago"

# Afficher les logs d'erreur uniquement
sudo journalctl -u collat-bot -p err
```

Des logs plus détaillés sont également disponibles dans le répertoire `/home/ubuntu/bot_collat/backend/logs/`.

### Vérification des performances

Pour vérifier les performances du système :

```bash
# Vérifier l'utilisation CPU et mémoire
htop

# Vérifier l'espace disque
df -h

# Vérifier les connexions réseau
netstat -tulpn
```

## Dépannage

### Problèmes courants

#### Le bot ne démarre pas
1. Vérifiez que le service est en cours d'exécution : `sudo systemctl status collat-bot`
2. Vérifiez les logs pour les erreurs : `sudo journalctl -u collat-bot -e`
3. Assurez-vous que la base de données est accessible : `sudo -u postgres psql -c "\\l" | grep collat_bot`
4. Vérifiez que le fichier `.env` est correctement configuré

#### Erreurs de connexion à la blockchain
1. Vérifiez que les endpoints RPC sont accessibles : `curl -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' https://your-rpc-endpoint`
2. Assurez-vous que le portefeuille contient suffisamment de SOL pour les frais de transaction
3. Vérifiez les logs pour les erreurs spécifiques à Solana

#### Problèmes de base de données
1. Vérifiez que PostgreSQL est en cours d'exécution : `sudo systemctl status postgresql`
2. Vérifiez la connexion à la base de données : `sudo -u postgres psql -c "\\c collat_bot"`
3. Assurez-vous que les migrations ont été appliquées : `npx prisma migrate status`

### Réinitialisation du bot

Si vous devez réinitialiser complètement le bot :

```bash
# Arrêter le service
sudo systemctl stop collat-bot

# Réinitialiser la base de données
sudo -u postgres psql -c "DROP DATABASE collat_bot;"
sudo -u postgres psql -c "CREATE DATABASE collat_bot OWNER collat_bot;"

# Réappliquer les migrations
cd /home/ubuntu/bot_collat/backend
npx prisma migrate deploy

# Réinitialiser la base de données avec les valeurs par défaut
npm run init:db

# Redémarrer le service
sudo systemctl start collat-bot
```

## FAQ

### Questions générales

**Q: Quelle est la stratégie de trading implémentée ?**  
R: Le bot implémente une stratégie à seuils asymétriques : il vend lorsque le prix augmente de 10% et achète lorsque le prix diminue de 5% après une vente.

**Q: Le bot fonctionne-t-il 24/7 ?**  
R: Oui, une fois démarré, le bot fonctionne en continu jusqu'à ce qu'il soit explicitement arrêté ou qu'une erreur critique se produise.

**Q: Puis-je utiliser le bot avec d'autres tokens que $COLLAT ?**  
R: Le bot est spécifiquement conçu pour le token $COLLAT, mais pourrait être adapté pour d'autres tokens avec des modifications du code.

### Questions techniques

**Q: Comment sont sécurisées les clés privées ?**  
R: Les clés privées sont stockées de manière chiffrée dans les variables d'environnement et ne sont jamais exposées dans les logs ou l'interface utilisateur.

**Q: Le bot peut-il fonctionner sur un réseau autre que Solana Mainnet ?**  
R: Oui, vous pouvez configurer le bot pour utiliser Solana Devnet ou Testnet en modifiant les endpoints RPC dans le fichier `.env`.

**Q: Quelles sont les exigences minimales pour le VPS ?**  
R: 2 CPU, 4 GB de RAM et 50 GB d'espace disque SSD sont recommandés pour des performances optimales.

### Questions de dépannage

**Q: Comment puis-je vérifier si le bot effectue des transactions ?**  
R: Consultez l'onglet "Transactions" dans l'interface d'administration ou vérifiez les logs du bot.

**Q: Que faire si le bot cesse de fonctionner soudainement ?**  
R: Vérifiez les logs pour identifier la cause du problème, redémarrez le service si nécessaire, et assurez-vous que le portefeuille contient suffisamment de fonds.

**Q: Comment puis-je modifier les seuils de trading ?**  
R: Vous pouvez modifier les seuils dans l'interface d'administration ou directement dans le fichier `.env`.
