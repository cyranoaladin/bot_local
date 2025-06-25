#!/usr/bin/env node

/**
 * Bot de trading $COLLAT
 * 
 * Ce script implémente un bot de trading autonome pour le token $COLLAT sur Solana/Raydium
 * conformément aux spécifications du projet :
 * - Fonctionne localement sur Linux Mint sans VPS
 * - Stocke la phrase de récupération du wallet avec chiffrement AES-256-GCM
 * - Fonctionne en arrière-plan indépendamment du GUI
 * - Utilise l'API Triton avec un intervalle réduit (1 seconde par défaut)
 * - Implémente la stratégie de trading spécifiée
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// ES Module fix pour __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Initialiser Prisma
const prisma = new PrismaClient();

// Importer les services depuis le backend
import { walletService } from './backend/src/services/wallet/walletService.js';
import { tradingService } from './backend/src/services/trading/tradingService.js';
import { notificationService } from './backend/src/services/notification/index.js';
import { websocketService } from './backend/src/services/websocket/index.js';
import { encryptionService } from './backend/src/utils/encryption.js';
import logger from './backend/src/utils/logger.js';

// Configuration du bot
const CONFIG = {
  // Répertoire de stockage sécurisé
  STORAGE_DIR: path.join(os.homedir(), '.collat-bot'),
  
  // Intervalle de polling configurable (ms)
  POLLING_INTERVAL: parseInt(process.env.API_CALL_INTERVAL_MS || '1000', 10)
};

// Vérifier que le répertoire de stockage existe
if (!fs.existsSync(CONFIG.STORAGE_DIR)) {
  fs.mkdirSync(CONFIG.STORAGE_DIR, { recursive: true, mode: 0o700 });
  logger.info(`Répertoire de stockage créé : ${CONFIG.STORAGE_DIR}`);
}

/**
 * Fonction principale qui initialise et démarre le bot de trading
 */
async function main() {
  logger.info('Démarrage du bot de trading $COLLAT');
  
  try {
    // Vérifier si le backend est accessible (pour le WebSocket)
    try {
      const response = await fetch('http://localhost:3001/api/health');
      if (response.ok) {
        logger.info('Backend détecté et fonctionnel. WebSocket disponible.');
      } else {
        logger.warning('Backend détecté mais ne répond pas correctement. Vérifiez le service backend.');
      }
    } catch (error) {
      logger.warning('Backend non accessible. Les notifications WebSocket ne seront pas disponibles.');
    }
    
    // Vérifier si le wallet est configuré
    if (!walletService.isWalletInitialized()) {
      logger.warning('Aucun wallet configuré. Veuillez configurer le wallet via le dashboard avant de démarrer le bot.');
    } else {
      logger.info('Wallet configuré. Pour démarrer le trading, déverrouillez le wallet via le dashboard.');
    }
    
    // Gérer les signaux pour un arrêt gracieux
    process.on('SIGINT', async () => {
      logger.info('Signal d\'interruption reçu, arrêt du bot...');
      // Envoyer une notification via WebSocket avant l'arrêt
      try {
        const notification = {
          type: 'warning',
          title: 'Arrêt du bot',
          message: 'Le bot de trading est en cours d\'arrêt suite à un signal d\'interruption.',
          timestamp: new Date().toISOString()
        };
        // Utiliser le backend pour diffuser la notification
        await fetch('http://localhost:3001/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification)
        });
      } catch (error) {
        logger.error('Erreur lors de l\'envoi de la notification WebSocket:', error);
      }
      
      await tradingService.stop();
      await prisma.$disconnect();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Signal de terminaison reçu, arrêt du bot...');
      // Envoyer une notification via WebSocket avant l'arrêt
      try {
        const notification = {
          type: 'warning',
          title: 'Arrêt du bot',
          message: 'Le bot de trading est en cours d\'arrêt suite à un signal de terminaison.',
          timestamp: new Date().toISOString()
        };
        // Utiliser le backend pour diffuser la notification
        await fetch('http://localhost:3001/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification)
        });
      } catch (error) {
        logger.error('Erreur lors de l\'envoi de la notification WebSocket:', error);
      }
      
      await tradingService.stop();
      await prisma.$disconnect();
      process.exit(0);
    });
    
    // Vérifier l'état du bot dans la base de données
    const botState = await prisma.botState.findFirst();
    
    // Si le bot était en cours d'exécution lors de la dernière exécution, essayer de le redémarrer
    if (botState && botState.state === 'RUNNING') {
      logger.info('Le bot était en cours d\'exécution lors de la dernière exécution. Tentative de redémarrage...');
      
      // Essayer de démarrer le bot si le wallet est déverrouillé
      if (walletService.isUnlocked()) {
        const started = await tradingService.start();
        if (started) {
          await notificationService.sendInfoAlert(
            'Bot Restarted', 
            'Trading bot was successfully restarted after system restart.'
          );
        } else {
          logger.error('Échec du redémarrage automatique du bot. Déverrouillez le wallet via le dashboard.');
        }
      } else {
        logger.info('Le wallet est verrouillé. Déverrouillez-le via le dashboard pour démarrer le bot.');
      }
    }
    
    // Configurer l'intervalle de polling
    const config = await prisma.configuration.findFirst();
    if (config && config.pollingInterval) {
      const intervalMinutes = config.pollingInterval;
      logger.info(`Intervalle de polling configuré: ${intervalMinutes} minutes`);
      tradingService.setApiParameters(intervalMinutes * 60 * 1000, Number.MAX_SAFE_INTEGER);
    } else {
      logger.info(`Intervalle de polling par défaut: ${CONFIG.POLLING_INTERVAL} ms`);
      tradingService.setApiParameters(CONFIG.POLLING_INTERVAL, Number.MAX_SAFE_INTEGER);
    }
    
    logger.info('Bot de trading $COLLAT initialisé avec succès');
    logger.info('Utilisez le dashboard pour configurer et contrôler le bot');
    
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation du bot: ${error instanceof Error ? error.message : String(error)}`);
    await notificationService.sendErrorAlert(
      'Bot Initialization Error',
      `An error occurred during bot initialization: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Exécuter la fonction principale
main().catch(async (error) => {
  console.error('Erreur fatale:', error);
  try {
    await notificationService.sendCriticalAlert(
      'Fatal Error',
      `A fatal error occurred in the trading bot: ${error instanceof Error ? error.message : String(error)}`
    );
    await prisma.$disconnect();
  } catch (e) {
    console.error('Failed to send error notification:', e);
  }
  process.exit(1);
});
