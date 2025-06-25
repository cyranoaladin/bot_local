import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import config from './config/config';
import logger from './utils/logger';
import { setupRoutes } from './api';
import { tradingService } from './services/trading/tradingService';
import { websocketService } from './services/websocket';

// Initialiser Prisma
const prisma = new PrismaClient();

// Créer l'application Express
const app = express();

// Créer un serveur HTTP à partir de l'application Express
const httpServer = createServer(app);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
})); // Sécurité avec configuration adaptée pour le développement

// Configuration CORS détaillée
app.use(cors({
  origin: ["http://localhost:3002", "http://192.168.1.16:3002", "http://0.0.0.0:3002"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
})); // CORS pour les requêtes cross-origin

app.use(express.json()); // Parser JSON

// Logger middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Configurer les routes API
setupRoutes(app);

// Route de santé
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware de gestion des erreurs
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Démarrer le serveur
const PORT = config.app.port;
const server = httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
  
  // Initialiser le service WebSocket avec le serveur HTTP
  websocketService.initialize(httpServer);
  logger.info('WebSocket service initialized');
});

// Planifier l'exécution périodique de l'algorithme de trading
const TRADING_INTERVAL = 30000; // 30 secondes
setInterval(async () => {
  try {
    const result = await tradingService.runTradingAlgorithm();
    
    // Si l'algorithme a produit des résultats, les diffuser via WebSocket
    if (result && result.priceUpdated) {
      websocketService.broadcastPriceUpdate({
        collatPrice: result.currentPrice || 0,
        priceChangePercent: result.priceChangePercent || 0
      });
    }
    
    // Si l'état du bot a changé, le diffuser
    if (result && result.stateChanged) {
      const botState = await prisma.botState.findFirst();
      if (botState) {
        websocketService.broadcastBotState(botState);
      }
    }
    
    // Si une transaction a été effectuée, la diffuser
    if (result && result.transactionExecuted) {
      const latestTransaction = await prisma.transaction.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      if (latestTransaction) {
        websocketService.broadcastTransaction(latestTransaction);
        
        // Envoyer également une notification
        websocketService.broadcastNotification({
          type: latestTransaction.type === 'BUY' ? 'success' : 'info',
          title: `${latestTransaction.type === 'BUY' ? 'Achat' : 'Vente'} de COLLAT`,
          message: `${latestTransaction.type === 'BUY' ? 'Achat' : 'Vente'} de ${latestTransaction.tokenAmount} COLLAT pour ${latestTransaction.usdcAmount} USDC`
        });
      }
    }
  } catch (error) {
    logger.error(`Error running trading algorithm: ${error instanceof Error ? error.message : String(error)}`);
    
    // Diffuser l'erreur aux clients connectés
    websocketService.broadcastNotification({
      type: 'error',
      title: 'Erreur d\'algorithme',
      message: `Une erreur s'est produite lors de l'exécution de l'algorithme de trading: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}, TRADING_INTERVAL);

// Gestion de l'arrêt gracieux
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Notifier les clients connectés
  if (websocketService.isInitialized()) {
    websocketService.broadcastNotification({
      type: 'warning',
      title: 'Arrêt du serveur',
      message: 'Le serveur est en cours d\'arrêt. Veuillez patienter...'
    });
  }
  
  // Arrêter le bot de trading
  await tradingService.stop();
  
  // Fermer le serveur HTTP
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Fermer la connexion à la base de données
    prisma.$disconnect()
      .then(() => {
        logger.info('Database connection closed');
        process.exit(0);
      })
      .catch((err: Error) => {
        logger.error(`Error closing database connection: ${err.message}`);
        process.exit(1);
      });
  });
  
  // Si le serveur ne se ferme pas dans les 10 secondes, forcer la fermeture
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});

export default app;
