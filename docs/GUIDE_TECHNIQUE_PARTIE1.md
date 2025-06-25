# Guide Technique du Bot de Trading $COLLAT - Partie 1 : Architecture

## Introduction

Ce document technique détaille l'architecture, les composants et le fonctionnement interne du bot de trading $COLLAT. Il est destiné aux développeurs qui souhaitent comprendre, maintenir ou étendre les fonctionnalités du bot.

## Architecture globale

Le système est structuré selon une architecture en couches avec une séparation claire des responsabilités :

```
┌─────────────────────────────────┐
│           Frontend              │
│    (Interface d'administration) │
└───────────────┬─────────────────┘
                │
                │ API REST
                ▼
┌─────────────────────────────────┐
│         Backend API             │
│    (Contrôleurs et routes)      │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│        Services métier          │
│  (Trading, Prix, Portefeuille)  │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│       Couche d'accès            │
│  (Blockchain, Base de données)  │
└─────────────────────────────────┘
```

### Composants principaux

1. **Frontend** : Application React qui fournit une interface utilisateur pour contrôler et surveiller le bot
2. **Backend API** : Serveur Express qui expose des endpoints REST pour interagir avec le bot
3. **Services métier** : Modules qui implémentent la logique de trading, la récupération des prix et la gestion du portefeuille
4. **Couche d'accès** : Interactions avec la blockchain Solana via Raydium SDK et stockage persistant avec Prisma ORM

## Structure du code backend

```
backend/
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
```

## Point d'entrée de l'application

Le fichier `app.ts` est le point d'entrée principal du backend. Il initialise l'application Express, configure les middlewares, enregistre les routes API et démarre l'algorithme de trading périodique.

### Initialisation de l'application

```typescript
// Extrait simplifié de app.ts
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { config } from './config/config';
import { logger } from './utils/logger';
import { setupRoutes } from './api/routes';
import { TradingService } from './services/trading/tradingService';
import { PriceService } from './services/price/priceService';
import { WalletService } from './services/wallet/walletService';
import { NotificationService } from './services/notification/notificationService';

// Initialisation de l'application Express
const app = express();

// Configuration des middlewares
app.use(cors());
app.use(express.json());

// Initialisation des services
const prisma = new PrismaClient();
const walletService = new WalletService(config.wallet);
const priceService = new PriceService(config.rpc);
const notificationService = new NotificationService(config.notifications);
const tradingService = new TradingService(
  walletService,
  priceService,
  notificationService,
  prisma,
  config.trading
);

// Configuration des routes API
setupRoutes(app, tradingService, priceService, walletService, prisma);

// Démarrage du serveur
const PORT = config.port || 3001;
app.listen(PORT, () => {
  logger.info(`Serveur démarré sur le port ${PORT}`);
});

// Exécution périodique de l'algorithme de trading
let tradingInterval: NodeJS.Timeout | null = null;

// Fonction pour démarrer l'exécution périodique
export const startTradingAlgorithm = async () => {
  if (tradingInterval) {
    return;
  }
  
  // Exécuter immédiatement une première fois
  try {
    await tradingService.runTradingAlgorithm();
  } catch (error) {
    logger.error('Erreur lors de l\'exécution de l\'algorithme de trading:', error);
  }
  
  // Configurer l'exécution périodique (toutes les 2 minutes)
  tradingInterval = setInterval(async () => {
    try {
      await tradingService.runTradingAlgorithm();
    } catch (error) {
      logger.error('Erreur lors de l\'exécution de l\'algorithme de trading:', error);
    }
  }, 2 * 60 * 1000);
  
  logger.info('Algorithme de trading démarré');
};

// Fonction pour arrêter l'exécution périodique
export const stopTradingAlgorithm = () => {
  if (tradingInterval) {
    clearInterval(tradingInterval);
    tradingInterval = null;
    logger.info('Algorithme de trading arrêté');
  }
};
```

## Configuration

Le module de configuration (`config.ts`) est responsable du chargement des variables d'environnement et de la définition des paramètres par défaut.

```typescript
// Extrait simplifié de config.ts
import dotenv from 'dotenv';
import path from 'path';

// Charger les variables d'environnement
dotenv.config();

// Configuration de l'application
export const config = {
  // Configuration générale
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiSecret: process.env.API_SECRET || 'default_secret_key',
  
  // Configuration RPC Solana
  rpc: {
    primaryEndpoint: process.env.PRIMARY_RPC_ENDPOINT || 'https://kamel-solanam-876d.mainnet.rpcpool.com',
    secondaryEndpoint: process.env.SECONDARY_RPC_ENDPOINT || 'https://rpc.triton.one',
  },
  
  // Configuration du portefeuille
  wallet: {
    privateKey: process.env.WALLET_PRIVATE_KEY || '',
  },
  
  // Configuration du trading
  trading: {
    sellThreshold: parseFloat(process.env.SELL_THRESHOLD || '10'),
    buyThreshold: parseFloat(process.env.BUY_THRESHOLD || '5'),
    slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '1.5'),
    maxTransactionPercentage: parseFloat(process.env.MAX_TRANSACTION_PERCENTAGE || '50'),
    callIntervalMs: parseInt(process.env.API_CALL_INTERVAL_MS || '1000', 10),
    maxCallsPerDay: parseInt(process.env.MAX_API_CALLS_PER_DAY || '8640000', 10),
    tokens: {
      collat: {
        address: 'C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ',
        decimals: 6,
      },
      usdc: {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
      },
    },
  },
  
  // Configuration des notifications
  notifications: {
    email: {
      service: process.env.EMAIL_SERVICE || '',
      user: process.env.EMAIL_USER || '',
      password: process.env.EMAIL_PASSWORD || '',
      notificationEmail: process.env.NOTIFICATION_EMAIL || '',
    },
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
    },
  },
};
```

## Journalisation

Le module de journalisation (`logger.ts`) utilise Winston pour enregistrer les événements et les erreurs du système.

```typescript
// Extrait simplifié de logger.ts
import winston from 'winston';
import path from 'path';
import { config } from '../config/config';

// Définir les niveaux de log
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Définir les couleurs pour chaque niveau
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Ajouter les couleurs à Winston
winston.addColors(colors);

// Définir le format de log
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Définir les transports (où les logs seront stockés)
const transports = [
  // Logs de console
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      format
    ),
  }),
  // Logs d'erreur dans un fichier
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
  }),
  // Tous les logs dans un fichier
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
  }),
];

// Créer l'instance de logger
export const logger = winston.createLogger({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
});
```

Dans la prochaine partie, nous examinerons en détail les services métier qui constituent le cœur du bot de trading.
