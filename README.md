# $COLLAT Trading Bot pour Solana

## Aperçu général
Ce projet est un robot de trading automatisé pour le token $COLLAT sur la blockchain Solana. Le robot implémente une stratégie à seuils asymétriques avec l'objectif d'atteindre 10% de gains composés quotidiens en exploitant les fluctuations de prix du token $COLLAT par rapport à l'USDC.

Le système est composé d'un backend Node.js autonome qui gère la logique de trading et d'une interface utilisateur React pour l'administration et la surveillance du bot.

## Table des matières
- [Fonctionnalités](#fonctionnalités)
- [Architecture du système](#architecture-du-système)
- [Stack technique](#stack-technique)
- [Stratégie de trading](#stratégie-de-trading)
- [Composants principaux](#composants-principaux)
- [Installation et configuration](#installation-et-configuration)
- [API et intégrations](#api-et-intégrations)
- [Endpoints RPC](#endpoints-rpc)
- [Sécurité](#sécurité)
- [Déploiement](#déploiement)
- [Tests](#tests)
- [Dépannage](#dépannage)
- [Licence](#licence)

## Fonctionnalités
- **Connexion au portefeuille**: Intégration transparente avec le portefeuille Phantom
- **Tableau de bord en temps réel**: Surveillance de la valeur du portefeuille, des performances et de l'activité de trading
- **Paramètres de trading configurables**: Personnalisation des seuils d'achat/vente, des gains cibles et de la tolérance au slippage
- **Historique des transactions**: Visualisation et exportation de l'activité de trading
- **Contrôles d'urgence**: Fonctionnalité d'arrêt immédiat pour la gestion des risques
- **Suivi des performances**: Graphiques de performance et statistiques en temps réel

## Architecture du système
Le système est composé de deux parties principales :

### 1. Backend (Serveur autonome)
```
bot_collat/backend/
├── src/
│   ├── api/                  # API REST
│   │   └── routes.ts         # Définition des routes API
│   ├── config/               # Configuration
│   │   └── config.ts         # Chargement des variables d'environnement
│   ├── db/                   # Couche d'accès aux données
│   │   └── prisma/           # Modèles et client Prisma
│   ├── services/             # Services métier
│   │   ├── wallet/           # Service de gestion du portefeuille
│   │   ├── price/            # Service de récupération des prix
│   │   ├── trading/          # Service de trading
│   │   └── notification/     # Service de notification
│   ├── utils/                # Utilitaires
│   │   ├── logger.ts         # Système de journalisation
│   │   └── auth.ts           # Middleware d'authentification
│   ├── types/                # Définitions de types TypeScript
│   └── app.ts                # Point d'entrée de l'application
│
├── prisma/                   # Schéma et migrations Prisma
│   └── schema.prisma         # Définition du schéma de base de données
│
├── deployment/               # Scripts de déploiement
│   ├── deploy.sh             # Script de déploiement principal
│   ├── backup.sh             # Script de sauvegarde
│   └── collat-bot.service    # Configuration du service systemd
│
├── logs/                     # Répertoire des journaux
├── .env.example              # Exemple de fichier de variables d'environnement
└── tsconfig.json             # Configuration TypeScript
```

### 2. Frontend (Interface d'administration)
```
bot_collat/
├── src/
│   ├── components/           # Composants React
│   │   ├── dashboard/        # Composants du tableau de bord
│   │   └── wallet/           # Composants liés au portefeuille
│   ├── hooks/                # Hooks personnalisés
│   │   ├── useTradingBot.ts  # Hook pour gérer les opérations du bot
│   │   └── useApi.ts         # Hook pour les appels API
│   ├── api/                  # Client API
│   │   └── apiClient.ts      # Client pour communiquer avec le backend
│   ├── store/                # Gestion d'état global
│   │   └── useTradeStore.ts  # Store Zustand
│   ├── config/               # Configuration
│   │   └── constants.ts      # Constantes et configuration par défaut
│   ├── App.tsx               # Composant racine
│   └── main.tsx              # Point d'entrée
│
├── public/                   # Ressources statiques
├── tailwind.config.js        # Configuration de Tailwind CSS
└── vite.config.ts            # Configuration de Vite
```

## Stack technique

### Backend
- **Runtime**: 
  - Node.js 18.x avec TypeScript
  - Express 4.x pour l'API REST
- **Base de données**:
  - PostgreSQL pour le stockage persistant
  - Prisma ORM pour l'accès aux données
- **Intégration Solana**:
  - `@solana/web3.js`: SDK principal pour interagir avec la blockchain Solana
  - `@raydium-io/raydium-sdk`: SDK pour l'intégration avec Raydium DEX
- **Sécurité**:
  - jsonwebtoken pour l'authentification API
  - dotenv pour la gestion des variables d'environnement
- **Notifications**:
  - Nodemailer pour les alertes par email
  - Axios pour les webhooks Telegram
- **Journalisation**:
  - Winston pour la gestion des logs

### Frontend
- **Framework**: 
  - React 18.3.1 avec TypeScript 5.8.3
  - Vite 6.3.5 comme bundler et serveur de développement
  - Tailwind CSS 3.3.3 pour le styling
- **Intégration Solana**:
  - `@solana/web3.js` v1.98.2: SDK principal pour interagir avec la blockchain Solana
  - `@solana/wallet-adapter-react` v0.15.38: Adaptateur React pour les portefeuilles Solana
  - `@solana/wallet-adapter-phantom` v0.9.27: Adaptateur spécifique pour Phantom
  - `@solana/wallet-adapter-react-ui` v0.9.38: Composants UI pour l'adaptateur de portefeuille
- **Communication API**:
  - Axios pour les appels HTTP vers le backend
- **Visualisation de données**:
  - Chart.js v4.4.9 et react-chartjs-2 v5.3.0 pour les graphiques de performance
- **Gestion d'état**:
  - Zustand v5.0.5 pour la gestion d'état global
- **UI/UX**:
  - FontAwesome pour les icônes
  - class-variance-authority et clsx pour la gestion des classes conditionnelles
  - lucide-react pour les icônes supplémentaires

## Stratégie de trading
Le robot implémente une stratégie à seuils asymétriques basée sur les principes suivants:

### Logique fondamentale
- **Condition de vente**: Vendre lorsque le prix augmente du pourcentage `sellThreshold` (par défaut: 5%)
- **Condition d'achat**: Acheter lorsque le prix diminue du pourcentage `buyThreshold` (par défaut: 3%)
- **Objectif**: 10% de gains composés quotidiens

### Paramètres configurables
- **Seuil de vente** (`sellThreshold`): Pourcentage d'augmentation du prix qui déclenche une vente
- **Seuil d'achat** (`buyThreshold`): Pourcentage de diminution du prix qui déclenche un achat
- **Gain cible** (`targetGain`): Objectif quotidien de gain en pourcentage
- **Tolérance au slippage** (`slippage`): Pourcentage maximum de slippage accepté lors des transactions

### Mécanisme d'exécution
1. Le robot surveille en continu le prix du token $COLLAT par rapport à l'USDC
2. Lorsqu'une condition d'achat ou de vente est remplie, le robot exécute automatiquement la transaction via Jupiter Aggregator
3. Après chaque transaction, le prix d'entrée est mis à jour pour les futures conditions
4. Le robot continue de fonctionner jusqu'à ce qu'il soit arrêté manuellement ou que l'objectif quotidien soit atteint

### Gestion des risques
- Transactions limitées à 50% des avoirs disponibles pour chaque opération
- Arrêt d'urgence disponible à tout moment
- Paramètres de slippage configurables pour éviter les pertes importantes lors de faible liquidité

## Composants principaux

### Dashboard
Le tableau de bord principal (`Dashboard.tsx`) est le composant central qui organise l'interface utilisateur en trois colonnes:
- **Colonne gauche**: Affichage du solde du portefeuille et configuration du robot
- **Colonne centrale**: Statistiques de performance et contrôles du robot
- **Colonne droite**: Historique des transactions

### BotControl
Le composant `BotControl.tsx` gère le démarrage et l'arrêt du robot de trading. Il vérifie que le portefeuille est connecté avant de permettre l'activation du robot.

### BotConfig
Le composant `BotConfig.tsx` permet à l'utilisateur de configurer les paramètres de trading:
- Seuil de vente (%)
- Seuil d'achat (%)
- Gain cible quotidien (%)
- Tolérance au slippage (%)

### WalletProvider
Le composant `WalletProvider.tsx` configure l'intégration avec les portefeuilles Solana, en particulier Phantom. Il utilise la détection automatique des portefeuilles disponibles.

### useTradingBot
Le hook personnalisé `useTradingBot.ts` gère le cycle de vie du robot de trading:
- Initialisation du robot lorsqu'il est activé
- Exécution périodique de l'algorithme de trading (toutes les 30 secondes)
- Nettoyage des ressources lorsque le robot est arrêté

### tradingLogic
Le module `tradingLogic.ts` contient l'implémentation de l'algorithme de trading:
- Fonction `getRaydiumPrice`: Obtient le prix actuel du token (simulé dans la version actuelle)
- Fonction `jupiterSwap`: Exécute les swaps via Jupiter Aggregator (simulé dans la version actuelle)
- Fonction `runTradingAlgorithm`: Fonction principale qui évalue les conditions et exécute les transactions

### useTradeStore
Le store global `useTradeStore.ts` utilise Zustand pour gérer l'état de l'application:
- Configuration du robot
- État d'activité
- Prix d'entrée et prix actuel
- Valeur du portefeuille et profit quotidien
- Historique des transactions

## Installation et configuration

### Prérequis
- Node.js 18.x ou supérieur
- npm 9.x ou supérieur
- PostgreSQL 14.x ou supérieur
- Un portefeuille Solana avec des fonds en SOL, USDC et $COLLAT

### Installation du backend

```bash
# Cloner le dépôt
git clone [URL_DU_REPO]
cd bot_collat/backend

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer le fichier .env avec vos informations

# Générer les types Prisma
npx prisma generate

# Appliquer les migrations de base de données
npx prisma migrate deploy

# Initialiser la base de données avec les valeurs par défaut
npm run init:db

# Compiler le code TypeScript
npm run build

# Démarrer le serveur en mode développement
npm run dev

# Ou démarrer le serveur en mode production
npm run start
```

### Installation du frontend

```bash
# Dans un autre terminal, naviguer vers le répertoire du frontend
cd bot_collat

# Installer les dépendances
npm install

# Configurer l'URL de l'API dans .env.local
echo "VITE_API_URL=http://localhost:3001/api" > .env.local

# Lancer le serveur de développement
npm run dev

# Construire pour la production
npm run build

# Prévisualiser la version de production
npm run preview
```

### Configuration par défaut
La configuration par défaut est définie dans `src/config/constants.ts`:

```typescript
export const DEFAULT_CONFIG = {
  tokenAddress: "C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ", // $COLLAT
  stablecoin: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  sellThreshold: 5, // %
  buyThreshold: 3,  // %
  targetGain: 10,   // %
  slippage: 1.5     // %
};
```

### Informations sur les tokens
```typescript
export const TOKEN_INFO = {
  COLLAT: {
    symbol: "COLLAT",
    address: "C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ",
    decimals: 6 // À vérifier
  },
  USDC: {
    symbol: "USDC",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6
  }
};
```

## API et intégrations

### Solana Web3.js
L'application utilise `@solana/web3.js` pour interagir avec la blockchain Solana:
- Création de connexions RPC
- Interrogation des soldes de tokens
- Soumission de transactions

### Wallet Adapter
L'intégration des portefeuilles est gérée par `@solana/wallet-adapter-react`:
- Détection automatique des portefeuilles disponibles
- Connexion et déconnexion du portefeuille
- Signature des transactions

### Jupiter Aggregator
Pour les swaps de tokens, l'application est conçue pour utiliser Jupiter Aggregator via `@jup-ag/react-hook`:
- Recherche des meilleures routes de swap
- Exécution des swaps avec slippage minimal
- Obtention des prix en temps réel

**Note**: Dans la version actuelle, les fonctions Jupiter sont simulées pour des fins de démonstration.

## Endpoints RPC
L'application est configurée pour utiliser les endpoints RPC suivants:

```typescript
export const RPC_ENDPOINTS = [
  "https://mainnet.helius-rpc.com/?api-key=d94d81dd-f2a1-40f7-920d-0dfaf3aaf032",
  "https://rpc.triton.one"
];

export const PRIMARY_RPC_ENDPOINT = RPC_ENDPOINTS[0];
```

Le premier endpoint (Helius) est utilisé par défaut, avec Triton comme fallback.

## Sécurité

### Modèle de sécurité
- **Aucune clé privée stockée**: L'application ne stocke jamais les clés privées des utilisateurs
- **Signature des transactions**: Toutes les transactions nécessitent une signature explicite via le portefeuille Phantom
- **Configuration locale**: Les paramètres de configuration sont stockés localement et ne sont pas partagés

### Bonnes pratiques
- Utilisation de connexions HTTPS pour tous les endpoints RPC
- Validation des entrées utilisateur pour les paramètres de configuration
- Limitation des transactions à 50% des avoirs pour réduire les risques

### Limitations actuelles
- La version actuelle simule les prix et les transactions pour des fins de démonstration
- Dans un environnement de production, des mesures de sécurité supplémentaires seraient nécessaires

## Déploiement sur VPS

### Prérequis pour le VPS
- Ubuntu Server 22.04 LTS ou supérieur
- Minimum 2 CPU, 4GB RAM
- 50GB d'espace disque SSD

### Déploiement automatisé
Le projet inclut un script de déploiement automatisé qui configure l'ensemble du système sur un VPS Ubuntu:

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

Le script effectue les opérations suivantes:
1. Installation des dépendances système (Node.js, PostgreSQL, Nginx, etc.)
2. Configuration de la base de données PostgreSQL
3. Configuration du backend avec les variables d'environnement
4. Compilation du code TypeScript
5. Configuration du service systemd pour le démarrage automatique
6. Configuration de Nginx comme proxy inverse
7. Configuration de HTTPS avec Let's Encrypt

### Sauvegardes automatiques
Un script de sauvegarde est également fourni pour sauvegarder régulièrement la base de données et les fichiers de configuration:

```bash
# Rendre le script exécutable
chmod +x backup.sh

# Exécuter le script de sauvegarde manuellement
sudo ./backup.sh

# Ou configurer une tâche cron pour une exécution quotidienne
sudo crontab -e
# Ajouter la ligne suivante pour une exécution quotidienne à 2h du matin
0 2 * * * /home/ubuntu/bot_collat/backend/deployment/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```

### Surveillance et maintenance
- **Logs du service**: `journalctl -u collat-bot -f`
- **Redémarrage du service**: `sudo systemctl restart collat-bot`
- **Vérification du statut**: `sudo systemctl status collat-bot`
- **Mise à jour du code**:
  ```bash
  cd /home/ubuntu/bot_collat
  git pull
  cd backend
  npm install
  npm run build
  sudo systemctl restart collat-bot
  ```
L'application est configurée pour être déployée sur Vercel, mais peut être déployée sur n'importe quel service d'hébergement statique.

### Configuration Vercel
Le fichier `vercel.json` contient la configuration pour le déploiement sur Vercel:
- Redirection des routes vers l'application SPA
- Configuration des en-têtes de sécurité

### Étapes de déploiement

```bash
# Construire l'application
npm run build

# Déployer sur Vercel (si CLI Vercel est installé)
vercel

# Ou déployer manuellement en téléchargeant le dossier 'dist'
```

## Tests

### Portefeuille de test
Pour les tests, utilisez le portefeuille suivant:
```
FKxNTsxE83WwGSqLs7o6mWYPaZybZPFgKr3B7m7x2qxf
```

Ce portefeuille doit être approvisionné avec:
- 0.1 SOL (pour les frais de transaction)
- 5 USDC (pour les trades initiaux)
- 1000 $COLLAT (pour les trades initiaux)

### Tests manuels
1. Connecter le portefeuille Phantom
2. Configurer les paramètres du robot
3. Démarrer le robot et observer les transactions
4. Vérifier que les conditions d'achat/vente fonctionnent correctement
5. Tester l'arrêt d'urgence

## Dépannage

### Problèmes courants et solutions

#### Le portefeuille ne se connecte pas
- Vérifier que l'extension Phantom est installée et déverrouillée
- Vérifier que vous êtes sur le réseau Solana Mainnet
- Rafraîchir la page et réessayer

#### Les transactions échouent
- Vérifier que vous avez suffisamment de SOL pour les frais de transaction
- Vérifier que vous avez suffisamment de tokens pour l'échange
- Vérifier que le slippage n'est pas trop restrictif

#### Le robot ne démarre pas
- Vérifier que le portefeuille est connecté
- Vérifier que la configuration est valide
- Vérifier les erreurs dans la console du navigateur

## Licence
Privée - Tous droits réservés
