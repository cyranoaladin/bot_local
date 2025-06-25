import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import logger from '../../utils/logger';
import { PrismaClient, Transaction, PortfolioSnapshot, BotState } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Service de communication en temps réel via WebSocket
 * Permet d'envoyer des mises à jour en direct au frontend
 */
class WebSocketService {
  private io: Server | null = null;
  private connectedClients: number = 0;

  /**
   * Initialise le service WebSocket avec le serveur HTTP
   */
  initialize(httpServer: HttpServer): void {
    try {
      this.io = new Server(httpServer, {
        cors: {
          origin: '*', // En production, limitez ceci à l'origine de votre frontend
          methods: ['GET', 'POST']
        }
      });

      this.setupEventHandlers();
      logger.info('Service WebSocket initialisé avec succès');
    } catch (error) {
      logger.error(`Erreur lors de l'initialisation du service WebSocket: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Configure les gestionnaires d'événements pour les connexions client
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      this.connectedClients++;
      logger.info(`Nouveau client WebSocket connecté. Total: ${this.connectedClients}`);

      // Envoyer l'état actuel du bot au client qui vient de se connecter
      this.sendCurrentStateToClient(socket);

      // Configurer les événements de déconnexion
      socket.on('disconnect', () => {
        this.connectedClients--;
        logger.info(`Client WebSocket déconnecté. Total restant: ${this.connectedClients}`);
      });
    });
  }

  /**
   * Envoie l'état actuel du bot à un client spécifique
   */
  private async sendCurrentStateToClient(socket: Socket): Promise<void> {
    try {
      // Récupérer l'état actuel du bot
      const botState = await prisma.botState.findFirst();
      
      if (botState) {
        socket.emit('botState', botState);
      }

      // Récupérer les dernières transactions
      const transactions = await prisma.transaction.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      if (transactions.length > 0) {
        socket.emit('recentTransactions', transactions);
      }

      // Récupérer les derniers snapshots du portefeuille
      const snapshots = await prisma.portfolioSnapshot.findMany({
        orderBy: { timestamp: 'desc' },
        take: 24 // Dernières 24 heures si snapshots horaires
      });

      if (snapshots.length > 0) {
        socket.emit('portfolioSnapshots', snapshots);
      }
    } catch (error) {
      logger.error(`Erreur lors de l'envoi de l'état actuel au client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Diffuse une mise à jour de l'état du bot à tous les clients
   */
  broadcastBotState(botState: BotState): void {
    if (!this.io || this.connectedClients === 0) return;
    
    this.io.emit('botState', botState);
    logger.info(`État du bot diffusé à ${this.connectedClients} clients`);
  }

  /**
   * Diffuse une nouvelle transaction à tous les clients
   */
  broadcastTransaction(transaction: Transaction): void {
    if (!this.io || this.connectedClients === 0) return;
    
    this.io.emit('newTransaction', transaction);
    logger.info(`Nouvelle transaction diffusée à ${this.connectedClients} clients`);
  }

  /**
   * Diffuse un nouveau snapshot du portefeuille à tous les clients
   */
  broadcastPortfolioSnapshot(snapshot: PortfolioSnapshot): void {
    if (!this.io || this.connectedClients === 0) return;
    
    this.io.emit('newPortfolioSnapshot', snapshot);
    logger.info(`Nouveau snapshot du portefeuille diffusé à ${this.connectedClients} clients`);
  }

  /**
   * Diffuse une mise à jour de prix à tous les clients
   */
  broadcastPriceUpdate(priceData: { collatPrice: number, priceChangePercent: number }): void {
    if (!this.io || this.connectedClients === 0) return;
    
    this.io.emit('priceUpdate', priceData);
    logger.debug(`Mise à jour de prix diffusée à ${this.connectedClients} clients`);
  }

  /**
   * Diffuse une notification à tous les clients
   */
  broadcastNotification(notification: { type: string, title: string, message: string }): void {
    if (!this.io || this.connectedClients === 0) return;
    
    this.io.emit('notification', notification);
    logger.info(`Notification diffusée à ${this.connectedClients} clients`);
  }

  /**
   * Vérifie si le service est initialisé
   */
  isInitialized(): boolean {
    return this.io !== null;
  }

  /**
   * Retourne le nombre de clients connectés
   */
  getConnectedClientsCount(): number {
    return this.connectedClients;
  }
}

// Exporter une instance singleton du service
export const websocketService = new WebSocketService();
