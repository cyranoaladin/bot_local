import { Connection, Keypair, PublicKey, Transaction as SolanaTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import config from '../../config/config';
import logger from '../../utils/logger';
import { PrismaClient } from '@prisma/client';
import { encryptionService } from '../../utils/encryption';
import { notificationService } from '../notification';

const prisma = new PrismaClient();

// Constantes pour le stockage sécurisé
const WALLET_SEED_FILENAME = 'wallet_seed.enc';
const WALLET_DATA_FILENAME = 'wallet_data.enc';

class WalletService {
  private connection: Connection;
  private keypair: Keypair | null = null;
  private primaryEndpoint: string;
  private secondaryEndpoint: string;
  private seedPhrase: string | null = null;
  private isInitialized: boolean = false;
  private lastApiCallTime: number = 0;
  private apiCallInterval: number = 10 * 60 * 1000; // 10 minutes en millisecondes
  private masterPassword: string | null = null;

  constructor() {
    this.primaryEndpoint = config.solana.rpcEndpoints[0];
    this.secondaryEndpoint = config.solana.rpcEndpoints[1];
    this.connection = new Connection(this.primaryEndpoint, 'confirmed');
  }

  /**
   * Vérifie si le portefeuille est déjà configuré
   */
  public isWalletConfigured(): boolean {
    return encryptionService.encryptedFileExists(WALLET_SEED_FILENAME);
  }
  
  /**
   * Vérifie si le portefeuille est déverrouillé
   */
  public isWalletUnlocked(): boolean {
    return this.isInitialized && this.keypair !== null;
  }

  /**
   * Importe une seed phrase et la stocke de manière sécurisée
   */
  public async importSeedPhrase(seedPhrase: string, masterPassword: string): Promise<boolean> {
    try {
      // Valider la seed phrase
      if (!bip39.validateMnemonic(seedPhrase)) {
        throw new Error('Invalid seed phrase');
      }
      
      // Chiffrer et stocker la seed phrase
      encryptionService.saveEncryptedData(WALLET_SEED_FILENAME, seedPhrase, masterPassword);
      
      // Initialiser le portefeuille avec la nouvelle seed phrase
      this.seedPhrase = seedPhrase;
      await this.initializeFromSeed();
      
      // Stocker les informations publiques du portefeuille
      const walletInfo = {
        publicKey: this.keypair?.publicKey.toString(),
        lastUpdated: new Date().toISOString()
      };
      
      encryptionService.saveEncryptedData(WALLET_DATA_FILENAME, JSON.stringify(walletInfo), masterPassword);
      
      logger.info('Seed phrase imported and wallet initialized successfully');
      notificationService.sendInfoAlert('Wallet Setup', 'Wallet has been configured successfully');
      
      return true;
    } catch (error) {
      logger.error(`Failed to import seed phrase: ${error instanceof Error ? error.message : String(error)}`);
      notificationService.sendErrorAlert('Wallet Setup Failed', `Failed to import seed phrase: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Déverrouille le portefeuille avec le mot de passe maître
   */
  public async unlockWallet(masterPassword: string): Promise<boolean> {
    try {
      if (!this.isWalletConfigured()) {
        throw new Error('Wallet not configured');
      }
      
      // Charger et déchiffrer la seed phrase
      this.seedPhrase = encryptionService.loadEncryptedData(WALLET_SEED_FILENAME, masterPassword);
      
      // Initialiser le portefeuille à partir de la seed phrase
      await this.initializeFromSeed();
      
      logger.info('Wallet unlocked successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to unlock wallet: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Verrouille le portefeuille en effaçant les données sensibles de la mémoire
   */
  public lockWallet(): boolean {
    try {
      if (!this.isWalletUnlocked()) {
        logger.warn('Wallet is not unlocked, nothing to lock');
        return false;
      }
      
      // Effacer les données sensibles
      this.keypair = null;
      this.seedPhrase = null;
      this.isInitialized = false;
      
      logger.info('Wallet locked successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to lock wallet: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Initialise le portefeuille à partir de la seed phrase
   */
  private async initializeFromSeed(): Promise<void> {
    try {
      if (!this.seedPhrase) {
        throw new Error('Seed phrase not available');
      }
      
      // Dériver la clé privée à partir de la seed phrase (chemin de dérivation standard pour Solana)
      const seed = await bip39.mnemonicToSeed(this.seedPhrase);
      const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
      
      // Créer le keypair
      this.keypair = Keypair.fromSeed(derivedSeed.slice(0, 32));
      
      logger.info(`Wallet initialized with public key: ${this.keypair.publicKey.toString()}`);
      this.isInitialized = true;
      
      // Enregistrer un snapshot initial des soldes
      await this.recordBalanceSnapshot();
    } catch (error) {
      logger.error(`Failed to initialize wallet from seed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to initialize wallet');
    }
  }

  /**
   * Obtient l'adresse publique du portefeuille
   */
  public getPublicKey(): string {
    if (!this.keypair) {
      throw new Error('Wallet not initialized');
    }
    return this.keypair.publicKey.toString();
  }

  /**
   * Bascule vers l'endpoint RPC secondaire en cas d'échec du primaire
   */
  public switchToSecondaryEndpoint(): void {
    logger.warn(`Switching to secondary RPC endpoint: ${this.secondaryEndpoint}`);
    this.connection = new Connection(this.secondaryEndpoint, 'confirmed');
  }

  /**
   * Vérifie la connexion RPC et bascule si nécessaire
   */
  private async ensureValidConnection(): Promise<void> {
    try {
      // Test simple pour vérifier si la connexion est valide
      await this.connection.getVersion();
    } catch (error) {
      logger.error(`RPC connection error: ${error instanceof Error ? error.message : String(error)}`);
      this.switchToSecondaryEndpoint();
    }
  }

  /**
   * Vérifie si l'intervalle d'appel API est respecté
   */
  private canMakeApiCall(): boolean {
    const now = Date.now();
    if (now - this.lastApiCallTime >= this.apiCallInterval) {
      this.lastApiCallTime = now;
      return true;
    }
    return false;
  }

  /**
   * Obtient le solde SOL du portefeuille
   */
  public async getSolBalance(): Promise<number> {
    try {
      if (!this.canMakeApiCall()) {
        logger.warn('API call rate limit reached, using cached balance');
        // Récupérer le dernier solde connu depuis la base de données
        const lastSnapshot = await prisma.portfolioSnapshot.findFirst({
          orderBy: { timestamp: 'desc' }
        });
        return lastSnapshot ? parseFloat(lastSnapshot.solBalance.toString()) : 0;
      }
      
      await this.ensureValidConnection();
      
      if (!this.keypair) {
        throw new Error('Wallet not initialized');
      }
      
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      return balance / 1e9; // Convertir en SOL (1 SOL = 10^9 lamports)
    } catch (error) {
      logger.error(`Failed to get SOL balance: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to get SOL balance');
    }
  }

  /**
   * Obtient le solde d'un token SPL
   */
  public async getTokenBalance(tokenAddress: string): Promise<number> {
    try {
      if (!this.canMakeApiCall()) {
        logger.warn('API call rate limit reached, using cached balance');
        // Récupérer le dernier solde connu depuis la base de données
        const lastSnapshot = await prisma.portfolioSnapshot.findFirst({
          orderBy: { timestamp: 'desc' }
        });
        
        if (lastSnapshot) {
          if (tokenAddress === config.solana.tokenInfo.COLLAT.address) {
            return parseFloat(lastSnapshot.collatBalance.toString());
          } else if (tokenAddress === config.solana.tokenInfo.USDC.address) {
            return parseFloat(lastSnapshot.usdcBalance.toString());
          }
        }
        return 0;
      }
      
      await this.ensureValidConnection();
      
      if (!this.keypair) {
        throw new Error('Wallet not initialized');
      }
      
      const tokenPublicKey = new PublicKey(tokenAddress);
      const walletPublicKey = this.keypair.publicKey;
      
      // Trouver l'adresse du compte de token pour ce portefeuille
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      // Chercher le compte correspondant au token demandé
      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed.info;
        const mintAddress = parsedInfo.mint;
        
        if (mintAddress === tokenAddress) {
          const balance = parsedInfo.tokenAmount.uiAmount;
          return balance;
        }
      }
      
      // Si aucun compte n'est trouvé, le solde est 0
      return 0;
    } catch (error) {
      logger.error(`Failed to get token balance: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to get balance for token ${tokenAddress}`);
    }
  }

  /**
   * Signe une transaction
   */
  public signTransaction(transaction: SolanaTransaction): SolanaTransaction {
    if (!this.keypair) {
      throw new Error('Wallet not initialized');
    }
    
    transaction.sign(this.keypair);
    return transaction;
  }

  /**
   * Récupère tous les soldes pertinents et les enregistre
   */
  public async recordBalanceSnapshot(): Promise<void> {
    try {
      if (!this.isInitialized) {
        logger.warn('Cannot record balance snapshot: wallet not initialized');
        return;
      }
      
      const solBalance = await this.getSolBalance();
      const collatBalance = await this.getTokenBalance(config.solana.tokenInfo.COLLAT.address);
      const usdcBalance = await this.getTokenBalance(config.solana.tokenInfo.USDC.address);
      
      // Obtenir le prix actuel du COLLAT depuis le service de prix
      const priceService = (await import('../price/priceService')).priceService;
      const collatPrice = await priceService.getCollatPrice();
      
      const totalValueUsdc = usdcBalance + (collatBalance * collatPrice);
      
      // Calculer le profit/perte par rapport au snapshot précédent
      const previousSnapshot = await prisma.portfolioSnapshot.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      
      let profitLoss = null;
      if (previousSnapshot) {
        const previousTotalValue = parseFloat(previousSnapshot.totalValueUsdc.toString());
        profitLoss = totalValueUsdc - previousTotalValue;
      }
      
      // Enregistrer le snapshot dans la base de données
      await prisma.portfolioSnapshot.create({
        data: {
          collatBalance: collatBalance.toString(),
          usdcBalance: usdcBalance.toString(),
          solBalance: solBalance.toString(),
          totalValueUsdc: totalValueUsdc.toString(),
          profitLoss: profitLoss ? profitLoss.toString() : null
        }
      });
      
      logger.info(`Recorded balance snapshot: SOL=${solBalance}, COLLAT=${collatBalance}, USDC=${usdcBalance}, Total=${totalValueUsdc} USDC`);
    } catch (error) {
      logger.error(`Failed to record balance snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Vérifie si le portefeuille est initialisé
   */
  public isWalletInitialized(): boolean {
    return this.isInitialized;
  }
  
  /**
   * Vérifie si le portefeuille est déverrouillé
   */
  public isUnlocked(): boolean {
    return this.isInitialized && this.keypair !== null;
  }
  
  /**
   * Obtient la keypair du portefeuille
   */
  public async getKeypair(): Promise<Keypair | null> {
    if (!this.isUnlocked()) {
      logger.error('Cannot get keypair: wallet is locked');
      return null;
    }
    return this.keypair;
  }
  
  /**
   * Récupère les comptes de tokens du portefeuille
   */
  public async getTokenAccounts(): Promise<any[]> {
    try {
      if (!this.keypair) {
        throw new Error('Wallet not initialized');
      }
      
      await this.ensureValidConnection();
      
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.keypair.publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      return tokenAccounts.value.map(item => ({
        pubkey: item.pubkey,
        mint: item.account.data.parsed.info.mint,
        owner: item.account.data.parsed.info.owner,
        amount: item.account.data.parsed.info.tokenAmount.amount
      }));
    } catch (error) {
      logger.error(`Failed to get token accounts: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to get token accounts');
    }
  }
  
  /**
   * Définit l'intervalle d'appel API
   */
  public setApiCallInterval(intervalMinutes: number): void {
    this.apiCallInterval = intervalMinutes * 60 * 1000;
    logger.info(`API call interval set to ${intervalMinutes} minutes`);
  }

  /**
   * Définit le mot de passe maître pour le service
   */
  public setMasterPassword(password: string): void {
    this.masterPassword = password;
    logger.info('Master password set for wallet service');
  }
}

// Exporter une instance singleton du service
export const walletService = new WalletService();
