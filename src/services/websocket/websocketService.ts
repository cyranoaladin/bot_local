import { io, Socket } from 'socket.io-client';
import config from '../../config/config';

// Types pour les événements WebSocket
export interface PriceUpdate {
  collatPrice: number;
  priceChangePercent: number;
}

export interface BotState {
  isRunning: boolean;
  lastEntryPrice: number;
  currentPrice: number;
  priceChange: number;
  balances: {
    collat: number;
    usdc: number;
    sol: number;
    totalValueUsdc: number;
  };
}

export interface Transaction {
  id: number;
  type: 'BUY' | 'SELL';
  tokenAmount: number;
  usdcAmount: number;
  price: number;
  timestamp: string;
  txHash: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
}

export interface PortfolioSnapshot {
  id: number;
  timestamp: string;
  collatBalance: number;
  usdcBalance: number;
  solBalance: number;
  collatPrice: number;
  totalValueUsdc: number;
}

export interface Notification {
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp?: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 secondes

  // Initialiser la connexion WebSocket
  public connect(): void {
    if (this.socket) {
      return;
    }

    const socketUrl = `http://${config.apiHost}:${config.apiPort}`;
    this.socket = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      transports: ['websocket']
    });

    this.setupEventListeners();
  }

  // Configurer les écouteurs d'événements de base
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.notifyListeners('connection', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`WebSocket disconnected: ${reason}`);
      this.connected = false;
      this.notifyListeners('connection', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Maximum reconnection attempts reached');
        this.notifyListeners('connection', { 
          connected: false, 
          error: 'Maximum reconnection attempts reached' 
        });
      }
    });

    // Événements spécifiques à l'application
    this.socket.on('price_update', (data: PriceUpdate) => {
      this.notifyListeners('price_update', data);
    });

    this.socket.on('bot_state', (data: BotState) => {
      this.notifyListeners('bot_state', data);
    });

    this.socket.on('transaction', (data: Transaction) => {
      this.notifyListeners('transaction', data);
    });

    this.socket.on('portfolio_snapshot', (data: PortfolioSnapshot) => {
      this.notifyListeners('portfolio_snapshot', data);
    });

    this.socket.on('notification', (data: Notification) => {
      this.notifyListeners('notification', data);
    });
  }

  // S'abonner à un événement
  public on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  // Se désabonner d'un événement
  public off(event: string, callback: Function): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.delete(callback);
    }
  }

  // Notifier tous les abonnés d'un événement
  private notifyListeners(event: string, data: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket listener for event ${event}:`, error);
        }
      });
    }
  }

  // Vérifier si le WebSocket est connecté
  public isConnected(): boolean {
    return this.connected;
  }

  // Déconnecter le WebSocket
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
}

// Exporter une instance singleton du service
export const websocketService = new WebSocketService();
