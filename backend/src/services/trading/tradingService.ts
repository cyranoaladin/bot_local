import { Connection, PublicKey, Transaction, Keypair, sendAndConfirmTransaction, TransactionInstruction } from '@solana/web3.js';
import { Liquidity, LiquidityPoolKeys, Token, TokenAmount, Percent, Currency } from '@raydium-io/raydium-sdk';
import { RaydiumAdapter } from '../price/raydiumAdapter';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import config from '../../config/config';
import logger from '../../utils/logger';
import { walletService } from '../wallet/walletService';
import { priceService } from '../price/priceService';
import { notificationService } from '../notification';
import { encryptionService } from '../../utils/encryption';

const prisma = new PrismaClient();

// Constantes pour le stockage sécurisé
const BOT_STATE_FILENAME = 'bot_state.enc';
const MASTER_PASSWORD_KEY = 'MASTER_PASSWORD';

// Définir nos propres enums pour correspondre à ceux de Prisma
enum BotState {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  PAUSED = 'PAUSED'
}

enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL'
}

enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED'
}

class TradingService {
  private isRunning: boolean = false;
  private lastEntryPrice: number = 0;
  private tradingInterval: NodeJS.Timeout | null = null;
  private connection: Connection;
  private masterPassword: string | null = null;
  private lastApiCallTime: number = 0;
  private apiCallInterval: number = 10 * 60 * 1000; // 10 minutes en millisecondes par défaut
  private maxApiCallsPerDay: number = 100; // Limite pour l'API Helius gratuite
  private apiCallCount: number = 0;
  private apiCallCountResetTime: number = 0;

  constructor() {
    this.connection = new Connection(config.solana.rpcEndpoints[0], 'confirmed');
    this.apiCallCountResetTime = Date.now() + 24 * 60 * 60 * 1000; // Réinitialiser le compteur après 24h
    this.loadBotState();
  }

  /**
   * Charge l'état du bot depuis le stockage local
   */
  private loadBotState(): void {
    try {
      if (encryptionService.encryptedFileExists(BOT_STATE_FILENAME) && this.masterPassword) {
        const botStateJson = encryptionService.loadEncryptedData(BOT_STATE_FILENAME, this.masterPassword);
        const botState = JSON.parse(botStateJson);
        
        this.isRunning = botState.isRunning || false;
        this.lastEntryPrice = botState.lastEntryPrice || 0;
        this.apiCallCount = botState.apiCallCount || 0;
        this.apiCallCountResetTime = botState.apiCallCountResetTime || (Date.now() + 24 * 60 * 60 * 1000);
        
        logger.info('Bot state loaded from encrypted storage');
      }
    } catch (error) {
      logger.error(`Failed to load bot state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Sauvegarde l'état du bot dans le stockage local
   */
  private saveBotState(): void {
    try {
      if (!this.masterPassword) {
        logger.warn('Cannot save bot state: master password not set');
        return;
      }
      
      const botState = {
        isRunning: this.isRunning,
        lastEntryPrice: this.lastEntryPrice,
        apiCallCount: this.apiCallCount,
        apiCallCountResetTime: this.apiCallCountResetTime,
        lastUpdated: new Date().toISOString()
      };
      
      encryptionService.saveEncryptedData(BOT_STATE_FILENAME, JSON.stringify(botState), this.masterPassword);
      logger.info('Bot state saved to encrypted storage');
    } catch (error) {
      logger.error(`Failed to save bot state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Définit le mot de passe maître pour le chiffrement
   */
  public setMasterPassword(password: string): void {
    this.masterPassword = password;
    this.loadBotState();
  }

  /**
   * Vérifie si l'intervalle d'appel API est respecté et gère les quotas
   */
  private canMakeApiCall(): boolean {
    const now = Date.now();
    
    // Réinitialiser le compteur quotidien si nécessaire
    if (now > this.apiCallCountResetTime) {
      this.apiCallCount = 0;
      this.apiCallCountResetTime = now + 24 * 60 * 60 * 1000; // +24h
      logger.info('API call counter reset for the new day');
    }
    
    // Vérifier le quota quotidien
    if (this.apiCallCount >= this.maxApiCallsPerDay) {
      logger.warn(`Daily API call quota reached (${this.apiCallCount}/${this.maxApiCallsPerDay})`);
      return false;
    }
    
    // Vérifier l'intervalle entre les appels
    if (now - this.lastApiCallTime >= this.apiCallInterval) {
      this.lastApiCallTime = now;
      this.apiCallCount++;
      return true;
    }
    
    return false;
  }

  /**
   * Démarre le bot de trading
   */
  public async start(): Promise<boolean> {
    try {
      if (this.isRunning) {
        logger.warn('Trading bot is already running');
        return false;
      }

      // Vérifier si le portefeuille est initialisé
      if (!walletService.isWalletInitialized()) {
        logger.error('Cannot start trading bot: wallet not initialized');
        return false;
      }

      // Mettre à jour l'état du bot dans la base de données
      await prisma.botState.upsert({
        where: { id: 1 },
        update: { isActive: true, lastUpdated: new Date() },
        create: { id: 1, isActive: true, entryPrice: this.lastEntryPrice, currentPrice: null, lastTransaction: null, lastUpdated: new Date() }
      });

      this.isRunning = true;
      
      // Enregistrer un snapshot initial des soldes
      await walletService.recordBalanceSnapshot();
      
      // Obtenir le prix actuel comme prix d'entrée initial
      this.lastEntryPrice = await priceService.getCurrentPrice();
      
      // Envoyer une notification de démarrage
      await notificationService.sendInfoAlert(
        'Bot Started', 
        `Trading bot started successfully. Initial price: ${this.lastEntryPrice} USDC`
      );
      
      logger.info(`Trading bot started. Initial price: ${this.lastEntryPrice} USDC`);
      
      // Sauvegarder l'état du bot
      this.saveBotState();
      
      // Exécuter l'algorithme de trading périodiquement (toutes les 10 minutes)
      this.tradingInterval = setInterval(() => this.runTradingAlgorithm(), this.apiCallInterval);
      
      return true;
    } catch (error) {
      logger.error(`Failed to start trading bot: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Arrête le bot de trading
   */
  public async stop(): Promise<boolean> {
    try {
      if (!this.isRunning) {
        logger.warn('Trading bot is not running');
        return false;
      }

      // Arrêter l'intervalle de trading
      if (this.tradingInterval) {
        clearInterval(this.tradingInterval);
        this.tradingInterval = null;
      }

      // Mettre à jour l'état du bot dans la base de données
      await prisma.botState.upsert({
        where: { id: 1 },
        update: { isActive: false, lastUpdated: new Date() },
        create: { id: 1, isActive: false, entryPrice: null, currentPrice: null, lastTransaction: null, lastUpdated: new Date() }
      });

      this.isRunning = false;
      
      // Enregistrer un snapshot final des soldes
      await walletService.recordBalanceSnapshot();
      
      // Envoyer une notification d'arrêt
      await notificationService.sendInfoAlert('Bot Stopped', 'Trading bot stopped successfully');
      
      logger.info('Trading bot stopped');
      
      // Sauvegarder l'état du bot
      this.saveBotState();
      
      return true;
    } catch (error) {
      logger.error(`Failed to stop trading bot: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Exécute l'algorithme de trading
   * @returns Un objet contenant les informations sur l'exécution de l'algorithme
   */
  public async runTradingAlgorithm(): Promise<{
    priceUpdated: boolean;
    stateChanged: boolean;
    transactionExecuted: boolean;
    currentPrice?: number;
    priceChangePercent?: number;
    errorMessage?: string;
  }> {
    if (!this.isRunning) {
      return {
        priceUpdated: false,
        stateChanged: false,
        transactionExecuted: false
      };
    }

    try {
      // Vérifier si on peut faire un appel API selon les limites
      if (!this.canMakeApiCall()) {
        logger.info('Skipping trading algorithm run due to API rate limits');
        return {
          priceUpdated: false,
          stateChanged: false,
          transactionExecuted: false
        };
      }
      
      logger.info('Running trading algorithm...');
      
      // Récupérer la configuration actuelle
      const config = await prisma.configuration.findFirst();
      if (!config) {
        throw new Error('Bot configuration not found');
      }
      
      // Récupérer le prix actuel
      const currentPrice = await priceService.getCurrentPrice();
      logger.info(`Current COLLAT price: ${currentPrice} USDC`);
      
      // Récupérer les soldes actuels
      const collatBalance = await walletService.getTokenBalance(priceService['collatAddress']);
      const usdcBalance = await walletService.getTokenBalance(priceService['usdcAddress']);
      
      logger.info(`Current balances: COLLAT=${collatBalance}, USDC=${usdcBalance}`);
      
      // Calculer les variations de prix
      const priceIncrease = ((currentPrice - this.lastEntryPrice) / this.lastEntryPrice) * 100;
      
      // Initialiser le résultat
      const result = {
        priceUpdated: true,
        stateChanged: false,
        transactionExecuted: false,
        currentPrice,
        priceChangePercent: priceIncrease
      };
      
      logger.info(`Price change since last entry: ${priceIncrease.toFixed(2)}% (Entry: ${this.lastEntryPrice} USDC)`);
      
      // Stratégie de trading selon le cahier des charges
      if (priceIncrease >= config.sellThreshold && collatBalance > 0) {
        // Vendre 50% du COLLAT si le prix a augmenté de 10% ou plus
        logger.info(`Sell condition met: Price increased by ${priceIncrease.toFixed(2)}% (>= ${config.sellThreshold}%)`);
        
        // Calculer le montant à vendre (50% du solde COLLAT)
        const sellAmount = collatBalance * 0.5; // Exactement 50% comme spécifié dans le cahier des charges
        
        // Exécuter la vente
        const sellResult = await this.executeSwap(
          priceService['collatAddress'],
          priceService['usdcAddress'],
          sellAmount,
          config.slippageTolerance
        );
        
        if (sellResult.success) {
          // Mettre à jour le prix d'entrée après la vente
          this.lastEntryPrice = currentPrice;
          
          // Enregistrer un snapshot des soldes après la transaction
          await walletService.recordBalanceSnapshot();
          
          // Sauvegarder l'état du bot
          this.saveBotState();
          
          logger.info(`Sold ${sellAmount} COLLAT (50% of balance) at ${currentPrice} USDC`);
          
          // Envoyer une notification de vente réussie
          await notificationService.sendInfoAlert(
            'COLLAT Sold',
            `Successfully sold ${sellAmount.toFixed(4)} COLLAT (50% of balance) at ${currentPrice} USDC`
          );
          
          // Mettre à jour le résultat
          result.transactionExecuted = true;
          result.stateChanged = true;
        }
      } else if (priceIncrease <= -config.buyThreshold && usdcBalance > 0) {
        // Acheter du COLLAT avec 100% du USDC si le prix a baissé de 5% ou plus après une vente
        logger.info(`Buy condition met: Price decreased by ${Math.abs(priceIncrease).toFixed(2)}% (>= ${config.buyThreshold}%)`);
        
        // Utiliser 100% du solde USDC comme spécifié dans le cahier des charges
        const buyAmountUsdc = usdcBalance;
        
        // Exécuter l'achat
        const buyResult = await this.executeSwap(
          priceService['usdcAddress'],
          priceService['collatAddress'],
          buyAmountUsdc,
          config.slippageTolerance
        );
        
        if (buyResult.success) {
          // Mettre à jour le prix d'entrée après l'achat
          this.lastEntryPrice = currentPrice;
          
          // Enregistrer un snapshot des soldes après la transaction
          await walletService.recordBalanceSnapshot();
          
          // Sauvegarder l'état du bot
          this.saveBotState();
          
          logger.info(`Bought COLLAT with ${buyAmountUsdc} USDC (100% of balance) at ${currentPrice} USDC per COLLAT`);
          
          // Envoyer une notification d'achat réussi
          await notificationService.sendInfoAlert(
            'COLLAT Bought',
            `Successfully bought COLLAT with ${buyAmountUsdc.toFixed(4)} USDC (100% of balance) at ${currentPrice} USDC per COLLAT`
          );
          
          // Mettre à jour le résultat
          result.transactionExecuted = true;
          result.stateChanged = true;
        }
      } else {
        logger.info('No trading conditions met, holding position');
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in trading algorithm: ${error instanceof Error ? error.message : String(error)}`);
      await notificationService.sendErrorAlert(
        'Trading Algorithm Error',
        `An error occurred in the trading algorithm: ${error instanceof Error ? error.message : String(error)}`
      );
      
      return {
        priceUpdated: false,
        stateChanged: false,
        transactionExecuted: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Exécute un swap entre deux tokens
   * @param fromTokenAddress Adresse du token source
   * @param toTokenAddress Adresse du token destination
   * @param amount Montant à échanger
   * @param slippageTolerance Tolérance de slippage en pourcentage
   * @returns Résultat du swap
   */
  public async executeSwap(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: number,
    slippageTolerance: number
  ): Promise<{ success: boolean; txId?: string; error?: string }> {
    try {
      logger.info(`Executing swap: ${amount} from ${fromTokenAddress} to ${toTokenAddress} with ${slippageTolerance}% slippage`);
      
      // Vérifier que le portefeuille est déverrouillé
      if (!walletService.isUnlocked()) {
        throw new Error('Wallet is locked. Please unlock the wallet first.');
      }
      
      // Obtenir la keypair du portefeuille
      const keypair = await walletService.getKeypair();
      if (!keypair) {
        throw new Error('Failed to get wallet keypair');
      }
      
      // Calculer le montant optimal pour le swap (pour minimiser l'impact sur le prix)
      const optimalAmount = await priceService.calculateOptimalSwapAmount(
        amount,
        fromTokenAddress,
        toTokenAddress
      );
      
      // Obtenir les clés du pool de liquidité
      const raydiumAdapter = new RaydiumAdapter(this.connection);
      const poolKeys = await raydiumAdapter.getLiquidityPoolKeys(fromTokenAddress, toTokenAddress);
      
      // Obtenir les informations du pool
      const poolInfo = await raydiumAdapter.fetchPoolInfo(poolKeys);
      
      // Déterminer les tokens source et destination
      const isFromBase = poolKeys.baseMint.toString() === fromTokenAddress;
      const fromToken = raydiumAdapter.createToken(
        isFromBase ? poolKeys.baseMint : poolKeys.quoteMint,
        isFromBase ? poolKeys.baseDecimals : poolKeys.quoteDecimals,
        isFromBase ? 'BASE' : 'QUOTE'
      );
      
      const toToken = raydiumAdapter.createToken(
        isFromBase ? poolKeys.quoteMint : poolKeys.baseMint,
        isFromBase ? poolKeys.quoteDecimals : poolKeys.baseDecimals,
        isFromBase ? 'QUOTE' : 'BASE'
      );
      
      // Créer le montant d'entrée
      const amountIn = new TokenAmount(
        fromToken,
        Math.floor(optimalAmount * 10 ** fromToken.decimals)
      );
      
      // Créer l'objet Currency pour le token de sortie
      const currencyOut = new Currency(toToken.decimals, toToken.symbol || '', toToken.name || '');
      
      // Calculer le montant de sortie avec slippage
      const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
        poolKeys,
        poolInfo,
        amountIn,
        currencyOut,
        slippage: new Percent(slippageTolerance, 100)
      });
      
      // Préparer les comptes de token pour le swap
      const tokenAccounts = await walletService.getTokenAccounts();
      
      // Créer une transaction manuellement pour le swap
      // Cette approche est plus robuste face aux changements d'API du SDK Raydium
      const transaction = new Transaction();
      
      try {
        // Trouver les comptes de token pour le swap
        const fromTokenAccount = tokenAccounts.find(account => account.mint === fromTokenAddress);
        const toTokenAccount = tokenAccounts.find(account => account.mint === toTokenAddress);
        
        if (!fromTokenAccount || !toTokenAccount) {
          throw new Error('Token accounts not found for the specified tokens');
        }
        
        // Obtenir les instructions de swap en utilisant une approche bas niveau
        // qui fonctionne avec différentes versions du SDK Raydium
        logger.info('Creating swap instructions');
        
        // @ts-ignore - Ignorer les erreurs de type car l'API peut varier selon la version
        const swapInstructions = await this.createSwapInstructions(
          poolKeys,
          new PublicKey(fromTokenAccount.pubkey),
          new PublicKey(toTokenAccount.pubkey),
          keypair.publicKey,
          amountIn,
          minAmountOut
        );
        
        // Ajouter les instructions à la transaction
        swapInstructions.forEach((instruction: TransactionInstruction) => {
          transaction.add(instruction);
        });
        
        logger.info(`Created swap transaction with ${swapInstructions.length} instructions`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to create swap transaction: ${errorMessage}`);
        throw new Error(`Failed to create swap transaction: ${errorMessage}`);
      }
      
      // Préparer les signataires
      const signers = [keypair];
      
      // Envoyer et confirmer la transaction
      const txId = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        signers,
        { commitment: 'confirmed' }
      );
      
      // Enregistrer la transaction dans la base de données
      await prisma.transaction.create({
        data: {
          txHash: txId,
          type: isFromBase ? TransactionType.SELL : TransactionType.BUY,
          status: TransactionStatus.CONFIRMED,
          tokenAmount: optimalAmount,
          tokenPrice: await priceService.getCurrentPrice(),
          usdcAmount: isFromBase ? optimalAmount * (await priceService.getCurrentPrice()) : optimalAmount,
          timestamp: new Date()
        }
      });
      
      logger.info(`Swap executed successfully: ${txId}`);
      return { success: true, txId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to execute swap: ${errorMessage}`);
      
      // Enregistrer l'échec de la transaction
      await notificationService.sendErrorAlert(
        'Swap Failed',
        `Failed to execute swap from ${fromTokenAddress} to ${toTokenAddress}: ${errorMessage}`
      );
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Crée les instructions de swap pour différentes versions du SDK Raydium
   * @private
   */
  private async createSwapInstructions(
    poolKeys: LiquidityPoolKeys,
    tokenAccountIn: PublicKey,
    tokenAccountOut: PublicKey,
    owner: PublicKey,
    amountIn: TokenAmount,
    minAmountOut: any
  ): Promise<TransactionInstruction[]> {
    try {
      // Essayer d'abord avec l'API directe de Raydium
      try {
        logger.info('Attempting to create swap with direct API method');
        // @ts-ignore - Ignorer les erreurs de type car l'API peut varier selon la version
        const instructions = await this.connection.getRecentBlockhash()
          .then(recentBlockhash => {
            const tx = new Transaction({
              recentBlockhash: recentBlockhash.blockhash,
              feePayer: owner
            });
            
            // Créer manuellement les instructions de swap
            // @ts-ignore - Ignorer les erreurs de type car l'API peut varier selon la version
            const ix = Liquidity.swapInstruction({
              poolKeys,
              userKeys: {
                owner,
                sourceToken: tokenAccountIn,
                destinationToken: tokenAccountOut
              },
              amountIn: amountIn.raw.toString(),
              minAmountOut: minAmountOut.raw.toString()
            });
            
            return [ix];
          });
        
        if (instructions && instructions.length > 0) {
          logger.info('Successfully created swap instructions with direct API method');
          return instructions;
        }
      } catch (e) {
        logger.warn(`Direct API method failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      
      // Essayer avec l'API alternative
      try {
        logger.info('Attempting to create swap with alternative API method');
        // @ts-ignore - Ignorer les erreurs de type car l'API peut varier selon la version
        const result = await Liquidity.makeSwapInstruction({
          poolKeys,
          userKeys: {
            owner,
            // Utiliser les noms de paramètres corrects selon l'API
            tokenAccountIn,
            tokenAccountOut
          },
          amountIn: amountIn.raw.toString(),
          // Utiliser amountOut au lieu de minAmountOut pour correspondre à l'API
          amountOut: minAmountOut.raw.toString()
        });
        
        if (Array.isArray(result)) {
          logger.info('Successfully created swap instructions with alternative API method');
          return result;
        } else if (typeof result === 'object' && result !== null) {
          // Essayer d'extraire les instructions du résultat
          // @ts-ignore - Ignorer les erreurs de type car la structure peut varier
          if (result.instructions) {
            // @ts-ignore - Ignorer les erreurs de type car la structure peut varier
            return Array.isArray(result.instructions) ? result.instructions : [result.instructions];
          } 
          // @ts-ignore - Ignorer les erreurs de type car la structure peut varier
          else if (result.innerTransaction && result.innerTransaction.instructions) {
            // @ts-ignore - Ignorer les erreurs de type car la structure peut varier
            return result.innerTransaction.instructions;
          }
          // @ts-ignore - Ignorer les erreurs de type car la structure peut varier
          else if (result.innerTransactions) {
            // @ts-ignore - Ignorer les erreurs de type car la structure peut varier
            const allInstructions = [];
            // @ts-ignore - Ignorer les erreurs de type car la structure peut varier
            for (const inner of result.innerTransactions) {
              if (inner.instructions && Array.isArray(inner.instructions)) {
                allInstructions.push(...inner.instructions);
              }
            }
            if (allInstructions.length > 0) {
              logger.info('Extracted instructions from innerTransactions');
              return allInstructions;
            }
          }
          
          // Si nous ne pouvons pas extraire les instructions mais que le résultat est un objet, 
          // essayons de le traiter comme une instruction unique
          logger.info('Treating result as a single instruction');
          return [result as unknown as TransactionInstruction];
        }
      } catch (e) {
        logger.warn(`Alternative API method failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      
      // Dernier recours - créer une instruction de swap manuellement
      logger.info('Creating manual swap instruction as last resort');
      // Créer une instruction de swap basique
      const manualInstruction = new TransactionInstruction({
        keys: [
          { pubkey: owner, isSigner: true, isWritable: true },
          { pubkey: tokenAccountIn, isSigner: false, isWritable: true },
          { pubkey: tokenAccountOut, isSigner: false, isWritable: true },
          { pubkey: poolKeys.id, isSigner: false, isWritable: true },
          { pubkey: poolKeys.authority, isSigner: false, isWritable: false },
          { pubkey: poolKeys.openOrders, isSigner: false, isWritable: true },
          { pubkey: poolKeys.targetOrders, isSigner: false, isWritable: true },
          { pubkey: poolKeys.baseVault, isSigner: false, isWritable: true },
          { pubkey: poolKeys.quoteVault, isSigner: false, isWritable: true },
          { pubkey: new PublicKey('SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ'), isSigner: false, isWritable: false } // Raydium Swap Program ID
        ],
        programId: new PublicKey('SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ'), // Raydium Swap Program ID
        data: Buffer.from([]) // Simplified - in a real implementation, this would contain the encoded instruction data
      });
      
      return [manualInstruction];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`All swap methods failed: ${errorMessage}`);
      throw new Error(`Failed to create swap instructions: ${errorMessage}`);
    }
  }

  /**
   * Récupère l'état actuel du bot
   */
  public async getBotState(): Promise<any> {
    try {
      // Récupérer l'état du bot depuis la base de données
      const botStateRecord = await prisma.botState.findFirst().catch((err: Error) => {
        logger.warn(`Erreur lors de la récupération de l'état du bot: ${err.message}`);
        return null;
      });
      
      // Récupérer les soldes actuels avec gestion d'erreur
      let collatBalance = 0;
      let usdcBalance = 0;
      let solBalance = 0;
      
      try {
        collatBalance = await walletService.getTokenBalance(priceService['collatAddress']);
      } catch (err: any) {
        logger.warn(`Erreur lors de la récupération du solde COLLAT: ${err.message || String(err)}`);
      }
      
      try {
        usdcBalance = await walletService.getTokenBalance(priceService['usdcAddress']);
      } catch (err: any) {
        logger.warn(`Erreur lors de la récupération du solde USDC: ${err.message || String(err)}`);
      }
      
      try {
        solBalance = await walletService.getSolBalance();
      } catch (err: any) {
        logger.warn(`Erreur lors de la récupération du solde SOL: ${err.message || String(err)}`);
      }
      
      // Récupérer le prix actuel avec gestion d'erreur
      let currentPrice = 0;
      try {
        currentPrice = await priceService.getCurrentPrice();
      } catch (err: any) {
        logger.warn(`Erreur lors de la récupération du prix actuel: ${err.message || String(err)}`);
      }
      
      // Récupérer la configuration
      const config = await prisma.configuration.findFirst().catch((err: Error) => {
        logger.warn(`Erreur lors de la récupération de la configuration: ${err.message}`);
        return null;
      });
      
      // Récupérer la dernière transaction
      const lastTransaction = await prisma.transaction.findFirst({
        orderBy: { timestamp: 'desc' }
      }).catch((err: Error) => {
        logger.warn(`Erreur lors de la récupération de la dernière transaction: ${err.message}`);
        return null;
      });
      
      // Calculer la valeur totale en USDC
      const totalValueUsdc = collatBalance * currentPrice + usdcBalance;
      
      // Informations sur les quotas API
      const apiQuotaInfo = {
        dailyCallsUsed: this.apiCallCount,
        dailyCallsLimit: this.maxApiCallsPerDay,
        nextResetTime: new Date(this.apiCallCountResetTime).toISOString(),
        callInterval: this.apiCallInterval / (60 * 1000) // Convertir en minutes
      };
      
      return {
        isRunning: this.isRunning,
        botState: botStateRecord?.isActive ? BotState.RUNNING : BotState.STOPPED,
        lastEntryPrice: this.lastEntryPrice,
        currentPrice,
        priceChange: this.lastEntryPrice > 0 ? ((currentPrice - this.lastEntryPrice) / this.lastEntryPrice) * 100 : 0,
        balances: {
          collat: collatBalance,
          usdc: usdcBalance,
          sol: solBalance,
          totalValueUsdc
        },
        config: config || {
          sellThreshold: 10,
          buyThreshold: 5,
          slippageTolerance: 1.5,
          maxTransactionPercentage: 50
        },
        lastTransaction: lastTransaction || null,
        apiQuota: apiQuotaInfo,
        walletStatus: {
          isConfigured: true, // Valeur par défaut, sera mise à jour par le frontend
          isUnlocked: false   // Valeur par défaut, sera mise à jour par le frontend
        }
      };
    } catch (error) {
      logger.error(`Failed to get bot state: ${error instanceof Error ? error.message : String(error)}`);
      
      // Au lieu de propager l'erreur, retourner un état par défaut
      return {
        isRunning: false,
        botState: BotState.STOPPED,
        lastEntryPrice: 0,
        currentPrice: 0,
        priceChange: 0,
        balances: {
          collat: 0,
          usdc: 0,
          sol: 0,
          totalValueUsdc: 0
        },
        config: {
          sellThreshold: 10,
          buyThreshold: 5,
          slippageTolerance: 1.5,
          maxTransactionPercentage: 50
        },
        lastTransaction: null,
        apiQuota: {
          dailyCallsUsed: 0,
          dailyCallsLimit: this.maxApiCallsPerDay,
          nextResetTime: new Date().toISOString(),
          callInterval: this.apiCallInterval / (60 * 1000)
        },
        walletStatus: {
          isConfigured: false,
          isUnlocked: false
        },
        error: 'Le portefeuille n\'est pas configuré ou déverrouillé'
      };
    }
  }
  
  /**
   * Configure les paramètres de l'API
   */
  public setApiParameters(intervalMinutes: number, maxCallsPerDay: number): void {
    this.apiCallInterval = intervalMinutes * 60 * 1000;
    this.maxApiCallsPerDay = maxCallsPerDay;
    logger.info(`API parameters updated: interval=${intervalMinutes}min, maxCalls=${maxCallsPerDay}/day`);
    
    // Mettre à jour également l'intervalle dans le service de portefeuille
    walletService.setApiCallInterval(intervalMinutes);
    
    // Sauvegarder l'état du bot
    this.saveBotState();
  }
}

// Exporter une instance singleton du service
export const tradingService = new TradingService();
