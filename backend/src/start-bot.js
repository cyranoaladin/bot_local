/**
 * Script de démarrage autonome du bot de trading
 * Ce script démarre uniquement le service de trading sans l'API REST
 */

const { tradingService } = require('./services/trading/tradingService');
const { walletService } = require('./services/wallet/walletService');
const logger = require('./utils/logger');

// Configuration du mot de passe maître (à remplacer par votre mot de passe)
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'votre_mot_de_passe_ici';

// Fonction principale
async function startBot() {
  try {
    logger.info('Démarrage du bot de trading en mode autonome');
    
    // Définir le mot de passe maître
    tradingService.setMasterPassword(MASTER_PASSWORD);
    walletService.setMasterPassword(MASTER_PASSWORD);
    
    // Déverrouiller le portefeuille
    const unlocked = await walletService.unlockWallet(MASTER_PASSWORD);
    if (!unlocked) {
      logger.error('Échec du déverrouillage du portefeuille. Vérifiez votre mot de passe maître.');
      process.exit(1);
    }
    
    logger.info('Portefeuille déverrouillé avec succès');
    
    // Démarrer le bot de trading
    const started = await tradingService.start();
    if (!started) {
      logger.error('Échec du démarrage du bot de trading');
      process.exit(1);
    }
    
    logger.info('Bot de trading démarré avec succès');
    
    // Gérer l'arrêt propre
    process.on('SIGINT', async () => {
      logger.info('Arrêt du bot de trading...');
      await tradingService.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Arrêt du bot de trading...');
      await tradingService.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(`Erreur lors du démarrage du bot: ${error.message}`);
    process.exit(1);
  }
}

// Démarrer le bot
startBot();
