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
  updatePrice: (currentPrice: number, entryPrice?: number) => void;
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
  }),
  // Mise à jour des prix en temps réel
  updatePrice: (currentPrice, entryPrice) => set((state) => ({
    currentPrice,
    entryPrice: entryPrice !== undefined ? entryPrice : state.entryPrice
  }))
}));

export default useTradeStore;
