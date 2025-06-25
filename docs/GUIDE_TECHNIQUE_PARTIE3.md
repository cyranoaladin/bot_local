# Guide Technique du Bot de Trading $COLLAT - Partie 3 : Notifications et API REST

## 1. Service de Notification (NotificationService)

Le `NotificationService` est responsable de l'envoi des alertes et notifications via différents canaux (email, Telegram) pour informer l'utilisateur des événements importants liés au bot de trading.

### Fonctionnalités principales
- Envoi d'alertes par email
- Envoi de notifications via Telegram
- Journalisation des notifications
- Gestion des erreurs de notification

### Implémentation

```typescript
// Extrait simplifié de notificationService.ts
import nodemailer from 'nodemailer';
import axios from 'axios';
import { logger } from '../../utils/logger';
import { PrismaClient } from '@prisma/client';

interface NotificationConfig {
  email: {
    service: string;
    user: string;
    password: string;
    notificationEmail: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
}

export class NotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private prisma: PrismaClient;

  constructor(private config: NotificationConfig) {
    this.prisma = new PrismaClient();
    this.initEmailTransporter();
    logger.info('Service de notification initialisé');
  }

  /**
   * Initialise le transporteur email
   */
  private initEmailTransporter(): void {
    if (
      this.config.email.service &&
      this.config.email.user &&
      this.config.email.password
    ) {
      this.emailTransporter = nodemailer.createTransport({
        service: this.config.email.service,
        auth: {
          user: this.config.email.user,
          pass: this.config.email.password,
        },
      });
      logger.info('Transporteur email initialisé');
    } else {
      logger.warn('Configuration email incomplète, notifications email désactivées');
    }
  }

  /**
   * Envoie une alerte via tous les canaux configurés
   */
  async sendAlert(title: string, message: string, level: 'info' | 'warning' | 'error' = 'info'): Promise<boolean> {
    try {
      // Enregistrer la notification dans la base de données
      await this.prisma.notification.create({
        data: {
          title,
          message,
          level,
          timestamp: new Date(),
        },
      });

      // Journaliser la notification
      logger[level](`Notification: ${title} - ${message}`);

      // Envoyer par email si configuré
      const emailSent = await this.sendEmail(title, message);

      // Envoyer par Telegram si configuré
      const telegramSent = await this.sendTelegram(title, message);

      return emailSent || telegramSent;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de la notification:', error);
      return false;
    }
  }

  /**
   * Envoie une notification par email
   */
  private async sendEmail(subject: string, text: string): Promise<boolean> {
    if (!this.emailTransporter || !this.config.email.notificationEmail) {
      return false;
    }

    try {
      const info = await this.emailTransporter.sendMail({
        from: this.config.email.user,
        to: this.config.email.notificationEmail,
        subject: `$COLLAT Bot - ${subject}`,
        text,
        html: `<p>${text.replace(/\n/g, '<br>')}</p>`,
      });

      logger.info(`Email envoyé: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de l\'email:', error);
      return false;
    }
  }

  /**
   * Envoie une notification via Telegram
   */
  private async sendTelegram(title: string, message: string): Promise<boolean> {
    if (!this.config.telegram.botToken || !this.config.telegram.chatId) {
      return false;
    }

    try {
      const telegramMessage = `*$COLLAT Bot - ${title}*\n\n${message}`;
      const url = `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`;
      
      const response = await axios.post(url, {
        chat_id: this.config.telegram.chatId,
        text: telegramMessage,
        parse_mode: 'Markdown',
      });

      if (response.data.ok) {
        logger.info('Message Telegram envoyé');
        return true;
      } else {
        logger.warn('Échec de l\'envoi du message Telegram:', response.data);
        return false;
      }
    } catch (error) {
      logger.error('Erreur lors de l\'envoi du message Telegram:', error);
      return false;
    }
  }

  /**
   * Récupère l'historique des notifications
   */
  async getNotificationHistory(limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      const notifications = await this.prisma.notification.findMany({
        take: limit,
        skip: offset,
        orderBy: {
          timestamp: 'desc',
        },
      });

      return notifications;
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'historique des notifications:', error);
      return [];
    }
  }
}
```

## 2. API REST (routes.ts)

Le module `routes.ts` définit les endpoints REST exposés par le backend pour permettre au frontend ou à d'autres clients de contrôler et surveiller le bot de trading.

### Endpoints principaux
- `/api/bot/status` : Obtenir l'état actuel du bot
- `/api/bot/start` : Démarrer le bot
- `/api/bot/stop` : Arrêter le bot
- `/api/config` : Obtenir/modifier la configuration
- `/api/transactions` : Obtenir l'historique des transactions
- `/api/portfolio/snapshots` : Obtenir les snapshots du portefeuille
- `/api/wallet/balances` : Obtenir les soldes du portefeuille
- `/api/logs` : Obtenir les journaux système

### Implémentation

```typescript
// Extrait simplifié de routes.ts
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { TradingService } from '../services/trading/tradingService';
import { PriceService } from '../services/price/priceService';
import { WalletService } from '../services/wallet/walletService';
import { authenticateToken } from '../utils/auth';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export const setupRoutes = (
  app: express.Application,
  tradingService: TradingService,
  priceService: PriceService,
  walletService: WalletService,
  prisma: PrismaClient
) => {
  const router = express.Router();

  // Middleware d'authentification pour toutes les routes
  router.use(authenticateToken);

  /**
   * Obtenir l'état actuel du bot
   */
  router.get('/bot/status', async (req: Request, res: Response) => {
    try {
      const status = await tradingService.getStatus();
      res.json(status);
    } catch (error) {
      logger.error('Erreur lors de la récupération du statut du bot:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  /**
   * Démarrer le bot
   */
  router.post('/bot/start', async (req: Request, res: Response) => {
    try {
      const success = await tradingService.start();
      
      if (success) {
        res.json({ success: true, message: 'Bot démarré avec succès' });
      } else {
        res.status(400).json({ success: false, message: 'Impossible de démarrer le bot' });
      }
    } catch (error) {
      logger.error('Erreur lors du démarrage du bot:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * Arrêter le bot
   */
  router.post('/bot/stop', async (req: Request, res: Response) => {
    try {
      const success = await tradingService.stop();
      
      if (success) {
        res.json({ success: true, message: 'Bot arrêté avec succès' });
      } else {
        res.status(400).json({ success: false, message: 'Impossible d\'arrêter le bot' });
      }
    } catch (error) {
      logger.error('Erreur lors de l\'arrêt du bot:', error);
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
  });

  /**
   * Obtenir la configuration actuelle
   */
  router.get('/config', (req: Request, res: Response) => {
    try {
      // Retourner la configuration sans les informations sensibles
      const safeConfig = {
        trading: {
          sellThreshold: config.trading.sellThreshold,
          buyThreshold: config.trading.buyThreshold,
          slippageTolerance: config.trading.slippageTolerance,
          maxTransactionPercentage: config.trading.maxTransactionPercentage,
          tokens: config.trading.tokens,
        },
        notifications: {
          emailEnabled: !!config.notifications.email.service,
          telegramEnabled: !!config.notifications.telegram.botToken,
        },
      };
      
      res.json(safeConfig);
    } catch (error) {
      logger.error('Erreur lors de la récupération de la configuration:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  /**
   * Mettre à jour la configuration
   */
  router.put('/config', async (req: Request, res: Response) => {
    try {
      const { trading } = req.body;
      
      // Valider les paramètres
      if (trading) {
        if (trading.sellThreshold !== undefined) {
          if (trading.sellThreshold < 0 || trading.sellThreshold > 100) {
            return res.status(400).json({ error: 'Le seuil de vente doit être entre 0 et 100%' });
          }
          config.trading.sellThreshold = trading.sellThreshold;
        }
        
        if (trading.buyThreshold !== undefined) {
          if (trading.buyThreshold < 0 || trading.buyThreshold > 100) {
            return res.status(400).json({ error: 'Le seuil d\'achat doit être entre 0 et 100%' });
          }
          config.trading.buyThreshold = trading.buyThreshold;
        }
        
        if (trading.slippageTolerance !== undefined) {
          if (trading.slippageTolerance < 0 || trading.slippageTolerance > 10) {
            return res.status(400).json({ error: 'La tolérance au slippage doit être entre 0 et 10%' });
          }
          config.trading.slippageTolerance = trading.slippageTolerance;
        }
        
        if (trading.maxTransactionPercentage !== undefined) {
          if (trading.maxTransactionPercentage < 1 || trading.maxTransactionPercentage > 100) {
            return res.status(400).json({ error: 'Le pourcentage maximum de transaction doit être entre 1 et 100%' });
          }
          config.trading.maxTransactionPercentage = trading.maxTransactionPercentage;
        }
      }
      
      // Enregistrer la configuration mise à jour dans la base de données
      await prisma.config.upsert({
        where: { id: 1 },
        update: {
          sellThreshold: config.trading.sellThreshold,
          buyThreshold: config.trading.buyThreshold,
          slippageTolerance: config.trading.slippageTolerance,
          maxTransactionPercentage: config.trading.maxTransactionPercentage,
          updatedAt: new Date(),
        },
        create: {
          id: 1,
          sellThreshold: config.trading.sellThreshold,
          buyThreshold: config.trading.buyThreshold,
          slippageTolerance: config.trading.slippageTolerance,
          maxTransactionPercentage: config.trading.maxTransactionPercentage,
        },
      });
      
      res.json({ success: true, config: config.trading });
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de la configuration:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  /**
   * Obtenir l'historique des transactions
   */
  router.get('/transactions', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const transactions = await prisma.trade.findMany({
        take: limit,
        skip: offset,
        orderBy: {
          timestamp: 'desc',
        },
      });
      
      res.json(transactions);
    } catch (error) {
      logger.error('Erreur lors de la récupération des transactions:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  /**
   * Obtenir les snapshots du portefeuille
   */
  router.get('/portfolio/snapshots', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const snapshots = await prisma.portfolioSnapshot.findMany({
        take: limit,
        skip: offset,
        orderBy: {
          timestamp: 'desc',
        },
      });
      
      res.json(snapshots);
    } catch (error) {
      logger.error('Erreur lors de la récupération des snapshots du portefeuille:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  /**
   * Obtenir les soldes du portefeuille
   */
  router.get('/wallet/balances', async (req: Request, res: Response) => {
    try {
      const solBalance = await walletService.getSolBalance();
      const collatBalance = await walletService.getTokenBalance(config.trading.tokens.collat.address);
      const usdcBalance = await walletService.getTokenBalance(config.trading.tokens.usdc.address);
      
      // Récupérer le prix actuel pour calculer la valeur totale
      const currentPrice = await priceService.getCurrentPrice(
        config.trading.tokens.collat.address,
        config.trading.tokens.usdc.address
      );
      
      const totalValueUsdc = collatBalance * currentPrice + usdcBalance;
      
      res.json({
        sol: solBalance,
        collat: collatBalance,
        usdc: usdcBalance,
        collatPrice: currentPrice,
        totalValueUsdc,
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des soldes du portefeuille:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  /**
   * Obtenir les journaux système
   */
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const level = req.query.level as string;
      
      const whereClause = level ? { level } : {};
      
      const logs = await prisma.log.findMany({
        where: whereClause,
        take: limit,
        skip: offset,
        orderBy: {
          timestamp: 'desc',
        },
      });
      
      res.json(logs);
    } catch (error) {
      logger.error('Erreur lors de la récupération des journaux:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  /**
   * Obtenir l'historique des notifications
   */
  router.get('/notifications', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const notifications = await prisma.notification.findMany({
        take: limit,
        skip: offset,
        orderBy: {
          timestamp: 'desc',
        },
      });
      
      res.json(notifications);
    } catch (error) {
      logger.error('Erreur lors de la récupération des notifications:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // Enregistrer les routes avec le préfixe /api
  app.use('/api', router);
};
```

## 3. Middleware d'Authentification (auth.ts)

Le middleware d'authentification (`auth.ts`) vérifie que les requêtes API proviennent de clients autorisés en utilisant un token JWT.

### Implémentation

```typescript
// Extrait simplifié de auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { logger } from './logger';

/**
 * Middleware pour vérifier le token JWT dans les requêtes API
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  // Récupérer le header d'autorisation
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    logger.warn('Tentative d\'accès sans token d\'authentification');
    return res.status(401).json({ error: 'Authentification requise' });
  }

  // Vérifier le token
  jwt.verify(token, config.apiSecret, (err: any, user: any) => {
    if (err) {
      logger.warn('Tentative d\'accès avec un token invalide');
      return res.status(403).json({ error: 'Token invalide ou expiré' });
    }
    
    // Ajouter l'utilisateur à la requête
    (req as any).user = user;
    next();
  });
};

/**
 * Générer un nouveau token API
 */
export const generateApiToken = (): string => {
  // Créer un payload avec un ID unique et une date d'expiration
  const payload = {
    id: Date.now().toString(),
    iat: Math.floor(Date.now() / 1000),
    // Token valide pendant 1 an
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
  };
  
  // Signer le token avec la clé secrète
  return jwt.sign(payload, config.apiSecret);
};
```

## 4. Script d'Initialisation de la Base de Données (initDb.ts)

Le script `initDb.ts` initialise la base de données avec les valeurs par défaut et génère un token API pour l'authentification.

### Implémentation

```typescript
// Extrait simplifié de initDb.ts
import { PrismaClient } from '@prisma/client';
import { generateApiToken } from '../utils/auth';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * Initialise la base de données avec les valeurs par défaut
 */
const initDb = async () => {
  try {
    const prisma = new PrismaClient();
    
    // Générer un token API
    const apiToken = generateApiToken();
    
    // Créer ou mettre à jour la configuration par défaut
    await prisma.config.upsert({
      where: { id: 1 },
      update: {
        sellThreshold: config.trading.sellThreshold,
        buyThreshold: config.trading.buyThreshold,
        slippageTolerance: config.trading.slippageTolerance,
        maxTransactionPercentage: config.trading.maxTransactionPercentage,
        updatedAt: new Date(),
      },
      create: {
        id: 1,
        sellThreshold: config.trading.sellThreshold,
        buyThreshold: config.trading.buyThreshold,
        slippageTolerance: config.trading.slippageTolerance,
        maxTransactionPercentage: config.trading.maxTransactionPercentage,
      },
    });
    
    // Créer ou mettre à jour le token API
    await prisma.apiToken.upsert({
      where: { id: 1 },
      update: {
        token: apiToken,
        updatedAt: new Date(),
      },
      create: {
        id: 1,
        token: apiToken,
      },
    });
    
    logger.info('Base de données initialisée avec succès');
    logger.info(`Token API généré: ${apiToken}`);
    logger.info('IMPORTANT: Conservez ce token en lieu sûr, il ne sera plus affiché');
    
    await prisma.$disconnect();
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation de la base de données:', error);
    process.exit(1);
  }
};

// Exécuter le script
initDb();
```

Dans la prochaine partie, nous examinerons la structure de la base de données et le schéma Prisma qui définit les modèles de données utilisés par le bot de trading.
