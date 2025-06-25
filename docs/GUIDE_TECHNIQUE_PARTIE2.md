# Guide Technique du Bot de Trading $COLLAT - Partie 2 : Services Métier

## Services Métier

Les services métier constituent le cœur du bot de trading. Ils implémentent la logique de trading, la récupération des prix, la gestion du portefeuille et les notifications.

## 1. Service de Prix (PriceService)

Le `PriceService` est responsable de la récupération des prix actuels du token $COLLAT par rapport à l'USDC, ainsi que des informations sur la liquidité du pool Raydium.

### Fonctionnalités principales
- Récupération du prix actuel du token $COLLAT
- Calcul du prix d'impact pour les swaps
- Détermination de la liquidité disponible dans le pool

### Implémentation

```typescript
// Extrait simplifié de priceService.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { Liquidity, Token, TokenAmount, Percent } from '@raydium-io/raydium-sdk';
import { logger } from '../../utils/logger';

export class PriceService {
  private connection: Connection;
  private primaryEndpoint: string;
  private secondaryEndpoint: string;

  constructor(rpcConfig: { primaryEndpoint: string; secondaryEndpoint: string }) {
    this.primaryEndpoint = rpcConfig.primaryEndpoint;
    this.secondaryEndpoint = rpcConfig.secondaryEndpoint;
    this.connection = new Connection(this.primaryEndpoint);
  }

  /**
   * Récupère le prix actuel du token $COLLAT en USDC
   */
  async getCurrentPrice(collatAddress: string, usdcAddress: string): Promise<number> {
    try {
      // Récupérer les informations du pool de liquidité Raydium
      const poolInfo = await this.getPoolInfo(collatAddress, usdcAddress);
      
      // Calculer le prix à partir des réserves du pool
      const collatReserve = poolInfo.baseReserve.toNumber();
      const usdcReserve = poolInfo.quoteReserve.toNumber();
      
      if (collatReserve === 0) {
        throw new Error('Réserve de COLLAT nulle dans le pool');
      }
      
      // Prix = USDC / COLLAT
      const price = usdcReserve / collatReserve;
      
      logger.info(`Prix actuel de COLLAT: ${price} USDC`);
      return price;
    } catch (error) {
      logger.error('Erreur lors de la récupération du prix:', error);
      
      // Essayer avec l'endpoint secondaire en cas d'échec
      if (this.connection.rpcEndpoint === this.primaryEndpoint) {
        logger.info('Basculement vers l\'endpoint RPC secondaire');
        this.connection = new Connection(this.secondaryEndpoint);
        return this.getCurrentPrice(collatAddress, usdcAddress);
      }
      
      throw error;
    }
  }

  /**
   * Calcule le prix d'impact pour un swap d'un montant donné
   */
  async calculatePriceImpact(
    inputToken: string,
    outputToken: string,
    amount: number,
    isInputCollat: boolean
  ): Promise<number> {
    try {
      // Récupérer les informations du pool
      const poolInfo = await this.getPoolInfo(
        isInputCollat ? inputToken : outputToken,
        isInputCollat ? outputToken : inputToken
      );
      
      // Calculer l'impact de prix en fonction de la taille de la transaction et de la liquidité
      // Logique simplifiée ici - dans un cas réel, utiliser les formules exactes de Raydium
      const inputReserve = isInputCollat ? poolInfo.baseReserve.toNumber() : poolInfo.quoteReserve.toNumber();
      const outputReserve = isInputCollat ? poolInfo.quoteReserve.toNumber() : poolInfo.baseReserve.toNumber();
      
      // Formule simplifiée de l'impact de prix
      const priceImpact = (amount / (inputReserve + amount)) * 100;
      
      logger.info(`Impact de prix estimé: ${priceImpact.toFixed(2)}%`);
      return priceImpact;
    } catch (error) {
      logger.error('Erreur lors du calcul de l\'impact de prix:', error);
      throw error;
    }
  }

  /**
   * Récupère les informations du pool de liquidité Raydium
   */
  private async getPoolInfo(collatAddress: string, usdcAddress: string): Promise<any> {
    // Implémentation réelle: utiliser Raydium SDK pour récupérer les informations du pool
    // Code simplifié pour l'exemple
    try {
      const collatPublicKey = new PublicKey(collatAddress);
      const usdcPublicKey = new PublicKey(usdcAddress);
      
      // Récupérer l'adresse du pool Raydium pour la paire COLLAT/USDC
      // Dans un cas réel, utiliser Liquidity.fetchAllPoolKeys ou rechercher dans une liste connue
      
      // Récupérer les informations du pool
      // Simulation pour l'exemple
      return {
        baseReserve: { toNumber: () => 1000000 }, // Réserve de COLLAT
        quoteReserve: { toNumber: () => 500000 },  // Réserve d'USDC
        lpSupply: { toNumber: () => 700000 },      // Supply de LP tokens
        // Autres informations du pool...
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des informations du pool:', error);
      throw error;
    }
  }
}
```

## 2. Service de Portefeuille (WalletService)

Le `WalletService` gère les interactions avec la blockchain Solana, notamment la création de transactions, la signature et la vérification des soldes.

### Fonctionnalités principales
- Initialisation du portefeuille à partir de la clé privée
- Vérification des soldes de tokens
- Création et signature de transactions
- Estimation des frais de transaction

### Implémentation

```typescript
// Extrait simplifié de walletService.ts
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { logger } from '../../utils/logger';

export class WalletService {
  private connection: Connection;
  private keypair: Keypair;

  constructor(walletConfig: { privateKey: string }) {
    // Initialiser la connexion à Solana
    this.connection = new Connection('https://kamel-solanam-876d.mainnet.rpcpool.com');
    
    // Initialiser le keypair à partir de la clé privée
    // Dans un cas réel, la clé privée serait chiffrée et déchiffrée ici
    const privateKeyBytes = Buffer.from(walletConfig.privateKey, 'base64');
    this.keypair = Keypair.fromSecretKey(privateKeyBytes);
    
    logger.info(`Portefeuille initialisé: ${this.keypair.publicKey.toString()}`);
  }

  /**
   * Récupère l'adresse publique du portefeuille
   */
  getPublicKey(): string {
    return this.keypair.publicKey.toString();
  }

  /**
   * Vérifie le solde de SOL
   */
  async getSolBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      return balance / 1e9; // Convertir en SOL (1 SOL = 10^9 lamports)
    } catch (error) {
      logger.error('Erreur lors de la récupération du solde SOL:', error);
      throw error;
    }
  }

  /**
   * Vérifie le solde d'un token SPL
   */
  async getTokenBalance(tokenAddress: string): Promise<number> {
    try {
      const tokenPublicKey = new PublicKey(tokenAddress);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.keypair.publicKey,
        { mint: tokenPublicKey }
      );
      
      if (tokenAccounts.value.length === 0) {
        return 0;
      }
      
      // Récupérer le premier compte de token trouvé
      const tokenAccount = tokenAccounts.value[0];
      const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;
      
      // Convertir en nombre décimal en tenant compte des décimales
      return tokenAmount.uiAmount || 0;
    } catch (error) {
      logger.error(`Erreur lors de la récupération du solde du token ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Signe et envoie une transaction
   */
  async signAndSendTransaction(transaction: Transaction): Promise<string> {
    try {
      // Récupérer le blockhash récent
      const { blockhash } = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.keypair.publicKey;
      
      // Signer la transaction
      transaction.sign(this.keypair);
      
      // Envoyer la transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair]
      );
      
      logger.info(`Transaction envoyée: ${signature}`);
      return signature;
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de la transaction:', error);
      throw error;
    }
  }
}
```

## 3. Service de Trading (TradingService)

Le `TradingService` implémente la logique principale de trading, y compris l'algorithme de trading, les conditions d'achat et de vente, et l'exécution des swaps via Raydium.

### Fonctionnalités principales
- Exécution de l'algorithme de trading
- Évaluation des conditions d'achat et de vente
- Exécution des swaps via Raydium
- Suivi des transactions et mise à jour de l'état

### Implémentation

```typescript
// Extrait simplifié de tradingService.ts
import { PrismaClient } from '@prisma/client';
import { WalletService } from '../wallet/walletService';
import { PriceService } from '../price/priceService';
import { NotificationService } from '../notification/notificationService';
import { logger } from '../../utils/logger';

interface TradingConfig {
  sellThreshold: number;
  buyThreshold: number;
  slippageTolerance: number;
  maxTransactionPercentage: number;
  tokens: {
    collat: {
      address: string;
      decimals: number;
    };
    usdc: {
      address: string;
      decimals: number;
    };
  };
}

export class TradingService {
  private isRunning: boolean = false;
  private lastTradeType: 'BUY' | 'SELL' | null = null;
  private entryPrice: number | null = null;

  constructor(
    private walletService: WalletService,
    private priceService: PriceService,
    private notificationService: NotificationService,
    private prisma: PrismaClient,
    private config: TradingConfig
  ) {
    logger.info('Service de trading initialisé');
  }

  /**
   * Démarre le bot de trading
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      logger.info('Le bot est déjà en cours d\'exécution');
      return true;
    }

    try {
      // Vérifier les soldes avant de démarrer
      const solBalance = await this.walletService.getSolBalance();
      const collatBalance = await this.walletService.getTokenBalance(this.config.tokens.collat.address);
      const usdcBalance = await this.walletService.getTokenBalance(this.config.tokens.usdc.address);

      logger.info(`Soldes actuels: ${solBalance} SOL, ${collatBalance} COLLAT, ${usdcBalance} USDC`);

      if (solBalance < 0.01) {
        throw new Error('Solde SOL insuffisant pour les frais de transaction');
      }

      // Récupérer le dernier prix d'entrée depuis la base de données
      const lastTrade = await this.prisma.trade.findFirst({
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (lastTrade) {
        this.entryPrice = lastTrade.price;
        this.lastTradeType = lastTrade.type as 'BUY' | 'SELL';
      } else {
        // Si aucune transaction précédente, définir le prix actuel comme prix d'entrée
        const currentPrice = await this.priceService.getCurrentPrice(
          this.config.tokens.collat.address,
          this.config.tokens.usdc.address
        );
        this.entryPrice = currentPrice;
      }

      this.isRunning = true;
      logger.info(`Bot démarré avec un prix d'entrée de ${this.entryPrice} USDC`);
      
      // Envoyer une notification
      await this.notificationService.sendAlert(
        'Bot démarré',
        `Le bot de trading a été démarré avec un prix d'entrée de ${this.entryPrice} USDC.`
      );

      return true;
    } catch (error) {
      logger.error('Erreur lors du démarrage du bot:', error);
      await this.notificationService.sendAlert(
        'Erreur de démarrage',
        `Le bot n'a pas pu démarrer: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Arrête le bot de trading
   */
  async stop(): Promise<boolean> {
    if (!this.isRunning) {
      logger.info('Le bot est déjà arrêté');
      return true;
    }

    this.isRunning = false;
    logger.info('Bot arrêté');
    
    // Envoyer une notification
    await this.notificationService.sendAlert(
      'Bot arrêté',
      'Le bot de trading a été arrêté manuellement.'
    );

    return true;
  }

  /**
   * Vérifie si le bot est en cours d'exécution
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Exécute l'algorithme de trading
   */
  async runTradingAlgorithm(): Promise<void> {
    if (!this.isRunning) {
      logger.debug('Le bot est arrêté, algorithme non exécuté');
      return;
    }

    try {
      // Récupérer le prix actuel
      const currentPrice = await this.priceService.getCurrentPrice(
        this.config.tokens.collat.address,
        this.config.tokens.usdc.address
      );

      // Récupérer les soldes actuels
      const collatBalance = await this.walletService.getTokenBalance(this.config.tokens.collat.address);
      const usdcBalance = await this.walletService.getTokenBalance(this.config.tokens.usdc.address);

      // Créer un snapshot du portefeuille
      await this.prisma.portfolioSnapshot.create({
        data: {
          collatBalance,
          usdcBalance,
          collatPrice: currentPrice,
          totalValueUsdc: collatBalance * currentPrice + usdcBalance,
          timestamp: new Date(),
        },
      });

      // Si le prix d'entrée n'est pas défini, l'initialiser
      if (!this.entryPrice) {
        this.entryPrice = currentPrice;
        logger.info(`Prix d'entrée initialisé à ${currentPrice} USDC`);
        return;
      }

      // Calculer la variation de prix en pourcentage
      const priceChange = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
      logger.info(`Prix actuel: ${currentPrice} USDC, Variation: ${priceChange.toFixed(2)}%`);

      // Logique de trading
      if (this.lastTradeType !== 'SELL' && priceChange >= this.config.sellThreshold) {
        // Condition de vente: le prix a augmenté du seuil de vente
        await this.executeSell(currentPrice, collatBalance);
      } else if (this.lastTradeType === 'SELL' && priceChange <= -this.config.buyThreshold) {
        // Condition d'achat: le prix a diminué du seuil d'achat après une vente
        await this.executeBuy(currentPrice, usdcBalance);
      } else {
        logger.info('Aucune condition de trading remplie');
      }
    } catch (error) {
      logger.error('Erreur lors de l\'exécution de l\'algorithme de trading:', error);
      await this.notificationService.sendAlert(
        'Erreur d\'algorithme',
        `Erreur lors de l'exécution de l'algorithme de trading: ${error.message}`
      );
    }
  }

  /**
   * Exécute une opération de vente
   */
  private async executeSell(currentPrice: number, collatBalance: number): Promise<void> {
    try {
      logger.info('Condition de vente remplie, exécution de la vente');

      // Calculer le montant à vendre (50% des tokens COLLAT)
      const amountToSell = collatBalance * (this.config.maxTransactionPercentage / 100);
      
      if (amountToSell <= 0) {
        logger.warn('Aucun token COLLAT à vendre');
        return;
      }

      // Vérifier l'impact de prix
      const priceImpact = await this.priceService.calculatePriceImpact(
        this.config.tokens.collat.address,
        this.config.tokens.usdc.address,
        amountToSell,
        true
      );

      if (priceImpact > this.config.slippageTolerance) {
        logger.warn(`Impact de prix trop élevé: ${priceImpact.toFixed(2)}%, transaction annulée`);
        await this.notificationService.sendAlert(
          'Transaction annulée',
          `Vente annulée en raison d'un impact de prix trop élevé: ${priceImpact.toFixed(2)}%`
        );
        return;
      }

      // Exécuter le swap via Raydium (implémentation réelle utiliserait Raydium SDK)
      // Simulation pour l'exemple
      const expectedUsdcAmount = amountToSell * currentPrice;
      const txHash = `simulatedTxHash_${Date.now()}`;

      // Enregistrer la transaction dans la base de données
      await this.prisma.trade.create({
        data: {
          type: 'SELL',
          amount: amountToSell,
          price: currentPrice,
          txHash,
          status: 'CONFIRMED',
          timestamp: new Date(),
        },
      });

      // Mettre à jour l'état interne
      this.lastTradeType = 'SELL';
      this.entryPrice = currentPrice;

      logger.info(`Vente exécutée: ${amountToSell} COLLAT à ${currentPrice} USDC, Hash: ${txHash}`);
      
      // Envoyer une notification
      await this.notificationService.sendAlert(
        'Vente exécutée',
        `Vente de ${amountToSell} COLLAT à ${currentPrice} USDC pour un total de ${expectedUsdcAmount} USDC.`
      );
    } catch (error) {
      logger.error('Erreur lors de l\'exécution de la vente:', error);
      await this.notificationService.sendAlert(
        'Erreur de vente',
        `La vente n'a pas pu être exécutée: ${error.message}`
      );
    }
  }

  /**
   * Exécute une opération d'achat
   */
  private async executeBuy(currentPrice: number, usdcBalance: number): Promise<void> {
    try {
      logger.info('Condition d\'achat remplie, exécution de l\'achat');

      // Calculer le montant à dépenser (50% des USDC)
      const usdcToSpend = usdcBalance * (this.config.maxTransactionPercentage / 100);
      
      if (usdcToSpend <= 0) {
        logger.warn('Aucun USDC à dépenser');
        return;
      }

      // Calculer le montant de COLLAT à recevoir
      const expectedCollatAmount = usdcToSpend / currentPrice;

      // Vérifier l'impact de prix
      const priceImpact = await this.priceService.calculatePriceImpact(
        this.config.tokens.usdc.address,
        this.config.tokens.collat.address,
        usdcToSpend,
        false
      );

      if (priceImpact > this.config.slippageTolerance) {
        logger.warn(`Impact de prix trop élevé: ${priceImpact.toFixed(2)}%, transaction annulée`);
        await this.notificationService.sendAlert(
          'Transaction annulée',
          `Achat annulé en raison d'un impact de prix trop élevé: ${priceImpact.toFixed(2)}%`
        );
        return;
      }

      // Exécuter le swap via Raydium (implémentation réelle utiliserait Raydium SDK)
      // Simulation pour l'exemple
      const txHash = `simulatedTxHash_${Date.now()}`;

      // Enregistrer la transaction dans la base de données
      await this.prisma.trade.create({
        data: {
          type: 'BUY',
          amount: expectedCollatAmount,
          price: currentPrice,
          txHash,
          status: 'CONFIRMED',
          timestamp: new Date(),
        },
      });

      // Mettre à jour l'état interne
      this.lastTradeType = 'BUY';
      this.entryPrice = currentPrice;

      logger.info(`Achat exécuté: ${expectedCollatAmount} COLLAT à ${currentPrice} USDC, Hash: ${txHash}`);
      
      // Envoyer une notification
      await this.notificationService.sendAlert(
        'Achat exécuté',
        `Achat de ${expectedCollatAmount} COLLAT à ${currentPrice} USDC pour un total de ${usdcToSpend} USDC.`
      );
    } catch (error) {
      logger.error('Erreur lors de l\'exécution de l\'achat:', error);
      await this.notificationService.sendAlert(
        'Erreur d\'achat',
        `L'achat n'a pas pu être exécuté: ${error.message}`
      );
    }
  }

  /**
   * Récupère l'état actuel du bot
   */
  async getStatus(): Promise<any> {
    try {
      const currentPrice = await this.priceService.getCurrentPrice(
        this.config.tokens.collat.address,
        this.config.tokens.usdc.address
      );

      const collatBalance = await this.walletService.getTokenBalance(this.config.tokens.collat.address);
      const usdcBalance = await this.walletService.getTokenBalance(this.config.tokens.usdc.address);
      const solBalance = await this.walletService.getSolBalance();

      return {
        isActive: this.isRunning,
        currentPrice,
        entryPrice: this.entryPrice,
        lastTradeType: this.lastTradeType,
        balances: {
          collat: collatBalance,
          usdc: usdcBalance,
          sol: solBalance,
          totalValueUsdc: collatBalance * currentPrice + usdcBalance,
        },
        config: {
          sellThreshold: this.config.sellThreshold,
          buyThreshold: this.config.buyThreshold,
          slippageTolerance: this.config.slippageTolerance,
          maxTransactionPercentage: this.config.maxTransactionPercentage,
        },
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération de l\'état du bot:', error);
      throw error;
    }
  }
}
```

Dans la prochaine partie, nous examinerons le service de notification et l'API REST qui expose les fonctionnalités du bot.
