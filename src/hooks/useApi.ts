import { useState, useCallback } from 'react';
import apiClient from '../api/apiClient';

/**
 * Hook personnalisé pour gérer les appels API avec gestion d'état
 */
export function useApi<T>(initialData?: T) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fonction générique pour effectuer un appel API
   */
  const execute = useCallback(async <R>(
    apiCall: () => Promise<R>,
    onSuccess?: (data: R) => void
  ): Promise<R | undefined> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiCall();
      setData(result as unknown as T);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Une erreur inconnue est survenue');
      setError(error);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fonctions spécifiques pour les différentes API du bot
   */
  
  // Obtenir l'état du bot
  const getBotStatus = useCallback(async (onSuccess?: (data: any) => void) => {
    return execute(() => apiClient.getBotStatus(), onSuccess);
  }, [execute]);

  // Démarrer le bot
  const startBot = useCallback(async (onSuccess?: (data: any) => void) => {
    return execute(() => apiClient.startBot(), onSuccess);
  }, [execute]);

  // Arrêter le bot
  const stopBot = useCallback(async (onSuccess?: (data: any) => void) => {
    return execute(() => apiClient.stopBot(), onSuccess);
  }, [execute]);

  // Obtenir la configuration
  const getConfig = useCallback(async (onSuccess?: (data: any) => void) => {
    return execute(() => apiClient.getConfig(), onSuccess);
  }, [execute]);

  // Mettre à jour la configuration
  const updateConfig = useCallback(async (config: any, onSuccess?: (data: any) => void) => {
    return execute(() => apiClient.updateConfig(config), onSuccess);
  }, [execute]);

  // Obtenir les transactions
  const getTransactions = useCallback(async (limit = 50, offset = 0, onSuccess?: (data: any) => void) => {
    return execute(() => apiClient.getTransactions(limit, offset), onSuccess);
  }, [execute]);

  // Obtenir les snapshots du portefeuille
  const getPortfolioSnapshots = useCallback(async (limit = 30, offset = 0, onSuccess?: (data: any) => void) => {
    return execute(() => apiClient.getPortfolioSnapshots(limit, offset), onSuccess);
  }, [execute]);

  // Obtenir les soldes du portefeuille
  const getWalletBalances = useCallback(async (onSuccess?: (data: any) => void) => {
    return execute(() => apiClient.getWalletBalances(), onSuccess);
  }, [execute]);

  // Obtenir les journaux système
  const getLogs = useCallback(async (limit = 100, offset = 0, level?: string, onSuccess?: (data: any) => void) => {
    return execute(() => apiClient.getLogs(limit, offset, level), onSuccess);
  }, [execute]);

  return {
    data,
    loading,
    error,
    execute,
    getBotStatus,
    startBot,
    stopBot,
    getConfig,
    updateConfig,
    getTransactions,
    getPortfolioSnapshots,
    getWalletBalances,
    getLogs
  };
}

export default useApi;
