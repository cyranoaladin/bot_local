import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

// Configuration par défaut
// Utiliser l'adresse IP du serveur au lieu de localhost pour permettre l'accès depuis le réseau local
const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.hostname === 'localhost' 
  ? 'http://localhost:3001/api'
  : `http://${window.location.hostname}:3001/api`;

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

// Exporter une instance singleton du client API
export const apiClient = new ApiClient();

export default apiClient;
