import { useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import useTradeStore from '../store/useTradeStore';
import useApi from './useApi';

// Hook pour gérer les opérations du bot de trading
const useTradingBot = () => {
  const wallet = useWallet();
  const { setActive, setLoading, setError, setCurrentPrice, setEntryPrice, updatePortfolioValue, updateDailyProfit } = useTradeStore();
  const [isRunning, setIsRunning] = useState<boolean>(false);
  
  // Utiliser notre hook API personnalisé
  const api = useApi();
  
  // Référence pour stocker l'ID de l'intervalle de polling
  const statusPollingRef = useRef<number | null>(null);

  // Fonction pour démarrer le bot via l'API
  const startBot = async () => {
    if (!wallet.connected) {
      setError('Connectez votre portefeuille pour démarrer le bot');
      return false;
    }
    
    try {
      setLoading(true);
      const response = await api.startBot();
      
      if (response?.success) {
        setActive(true);
        setIsRunning(true);
        console.log('Bot démarré avec succès');
        return true;
      } else {
        setError('Erreur lors du démarrage du bot');
        return false;
      }
    } catch (error) {
      console.error('Erreur lors du démarrage du bot:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors du démarrage du bot');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour arrêter le bot via l'API
  const stopBot = async () => {
    try {
      setLoading(true);
      const response = await api.stopBot();
      
      if (response?.success) {
        setActive(false);
        setIsRunning(false);
        console.log('Bot arrêté avec succès');
        return true;
      } else {
        setError("Erreur lors de l'arrêt du bot");
        return false;
      }
    } catch (error) {
      console.error("Erreur lors de l'arrêt du bot:", error);
      setError(error instanceof Error ? error.message : "Erreur lors de l'arrêt du bot");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour récupérer l'état du bot
  const fetchBotStatus = async () => {
    try {
      const status = await api.getBotStatus();
      
      if (status) {
        // Mettre à jour l'état local
        setIsRunning(status.isActive);
        setActive(status.isActive);
        
        // Mettre à jour les prix
        if (status.currentPrice) {
          setCurrentPrice(parseFloat(status.currentPrice));
        }
        
        if (status.entryPrice) {
          setEntryPrice(parseFloat(status.entryPrice));
        }
        
        // Mettre à jour les valeurs du portefeuille
        if (status.balances?.totalValueUsdc) {
          updatePortfolioValue(parseFloat(status.balances.totalValueUsdc));
        }
        
        // Calculer le profit quotidien (dans un système réel, cette valeur viendrait du backend)
        if (status.entryPrice && status.currentPrice) {
          const dailyProfit = ((parseFloat(status.currentPrice) - parseFloat(status.entryPrice)) / parseFloat(status.entryPrice)) * 100;
          updateDailyProfit(dailyProfit);
        }
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de l'état du bot:", error);
      // Ne pas afficher d'erreur à l'utilisateur pour les erreurs de polling
    }
  };

  // Démarrer ou arrêter le polling en fonction de l'état de connexion
  useEffect(() => {
    // Nettoyer tout intervalle existant
    if (statusPollingRef.current !== null) {
      clearInterval(statusPollingRef.current);
      statusPollingRef.current = null;
    }

    if (wallet.connected) {
      // Récupérer l'état initial du bot
      fetchBotStatus();
      
      // Configurer le polling pour récupérer régulièrement l'état du bot
      statusPollingRef.current = window.setInterval(() => {
        fetchBotStatus();
      }, 10000); // Récupérer l'état toutes les 10 secondes
    } else {
      // Réinitialiser l'état si le portefeuille est déconnecté
      setIsRunning(false);
    }

    // Nettoyer lors du démontage
    return () => {
      if (statusPollingRef.current !== null) {
        clearInterval(statusPollingRef.current);
        statusPollingRef.current = null;
      }
    };
  }, [wallet.connected, fetchBotStatus]);

  return {
    isRunning,
    startBot,
    stopBot,
    fetchBotStatus
  };
};

export default useTradingBot;
