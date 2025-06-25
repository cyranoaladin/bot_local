# Guide Technique du Bot de Trading $COLLAT - Partie 4 : Base de Données et Frontend

## 1. Structure de la Base de Données (schema.prisma)

Le schéma Prisma définit la structure de la base de données utilisée par le bot de trading. Il inclut les modèles pour les transactions, les snapshots du portefeuille, les notifications, les journaux et la configuration.

### Implémentation

```prisma
// Extrait simplifié de schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Configuration du bot
model Config {
  id                      Int      @id @default(1)
  sellThreshold           Float    @default(10)
  buyThreshold            Float    @default(5)
  slippageTolerance       Float    @default(1.5)
  maxTransactionPercentage Float    @default(50)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}

// Token API pour l'authentification
model ApiToken {
  id        Int      @id @default(1)
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Transactions de trading
model Trade {
  id        String   @id @default(uuid())
  type      String   // BUY ou SELL
  amount    Float
  price     Float
  txHash    String?
  status    String   @default("PENDING") // PENDING, CONFIRMED, FAILED
  timestamp DateTime @default(now())
}

// Snapshots du portefeuille
model PortfolioSnapshot {
  id              String   @id @default(uuid())
  collatBalance   Float
  usdcBalance     Float
  collatPrice     Float
  totalValueUsdc  Float
  timestamp       DateTime @default(now())
}

// Notifications
model Notification {
  id        String   @id @default(uuid())
  title     String
  message   String
  level     String   @default("info") // info, warning, error
  read      Boolean  @default(false)
  timestamp DateTime @default(now())
}

// Journaux système
model Log {
  id        String   @id @default(uuid())
  level     String   // debug, info, warn, error
  message   String
  timestamp DateTime @default(now())
}

// État du bot
model BotState {
  id          Int      @id @default(1)
  isActive    Boolean  @default(false)
  entryPrice  Float?
  lastTradeId String?
  updatedAt   DateTime @updatedAt
}
```

## 2. Frontend - Client API (apiClient.ts)

Le client API est utilisé par le frontend pour communiquer avec le backend. Il encapsule toutes les requêtes HTTP vers l'API REST.

### Implémentation

```typescript
// Extrait simplifié de apiClient.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// Configuration par défaut
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Client API pour communiquer avec le backend
 */
class ApiClient {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    // Créer l'instance axios avec la configuration de base
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // 30 secondes
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Intercepteur pour ajouter le token d'authentification
    this.api.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Récupérer le token depuis le localStorage s'il existe
    this.token = localStorage.getItem('auth_token');
  }

  /**
   * Définir le token d'authentification
   */
  public setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  /**
   * Supprimer le token d'authentification
   */
  public clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  /**
   * Vérifier si l'utilisateur est authentifié
   */
  public isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Méthode GET générique
   */
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.get<T>(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Méthode POST générique
   */
  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Méthode PUT générique
   */
  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.put<T>(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Méthode DELETE générique
   */
  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.api.delete<T>(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Gestion centralisée des erreurs
   */
  private handleError(error: any): void {
    if (axios.isAxiosError(error)) {
      // Erreur 401 : Non authentifié
      if (error.response?.status === 401) {
        this.clearToken();
        window.location.href = '/login';
      }
      
      // Erreur 403 : Non autorisé
      if (error.response?.status === 403) {
        console.error('Accès non autorisé');
      }
      
      // Journaliser l'erreur
      console.error('API Error:', error.response?.data || error.message);
    } else {
      console.error('Unexpected error:', error);
    }
  }

  // API spécifiques au bot de trading

  /**
   * Obtenir l'état actuel du bot
   */
  public async getBotStatus() {
    return this.get<any>('/bot/status');
  }

  /**
   * Démarrer le bot
   */
  public async startBot() {
    return this.post<any>('/bot/start');
  }

  /**
   * Arrêter le bot
   */
  public async stopBot() {
    return this.post<any>('/bot/stop');
  }

  /**
   * Obtenir la configuration du bot
   */
  public async getConfig() {
    return this.get<any>('/config');
  }

  /**
   * Mettre à jour la configuration du bot
   */
  public async updateConfig(config: any) {
    return this.put<any>('/config', config);
  }

  /**
   * Obtenir l'historique des transactions
   */
  public async getTransactions(limit = 50, offset = 0) {
    return this.get<any>(`/transactions?limit=${limit}&offset=${offset}`);
  }

  /**
   * Obtenir les snapshots du portefeuille
   */
  public async getPortfolioSnapshots(limit = 30, offset = 0) {
    return this.get<any>(`/portfolio/snapshots?limit=${limit}&offset=${offset}`);
  }

  /**
   * Obtenir les soldes du portefeuille
   */
  public async getWalletBalances() {
    return this.get<any>('/wallet/balances');
  }

  /**
   * Obtenir les journaux système
   */
  public async getLogs(limit = 100, offset = 0, level?: string) {
    let url = `/logs?limit=${limit}&offset=${offset}`;
    if (level) {
      url += `&level=${level}`;
    }
    return this.get<any>(url);
  }
}

// Exporter une instance singleton
const apiClient = new ApiClient();
export default apiClient;
```

## 3. Frontend - Hook useTradingBot

Le hook `useTradingBot` est utilisé par les composants React pour interagir avec le bot de trading. Il encapsule la logique de démarrage, d'arrêt et de surveillance du bot.

### Implémentation

```typescript
// Extrait simplifié de useTradingBot.ts
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
```

## 4. Frontend - Store Global (useTradeStore.ts)

Le store global `useTradeStore` utilise Zustand pour gérer l'état global de l'application, y compris la configuration du bot, les prix, les transactions et les valeurs du portefeuille.

### Implémentation

```typescript
// Extrait simplifié de useTradeStore.ts
import { create } from 'zustand';
import { DEFAULT_CONFIG } from '../config/constants';

interface TradeConfig {
  tokenAddress: string;
  stablecoin: string;
  sellThreshold: number;
  buyThreshold: number;
  targetGain: number;
  slippage: number;
}

interface TradeState {
  isActive: boolean;
  config: TradeConfig;
  entryPrice: number | null;
  currentPrice: number | null;
  portfolioValue: number;
  dailyProfit: number;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setActive: (active: boolean) => void;
  updateConfig: (config: Partial<TradeConfig>) => void;
  setEntryPrice: (price: number) => void;
  setCurrentPrice: (price: number) => void;
  updatePortfolioValue: (value: number) => void;
  updateDailyProfit: (profit: number) => void;
  addTransaction: (transaction: Transaction) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetBot: () => void;
}

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  timestamp: number;
  txHash: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
}

const useTradeStore = create<TradeState>((set) => ({
  isActive: false,
  config: DEFAULT_CONFIG,
  entryPrice: null,
  currentPrice: null,
  portfolioValue: 0,
  dailyProfit: 0,
  transactions: [],
  isLoading: false,
  error: null,
  
  // Actions
  setActive: (active) => set({ isActive: active }),
  updateConfig: (config) => set((state) => ({ 
    config: { ...state.config, ...config } 
  })),
  setEntryPrice: (price) => set({ entryPrice: price }),
  setCurrentPrice: (price) => set({ currentPrice: price }),
  updatePortfolioValue: (value) => set({ portfolioValue: value }),
  updateDailyProfit: (profit) => set({ dailyProfit: profit }),
  addTransaction: (transaction) => set((state) => ({ 
    transactions: [transaction, ...state.transactions] 
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  resetBot: () => set({
    isActive: false,
    entryPrice: null,
    currentPrice: null,
    dailyProfit: 0,
    error: null
  })
}));

export default useTradeStore;
```

## 5. Frontend - Composant BotControl

Le composant `BotControl` permet à l'utilisateur de démarrer et arrêter le bot de trading.

### Implémentation

```tsx
// Extrait simplifié de BotControl.tsx
import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import useTradingBot from '../../hooks/useTradingBot';
import useTradeStore from '../../store/useTradeStore';

const BotControl: React.FC = () => {
  const wallet = useWallet();
  const { isRunning, startBot, stopBot } = useTradingBot();
  const { isLoading, error } = useTradeStore();

  const handleStartBot = async () => {
    await startBot();
  };

  const handleStopBot = async () => {
    await stopBot();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-xl font-semibold mb-4">Contrôle du Bot</h2>
      
      {!wallet.connected ? (
        <div className="mb-4">
          <p className="text-gray-600 mb-2">Connectez votre portefeuille pour contrôler le bot</p>
          <WalletMultiButton className="w-full" />
        </div>
      ) : (
        <div>
          <div className="flex items-center mb-4">
            <div className={`w-3 h-3 rounded-full mr-2 ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isRunning ? 'Bot actif' : 'Bot inactif'}</span>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleStartBot}
              disabled={isLoading || isRunning}
              className={`px-4 py-2 rounded-md w-1/2 ${
                isRunning
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isLoading ? 'Chargement...' : 'Démarrer'}
            </button>
            
            <button
              onClick={handleStopBot}
              disabled={isLoading || !isRunning}
              className={`px-4 py-2 rounded-md w-1/2 ${
                !isRunning
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {isLoading ? 'Chargement...' : 'Arrêter'}
            </button>
          </div>
          
          {error && (
            <div className="mt-2 text-red-500 text-sm">{error}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default BotControl;
```

## 6. Frontend - Composant Dashboard

Le composant `Dashboard` est le composant principal qui organise l'interface utilisateur du bot de trading.

### Implémentation

```tsx
// Extrait simplifié de Dashboard.tsx
import React, { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import BotControl from './BotControl';
import BotConfig from './BotConfig';
import PerformanceStats from './PerformanceStats';
import TransactionHistory from './TransactionHistory';
import WalletBalance from '../wallet/WalletBalance';
import useTradeStore from '../../store/useTradeStore';
import useApi from '../../hooks/useApi';

const Dashboard: React.FC = () => {
  const wallet = useWallet();
  const { error, setError } = useTradeStore();
  const api = useApi();

  // Charger les données initiales
  useEffect(() => {
    const loadInitialData = async () => {
      if (wallet.connected) {
        try {
          // Charger la configuration
          await api.getConfig();
          
          // Charger les transactions
          await api.getTransactions();
          
          // Charger les snapshots du portefeuille
          await api.getPortfolioSnapshots();
        } catch (err) {
          setError('Erreur lors du chargement des données');
          console.error('Erreur lors du chargement des données:', err);
        }
      }
    };

    loadInitialData();
  }, [wallet.connected]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">$COLLAT Trading Bot</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Erreur:</strong>
          <span className="block sm:inline"> {error}</span>
          <button
            className="float-right"
            onClick={() => setError(null)}
          >
            &times;
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Colonne gauche */}
        <div className="space-y-6">
          <WalletBalance />
          <BotConfig />
        </div>
        
        {/* Colonne centrale */}
        <div className="space-y-6">
          <PerformanceStats />
          <BotControl />
        </div>
        
        {/* Colonne droite */}
        <div>
          <TransactionHistory />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
```

## Conclusion

Ce guide technique a présenté en détail l'architecture et l'implémentation du bot de trading $COLLAT. Les principales composantes du système sont :

1. **Backend** : Un service Node.js autonome qui gère la logique de trading, les interactions avec la blockchain et la persistance des données
   - Services métier (trading, prix, portefeuille, notification)
   - API REST pour l'interaction avec le frontend
   - Base de données PostgreSQL pour le stockage persistant

2. **Frontend** : Une interface utilisateur React pour l'administration et la surveillance du bot
   - Client API pour communiquer avec le backend
   - Hooks personnalisés pour encapsuler la logique métier
   - Store global pour gérer l'état de l'application
   - Composants UI pour l'interaction utilisateur

Le système est conçu pour être robuste, extensible et facile à maintenir. La séparation claire des responsabilités entre les différentes couches permet de modifier ou d'étendre une partie du système sans affecter les autres.

Pour contribuer au développement du bot ou l'adapter à vos besoins spécifiques, vous pouvez vous concentrer sur les parties pertinentes du code en suivant l'architecture décrite dans ce guide.
