import { useState, useEffect } from 'react';
import { websocketService } from '../services/websocket';
import type { 
  PriceUpdate, 
  BotState, 
  Transaction, 
  PortfolioSnapshot, 
  Notification 
} from '../services/websocket';

interface WebSocketState {
  connected: boolean;
  priceUpdate: PriceUpdate | null;
  botState: BotState | null;
  latestTransaction: Transaction | null;
  portfolioSnapshot: PortfolioSnapshot | null;
  notifications: Notification[];
}

export const useWebSocket = () => {
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    priceUpdate: null,
    botState: null,
    latestTransaction: null,
    portfolioSnapshot: null,
    notifications: []
  });

  useEffect(() => {
    // Initialiser la connexion WebSocket
    websocketService.connect();

    // Gérer les événements de connexion
    const handleConnection = (data: { connected: boolean; reason?: string }) => {
      setState(prevState => ({
        ...prevState,
        connected: data.connected
      }));
      
      // Si la connexion est établie, ajouter une notification
      if (data.connected) {
        setState(prevState => ({
          ...prevState,
          notifications: [
            {
              type: 'success',
              title: 'Connexion établie',
              message: 'Connexion au serveur WebSocket établie avec succès.',
              timestamp: new Date().toISOString()
            },
            ...prevState.notifications.slice(0, 9) // Garder les 10 dernières notifications
          ]
        }));
      } else if (data.reason) {
        // Si la connexion est perdue, ajouter une notification
        setState(prevState => ({
          ...prevState,
          notifications: [
            {
              type: 'warning',
              title: 'Connexion perdue',
              message: `Connexion au serveur WebSocket perdue: ${data.reason}`,
              timestamp: new Date().toISOString()
            },
            ...prevState.notifications.slice(0, 9)
          ]
        }));
      }
    };

    // Gérer les mises à jour de prix
    const handlePriceUpdate = (data: PriceUpdate) => {
      setState(prevState => ({
        ...prevState,
        priceUpdate: data
      }));
    };

    // Gérer les mises à jour de l'état du bot
    const handleBotState = (data: BotState) => {
      setState(prevState => ({
        ...prevState,
        botState: data
      }));
    };

    // Gérer les nouvelles transactions
    const handleTransaction = (data: Transaction) => {
      setState(prevState => ({
        ...prevState,
        latestTransaction: data
      }));
    };

    // Gérer les snapshots de portefeuille
    const handlePortfolioSnapshot = (data: PortfolioSnapshot) => {
      setState(prevState => ({
        ...prevState,
        portfolioSnapshot: data
      }));
    };

    // Gérer les notifications
    const handleNotification = (data: Notification) => {
      setState(prevState => ({
        ...prevState,
        notifications: [
          {
            ...data,
            timestamp: data.timestamp || new Date().toISOString()
          },
          ...prevState.notifications.slice(0, 9) // Garder les 10 dernières notifications
        ]
      }));
    };

    // S'abonner aux événements
    websocketService.on('connection', handleConnection);
    websocketService.on('price_update', handlePriceUpdate);
    websocketService.on('bot_state', handleBotState);
    websocketService.on('transaction', handleTransaction);
    websocketService.on('portfolio_snapshot', handlePortfolioSnapshot);
    websocketService.on('notification', handleNotification);

    // Nettoyage lors du démontage du composant
    return () => {
      websocketService.off('connection', handleConnection);
      websocketService.off('price_update', handlePriceUpdate);
      websocketService.off('bot_state', handleBotState);
      websocketService.off('transaction', handleTransaction);
      websocketService.off('portfolio_snapshot', handlePortfolioSnapshot);
      websocketService.off('notification', handleNotification);
    };
  }, []);

  // Fonction pour effacer une notification
  const clearNotification = (index: number) => {
    setState(prevState => ({
      ...prevState,
      notifications: [
        ...prevState.notifications.slice(0, index),
        ...prevState.notifications.slice(index + 1)
      ]
    }));
  };

  // Fonction pour effacer toutes les notifications
  const clearAllNotifications = () => {
    setState(prevState => ({
      ...prevState,
      notifications: []
    }));
  };

  return {
    ...state,
    clearNotification,
    clearAllNotifications
  };
};
