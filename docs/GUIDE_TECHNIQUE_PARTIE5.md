# Guide Technique du Bot de Trading $COLLAT - Partie 5 : Déploiement et Configuration

## 8. Déploiement et configuration

## 8.1 Environnement de déploiement

Le bot $COLLAT est conçu pour fonctionner dans un environnement Linux avec Node.js. La configuration recommandée est la suivante :

### 8.1.1 Prérequis système
- **Système d'exploitation** : Linux (Ubuntu 20.04 LTS ou plus récent recommandé)
- **Node.js** : v16.x ou plus récent
- **NPM** : v8.x ou plus récent
- **PM2** : Pour la gestion des processus
- **Mémoire** : Minimum 2 GB RAM
- **Stockage** : Minimum 20 GB d'espace disque
- **Réseau** : Connexion Internet stable

### 8.1.2 Architecture de déploiement

Le déploiement se compose de deux parties principales :
1. **Backend** : Serveur Node.js exécuté via PM2
2. **Frontend** : Application React servie par un serveur statique

```
┌─────────────────┐     HTTP (3002)     ┌─────────────────┐
│                 │◄────────────────────┤                 │
│    Frontend     │                     │     Client      │
│    (serve)      │────────────────────►│    (Browser)    │
│                 │                     │                 │
└────────┬────────┘                     └─────────────────┘
         │
         │ Internal
         │ Communication
         ▼
┌─────────────────┐     HTTP (3001)     ┌─────────────────┐
│                 │◄────────────────────┤                 │
│     Backend     │                     │     Client      │
│     (PM2)       │────────────────────►│     (API)       │
│                 │                     │                 │
└────────┬────────┘                     └─────────────────┘
         │
         │
         ▼
┌─────────────────┐
│                 │
│     SQLite      │
│   Database      │
│                 │
└─────────────────┘
```

## 8.2 Installation et configuration

### 8.2.1 Installation des dépendances

```bash
# Installer Node.js et npm
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Vérifier les versions
node -v  # Devrait afficher v16.x.x
npm -v   # Devrait afficher v8.x.x

# Installer PM2 globalement
npm install -g pm2

# Installer serve pour le frontend
npm install -g serve
```

### 8.2.2 Configuration du backend

```bash
# Naviguer vers le répertoire du backend
cd /home/alaeddine/Documents/bot_collat_local/backend

# Installer les dépendances
npm install

# Générer le schéma Prisma
npx prisma generate

# Exécuter les migrations de base de données
npx prisma migrate deploy

# Compiler le TypeScript
npm run build

# Configurer PM2
pm2 start dist/app.js --name collat-backend
pm2 save
```

### 8.2.3 Configuration du frontend

```bash
# Naviguer vers le répertoire du frontend
cd /home/alaeddine/Documents/bot_collat_local

# Installer les dépendances
npm install

# Compiler le frontend
npm run build

# Démarrer le serveur frontend avec PM2
pm2 start --name collat-frontend -- npx serve -s dist -l tcp://0.0.0.0:3002
pm2 save
```

### 8.2.4 Configuration du démarrage automatique

```bash
# Configurer PM2 pour démarrer automatiquement au démarrage du système
pm2 startup
# Suivre les instructions affichées

# Sauvegarder la configuration PM2
pm2 save
```

## 8.3 Configuration des variables d'environnement

### 8.3.1 Variables d'environnement du backend

Créer un fichier `.env` dans le répertoire du backend :

```
# Port du serveur backend
PORT=3001

# Secret pour les JWT
JWT_SECRET=votre_secret_jwt_securise

# Durée de validité des JWT
JWT_EXPIRES_IN=24h

# URL de la base de données
DATABASE_URL="file:../data/bot.db"

# Endpoints RPC Solana (séparés par des virgules)
RPC_ENDPOINTS=https://mainnet.helius-rpc.com/?api-key=your_api_key_here,https://rpc.triton.one

# Adresses des tokens
COLLAT_ADDRESS=C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ
USDC_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Intervalle de vérification des prix (en millisecondes)
PRICE_CHECK_INTERVAL=60000

# Environnement (development ou production)
NODE_ENV=production
```

### 8.3.2 Variables d'environnement du frontend

Créer un fichier `.env.production` dans le répertoire du frontend :

```
# URL de l'API backend
VITE_API_URL=http://192.168.1.16:3001/api

# URL WebSocket
VITE_WEBSOCKET_URL=http://192.168.1.16:3001

# Endpoint RPC Solana principal
VITE_PRIMARY_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=your_api_key_here

# Adresses des tokens
VITE_COLLAT_ADDRESS=C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ
VITE_USDC_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

## 8.4 Configuration du bot

### 8.4.1 Configuration par défaut

La configuration par défaut du bot est stockée dans la base de données et peut être modifiée via l'interface utilisateur ou directement dans la base de données :

```typescript
// Configuration par défaut
const defaultConfig = {
  sellThreshold: 10,           // Pourcentage de hausse pour vendre
  buyThreshold: 5,             // Pourcentage de baisse pour acheter
  slippageTolerance: 1.5,      // Tolérance de slippage en pourcentage
  maxTransactionPercentage: 50, // Pourcentage maximum du portefeuille par transaction
  dailyBuyLimit: 1000,         // Limite quotidienne d'achat en USDC
  dailySellLimit: 1000,        // Limite quotidienne de vente en COLLAT
  priceCheckInterval: 60000,   // Intervalle de vérification des prix en ms
  autoLockTimeout: 30 * 60000  // Délai de verrouillage automatique en ms
};

// Initialisation de la configuration
async function initializeConfig() {
  const existingConfig = await prisma.configuration.findFirst();
  
  if (!existingConfig) {
    await prisma.configuration.create({
      data: defaultConfig
    });
    
    logger.info('Default configuration initialized');
  }
}
```

### 8.4.2 Script d'initialisation

Un script d'initialisation est fourni pour configurer la base de données et les paramètres par défaut :

```typescript
// Script d'initialisation
async function initialize() {
  try {
    logger.info('Initializing bot...');
    
    // Initialiser la configuration
    await initializeConfig();
    
    // Initialiser l'état du bot
    const existingState = await prisma.botState.findFirst();
    
    if (!existingState) {
      await prisma.botState.create({
        data: {
          id: 1,
          isActive: false,
          lastPrice: 0,
          lastCheck: new Date()
        }
      });
      
      logger.info('Bot state initialized');
    }
    
    // Initialiser les informations du portefeuille
    const existingWalletInfo = await prisma.walletInfo.findFirst();
    
    if (!existingWalletInfo) {
      await prisma.walletInfo.create({
        data: {
          id: 1,
          isConfigured: false
        }
      });
      
      logger.info('Wallet info initialized');
    }
    
    logger.info('Initialization complete');
  } catch (error) {
    logger.error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
```

## 8.5 Gestion des processus avec PM2

### 8.5.1 Configuration PM2

Le fichier `ecosystem.config.js` définit la configuration PM2 :

```javascript
module.exports = {
  apps: [
    {
      name: 'collat-backend',
      script: 'dist/app.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      merge_logs: true
    },
    {
      name: 'collat-frontend',
      script: 'npx',
      args: 'serve -s dist -l tcp://0.0.0.0:3002',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/frontend-error.log',
      out_file: 'logs/frontend-output.log',
      merge_logs: true
    }
  ]
};
```

### 8.5.2 Commandes PM2 utiles

```bash
# Démarrer les applications
pm2 start ecosystem.config.js

# Vérifier l'état des applications
pm2 status

# Consulter les logs
pm2 logs collat-backend
pm2 logs collat-frontend

# Redémarrer les applications
pm2 restart collat-backend
pm2 restart collat-frontend

# Arrêter les applications
pm2 stop collat-backend
pm2 stop collat-frontend

# Supprimer les applications de PM2
pm2 delete collat-backend
pm2 delete collat-frontend

# Monitorer les performances
pm2 monit
```

## 8.6 Sauvegarde et restauration

### 8.6.1 Sauvegarde de la base de données

```bash
# Créer un répertoire de sauvegarde
mkdir -p /home/alaeddine/Documents/bot_collat_local/backups

# Sauvegarder la base de données
cp /home/alaeddine/Documents/bot_collat_local/backend/data/bot.db /home/alaeddine/Documents/bot_collat_local/backups/bot_$(date +%Y%m%d_%H%M%S).db

# Script de sauvegarde automatique
cat > /home/alaeddine/Documents/bot_collat_local/backup.sh << 'EOS'
#!/bin/bash
BACKUP_DIR="/home/alaeddine/Documents/bot_collat_local/backups"
DB_FILE="/home/alaeddine/Documents/bot_collat_local/backend/data/bot.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Créer le répertoire de sauvegarde s'il n'existe pas
mkdir -p $BACKUP_DIR

# Copier la base de données
cp $DB_FILE $BACKUP_DIR/bot_$TIMESTAMP.db

# Nettoyer les anciennes sauvegardes (garder les 10 plus récentes)
ls -t $BACKUP_DIR/bot_*.db | tail -n +11 | xargs -r rm

echo "Backup completed: $BACKUP_DIR/bot_$TIMESTAMP.db"
EOS

# Rendre le script exécutable
chmod +x /home/alaeddine/Documents/bot_collat_local/backup.sh

# Ajouter une tâche cron pour la sauvegarde quotidienne
(crontab -l 2>/dev/null; echo "0 0 * * * /home/alaeddine/Documents/bot_collat_local/backup.sh") | crontab -
```

### 8.6.2 Restauration de la base de données

```bash
# Arrêter le backend
pm2 stop collat-backend

# Restaurer la base de données
cp /home/alaeddine/Documents/bot_collat_local/backups/bot_YYYYMMDD_HHMMSS.db /home/alaeddine/Documents/bot_collat_local/backend/data/bot.db

# Redémarrer le backend
pm2 restart collat-backend
```

## 8.7 Mise à jour du système

### 8.7.1 Mise à jour du code

```bash
# Naviguer vers le répertoire du projet
cd /home/alaeddine/Documents/bot_collat_local

# Récupérer les dernières modifications
git pull

# Mettre à jour les dépendances du backend
cd backend
npm install
npx prisma generate
npm run build

# Mettre à jour les dépendances du frontend
cd ..
npm install
npm run build

# Redémarrer les services
pm2 restart all
```

### 8.7.2 Migration de la base de données

```bash
# Naviguer vers le répertoire du backend
cd /home/alaeddine/Documents/bot_collat_local/backend

# Exécuter les migrations
npx prisma migrate deploy

# Redémarrer le backend
pm2 restart collat-backend
```
