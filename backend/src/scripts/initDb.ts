import { PrismaClient } from '@prisma/client';
import { generateToken } from '../utils/auth';
import logger from '../utils/logger';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Initialise la base de données avec les valeurs par défaut
 */
async function initializeDatabase() {
  try {
    logger.info('Initializing database...');

    // Créer une configuration par défaut si elle n'existe pas
    const existingConfig = await prisma.configuration.findFirst();
    if (!existingConfig) {
      await prisma.configuration.create({
        data: {
          sellThreshold: 10.0,
          buyThreshold: 5.0,
          slippageTolerance: 1.5,
          maxTransactionPercentage: 50.0,
          rpcEndpoints: JSON.stringify([
            "https://mainnet.helius-rpc.com/?api-key=your_api_key_here",
            "https://rpc.triton.one"
          ])
        }
      });
      logger.info('Default configuration created');
    }

    // Créer un état initial du bot s'il n'existe pas
    const existingBotState = await prisma.botState.findFirst();
    if (!existingBotState) {
      await prisma.botState.create({
        data: {
          isActive: false
        }
      });
      logger.info('Initial bot state created');
    }

    // Générer un token d'API pour l'authentification
    const userId = crypto.randomUUID();
    const token = generateToken(userId);
    
    logger.info('Database initialization completed');
    logger.info('--------------------------------------');
    logger.info('API Authentication Token (valid for 24h):');
    logger.info(token);
    logger.info('--------------------------------------');
    logger.info('Use this token in the Authorization header:');
    logger.info('Authorization: Bearer <token>');
    logger.info('--------------------------------------');

    return { success: true };
  } catch (error) {
    logger.error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error };
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter l'initialisation si ce script est appelé directement
if (require.main === module) {
  initializeDatabase()
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}

export default initializeDatabase;
