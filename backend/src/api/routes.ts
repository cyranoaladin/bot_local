import express, { Application, Request, Response, RequestHandler } from 'express';
import { tradingService } from '../services/trading/tradingService';
import { walletService } from '../services/wallet/walletService';
import { priceService } from '../services/price/priceService';
import { PrismaClient } from '@prisma/client';
// Import logger from the utils index file
import { logger } from '../utils';
// Import auth middleware from the utils index file
import { authenticateJWT } from '../utils';

/**
 * Configure les routes de l'API
 */
export const setupRoutes = (app: Application): void => {
  const router = express.Router();
  const prisma = new PrismaClient();

  // Middleware d'authentification pour toutes les routes
  router.use(authenticateJWT as RequestHandler);

  // Routes pour le bot
  router.get('/bot/status', (async (req: Request, res: Response) => {
    try {
      const botState = await tradingService.getBotState();
      res.json(botState);
    } catch (error) {
      logger.error(`Error getting bot status: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to get bot status' });
    }
  }) as RequestHandler);

  router.post('/bot/start', (async (req: Request, res: Response) => {
    try {
      const result = await tradingService.start();
      if (result) {
        res.json({ success: true, message: 'Bot started successfully' });
      } else {
        res.status(400).json({ success: false, message: 'Failed to start bot' });
      }
    } catch (error) {
      logger.error(`Error starting bot: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }) as RequestHandler);

  router.post('/bot/stop', (async (req: Request, res: Response) => {
    try {
      const result = await tradingService.stop();
      if (result) {
        res.json({ success: true, message: 'Bot stopped successfully' });
      } else {
        res.status(400).json({ success: false, message: 'Failed to stop bot' });
      }
    } catch (error) {
      logger.error(`Error stopping bot: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }) as RequestHandler);

  // Routes pour la configuration
  router.get('/config', (async (req: Request, res: Response) => {
    try {
      const config = await prisma.configuration.findFirst();
      res.json(config || {});
    } catch (error) {
      logger.error(`Error getting config: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to get configuration' });
    }
  }) as RequestHandler);

  router.put('/config', (async (req: Request, res: Response) => {
    try {
      const { sellThreshold, buyThreshold, slippageTolerance, maxTransactionPercentage } = req.body;

      // Validation
      const errors = [];

      if (sellThreshold !== undefined && (isNaN(sellThreshold) || sellThreshold < 0 || sellThreshold > 100)) {
        errors.push('Sell threshold must be between 0 and 100');
      }

      if (buyThreshold !== undefined && (isNaN(buyThreshold) || buyThreshold < 0 || buyThreshold > 100)) {
        errors.push('Buy threshold must be between 0 and 100');
      }

      if (slippageTolerance !== undefined && (isNaN(slippageTolerance) || slippageTolerance < 0 || slippageTolerance > 10)) {
        errors.push('Slippage tolerance must be between 0 and 10');
      }

      if (maxTransactionPercentage !== undefined && (isNaN(maxTransactionPercentage) || maxTransactionPercentage < 1 || maxTransactionPercentage > 100)) {
        errors.push('Max transaction percentage must be between 1 and 100');
      }

      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }

      // Mise à jour de la configuration
      const updatedConfig = await prisma.configuration.upsert({
        where: { id: 1 },
        update: {
          ...(sellThreshold !== undefined && { sellThreshold }),
          ...(buyThreshold !== undefined && { buyThreshold }),
          ...(slippageTolerance !== undefined && { slippageTolerance }),
          ...(maxTransactionPercentage !== undefined && { maxTransactionPercentage }),
          updatedAt: new Date(),
        },
        create: {
          id: 1,
          sellThreshold: sellThreshold ?? 10,
          buyThreshold: buyThreshold ?? 5,
          slippageTolerance: slippageTolerance ?? 1.5,
          maxTransactionPercentage: maxTransactionPercentage ?? 50,
        },
      });

      res.json(updatedConfig);
    } catch (error) {
      logger.error(`Error updating config: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }) as RequestHandler);

  // Routes pour les transactions
  router.get('/transactions', (async (req: Request, res: Response) => {
    try {
      const { limit = 50, offset = 0 } = req.query;

      const transactions = await prisma.transaction.findMany({
        take: Number(limit),
        skip: Number(offset),
        orderBy: {
          timestamp: 'desc',
        },
      });

      const total = await prisma.transaction.count();

      res.json({
        transactions,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      });
    } catch (error) {
      logger.error(`Error getting transactions: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to get transactions' });
    }
  }) as RequestHandler);

  // Routes pour les snapshots du portefeuille
  router.get('/portfolio/snapshots', (async (req: Request, res: Response) => {
    try {
      const { limit = 30, offset = 0 } = req.query;

      const snapshots = await prisma.portfolioSnapshot.findMany({
        take: Number(limit),
        skip: Number(offset),
        orderBy: {
          timestamp: 'desc',
        },
      });

      const total = await prisma.portfolioSnapshot.count();

      res.json({
        snapshots,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total,
        },
      });
    } catch (error) {
      logger.error(`Error getting portfolio snapshots: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to get portfolio snapshots' });
    }
  }) as RequestHandler);

  // Routes pour les soldes du portefeuille
  router.get('/wallet/balances', (async (req: Request, res: Response) => {
    try {
      const collatBalance = await walletService.getTokenBalance(priceService['collatAddress']);
      const usdcBalance = await walletService.getTokenBalance(priceService['usdcAddress']);
      const solBalance = await walletService.getSolBalance();

      // Get current price
      const currentPrice = await priceService.getCurrentPrice();

      res.json({
        collat: collatBalance,
        usdc: usdcBalance,
        sol: solBalance,
        collatPrice: currentPrice,
        totalValueUsdc: collatBalance * currentPrice + usdcBalance,
      });
    } catch (error) {
      logger.error(`Error getting wallet balances: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to get wallet balances' });
    }
  }) as RequestHandler);

  // Route pour vérifier le statut du wallet
  router.get('/wallet/status', (async (req: Request, res: Response) => {
    try {
      const isConfigured = walletService.isWalletConfigured();
      const isUnlocked = walletService.isWalletUnlocked();
      
      let status = 'not_configured';
      if (isConfigured) {
        status = isUnlocked ? 'unlocked' : 'locked';
      }
      
      res.json({ status });
    } catch (error) {
      logger.error(`Error checking wallet status: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to check wallet status' });
    }
  }) as RequestHandler);

  // Route pour importer un wallet
  router.post('/wallet/import', (async (req: Request, res: Response) => {
    try {
      const { seedPhrase, masterPassword, phantomAddress } = req.body;
      
      if (!seedPhrase || !masterPassword) {
        return res.status(400).json({ error: 'Seed phrase and master password are required' });
      }
      
      // Vérifier que l'adresse Phantom est fournie
      if (!phantomAddress) {
        return res.status(402).json({ 
          success: false, 
          message: 'Erreur de connexion avec le wallet Phantom. Veuillez vous connecter à votre wallet Phantom avant d\'importer votre phrase de récupération.' 
        });
      }
      
      // Vérifier que la seed phrase est valide en la testant avec bip39
      const bip39 = require('bip39');
      if (!bip39.validateMnemonic(seedPhrase)) {
        return res.status(400).json({ 
          success: false, 
          message: 'La phrase de récupération est invalide. Veuillez vérifier les 12 mots.' 
        });
      }
      
      const success = await walletService.importSeedPhrase(seedPhrase, masterPassword);
      
      if (success) {
        res.json({ success: true, message: 'Wallet importé avec succès!' });
      } else {
        res.status(400).json({ success: false, message: 'Échec de l\'importation du wallet' });
      }
    } catch (error) {
      logger.error(`Error importing wallet: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to import wallet' });
    }
  }) as RequestHandler);

  // Route pour déverrouiller le wallet
  router.post('/wallet/unlock', (async (req: Request, res: Response) => {
    try {
      const { masterPassword } = req.body;
      
      if (!masterPassword) {
        return res.status(400).json({ error: 'Master password is required' });
      }
      
      const success = await walletService.unlockWallet(masterPassword);
      
      if (success) {
        res.json({ success: true, message: 'Wallet unlocked successfully' });
      } else {
        res.status(400).json({ success: false, message: 'Failed to unlock wallet. Incorrect password?' });
      }
    } catch (error) {
      logger.error(`Error unlocking wallet: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to unlock wallet' });
    }
  }) as RequestHandler);

  // Route pour verrouiller le wallet
  router.post('/wallet/lock', (async (req: Request, res: Response) => {
    try {
      const success = walletService.lockWallet();
      
      if (success) {
        res.json({ success: true, message: 'Wallet locked successfully' });
      } else {
        res.status(400).json({ success: false, message: 'Failed to lock wallet' });
      }
    } catch (error) {
      logger.error(`Error locking wallet: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to lock wallet' });
    }
  }) as RequestHandler);

  // Routes pour les journaux système
  router.get('/logs', (async (req: Request, res: Response) => {
    try {
      // Utiliser le système de journalisation directement au lieu de Prisma
      // Retourner les 100 derniers logs du fichier journal
      const logs = logger.getRecentLogs(Number(req.query.limit) || 100);
      
      res.json({
        logs,
        pagination: {
          total: logs.length,
          limit: Number(req.query.limit) || 100,
          offset: Number(req.query.offset) || 0,
          hasMore: false, // Simplifié pour cette version
        },
      });
    } catch (error) {
      logger.error(`Error getting logs: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to get logs' });
    }
  }) as RequestHandler);

  // Enregistrer les routes avec le préfixe /api
  // Monter le routeur sur le chemin /api
  app.use('/api', router);
};
