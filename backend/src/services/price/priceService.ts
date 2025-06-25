import { Connection } from '@solana/web3.js';
import { LiquidityPoolKeys } from '@raydium-io/raydium-sdk';
import config from '../../config/config';
import logger from '../../utils/logger';
import { PrismaClient } from '@prisma/client';
import { RaydiumAdapter } from './raydiumAdapter';

const prisma = new PrismaClient();

class PriceService {
  private connection: Connection;
  private raydiumAdapter: RaydiumAdapter;
  private collatAddress: string;
  private usdcAddress: string;
  private poolCache: Map<string, { keys: LiquidityPoolKeys, lastUpdated: number }> = new Map();
  private priceCache: Map<string, { price: number, lastUpdated: number }> = new Map();
  private cacheTTL = 30000; // 30 secondes en millisecondes

  constructor() {
    this.connection = new Connection(config.solana.rpcEndpoints[0], 'confirmed');
    this.raydiumAdapter = new RaydiumAdapter(this.connection);
    this.collatAddress = config.solana.tokenInfo.COLLAT.address;
    this.usdcAddress = config.solana.tokenInfo.USDC.address;
  }

  /**
   * Obtient les clés du pool de liquidité pour une paire de tokens
   */
  private async getLiquidityPoolKeys(tokenAAddress: string, tokenBAddress: string): Promise<LiquidityPoolKeys> {
    const cacheKey = `${tokenAAddress}-${tokenBAddress}`;
    const now = Date.now();
    
    // Vérifier si les clés sont en cache et valides
    const cachedPool = this.poolCache.get(cacheKey);
    if (cachedPool && (now - cachedPool.lastUpdated) < this.cacheTTL) {
      return cachedPool.keys;
    }
    
    try {
      // Utiliser l'adaptateur pour obtenir les clés du pool
      const poolKeys = await this.raydiumAdapter.getLiquidityPoolKeys(tokenAAddress, tokenBAddress);
      
      // Mettre en cache les clés du pool
      this.poolCache.set(cacheKey, { keys: poolKeys, lastUpdated: now });
      
      return poolKeys;
    } catch (error) {
      logger.error(`Failed to get liquidity pool keys: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to get liquidity pool information');
    }
  }

  /**
   * Obtient le prix actuel d'un token par rapport à un autre
   */
  async getPrice(tokenAddress: string, baseTokenAddress: string): Promise<number> {
    const cacheKey = `${tokenAddress}-${baseTokenAddress}`;
    const now = Date.now();
    
    // Vérifier si le prix est en cache et valide
    const cachedPrice = this.priceCache.get(cacheKey);
    if (cachedPrice && (now - cachedPrice.lastUpdated) < this.cacheTTL) {
      return cachedPrice.price;
    }
    
    try {
      // Obtenir les clés du pool
      const poolKeys = await this.getLiquidityPoolKeys(tokenAddress, baseTokenAddress);
      
      // Créer les objets Token
      const tokenA = this.raydiumAdapter.createToken(
        poolKeys.baseMint,
        poolKeys.baseDecimals,
        'BASE',
        'Base Token'
      );
      
      const tokenB = this.raydiumAdapter.createToken(
        poolKeys.quoteMint,
        poolKeys.quoteDecimals,
        'QUOTE',
        'Quote Token'
      );
      
      // Déterminer quel token est notre token cible et quel token est la base
      const isBaseA = poolKeys.baseMint.toString() === tokenAddress;
      const targetToken = isBaseA ? tokenA : tokenB;
      const baseToken = isBaseA ? tokenB : tokenA;
      
      // Calculer le prix en utilisant l'adaptateur
      const price = await this.raydiumAdapter.calculatePrice(poolKeys, targetToken, baseToken);
      
      // Mettre en cache le prix
      this.priceCache.set(cacheKey, { price, lastUpdated: now });
      
      // Mettre à jour le prix actuel dans la base de données
      await this.updateCurrentPriceInDB(price);
      
      return price;
    } catch (error) {
      logger.error(`Failed to get price: ${error instanceof Error ? error.message : String(error)}`);
      
      // En cas d'erreur, essayer de récupérer le dernier prix connu
      const lastKnownPrice = await prisma.botState.findFirst();
      
      if (lastKnownPrice && lastKnownPrice.currentPrice) {
        return parseFloat(lastKnownPrice.currentPrice.toString());
      }
      
      throw new Error('Failed to get token price');
    }
  }

  /**
   * Obtient le prix du COLLAT par rapport à l'USDC
   */
  async getCollatPrice(): Promise<number> {
    try {
      // Vérifier que les adresses sont valides avant d'appeler getPrice
      if (!this.collatAddress || !this.usdcAddress || 
          !this.collatAddress.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/) || 
          !this.usdcAddress.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
        logger.warn('Adresses de tokens non valides ou non initialisées');
        return 0; // Retourner une valeur par défaut
      }
      return this.getPrice(this.collatAddress, this.usdcAddress);
    } catch (error) {
      logger.error(`Erreur lors de l'obtention du prix COLLAT: ${error instanceof Error ? error.message : String(error)}`);
      return 0; // Retourner une valeur par défaut en cas d'erreur
    }
  }
  
  /**
   * Obtient le prix actuel (alias pour getCollatPrice pour compatibilité API)
   */
  async getCurrentPrice(): Promise<number> {
    try {
      return this.getCollatPrice();
    } catch (error) {
      logger.error(`Erreur lors de l'obtention du prix actuel: ${error instanceof Error ? error.message : String(error)}`);
      return 0; // Retourner une valeur par défaut en cas d'erreur
    }
  }

  /**
   * Met à jour le prix actuel dans la base de données
   */
  private async updateCurrentPriceInDB(price: number): Promise<void> {
    try {
      // Obtenir l'état actuel du bot
      const botState = await prisma.botState.findFirst();
      
      if (botState) {
        // Mettre à jour l'état existant
        await prisma.botState.update({
          where: { id: botState.id },
          data: { currentPrice: price.toString(), lastUpdated: new Date() }
        });
      } else {
        // Créer un nouvel état
        await prisma.botState.create({
          data: { currentPrice: price.toString() }
        });
      }
      
      logger.debug(`Updated current COLLAT price in DB: ${price}`);
    } catch (error) {
      logger.error(`Failed to update price in DB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calcule le montant optimal pour un swap afin de minimiser l'impact sur le prix
   */
  public async calculateOptimalSwapAmount(
    totalAmount: number,
    fromTokenAddress: string,
    toTokenAddress: string
  ): Promise<number> {
    try {
      // Obtenir les clés du pool
      const poolKeys = await this.getLiquidityPoolKeys(fromTokenAddress, toTokenAddress);
      
      // Obtenir les informations du pool via l'adaptateur
      const poolInfo = await this.raydiumAdapter.fetchPoolInfo(poolKeys);
      
      // Obtenir la liquidité du pool
      const baseReserve = Number(poolInfo.baseReserve.toString());
      const quoteReserve = Number(poolInfo.quoteReserve.toString());
      const liquidity = baseReserve + quoteReserve;
      
      // Calculer le pourcentage maximal de la liquidité à utiliser (pour limiter l'impact)
      const maxPercentage = Math.min(config.trading.maxTransactionPercentage / 100, 0.01); // Max 1% de la liquidité
      
      // Calculer le montant optimal
      const optimalAmount = Math.min(totalAmount, liquidity * maxPercentage);
      
      logger.info(`Calculated optimal swap amount: ${optimalAmount} (${(optimalAmount / totalAmount * 100).toFixed(2)}% of total)`);
      
      return optimalAmount;
    } catch (error) {
      logger.error(`Failed to calculate optimal swap amount: ${error instanceof Error ? error.message : String(error)}`);
      
      // En cas d'erreur, utiliser un pourcentage fixe du montant total
      const fallbackAmount = totalAmount * (config.trading.maxTransactionPercentage / 100);
      logger.warn(`Using fallback swap amount: ${fallbackAmount}`);
      
      return fallbackAmount;
    }
  }

  /**
   * Obtient la liquidité disponible dans un pool
   */
  public async getPoolLiquidity(tokenAAddress: string, tokenBAddress: string): Promise<number> {
    try {
      // Obtenir les clés du pool
      const poolKeys = await this.getLiquidityPoolKeys(tokenAAddress, tokenBAddress);
      
      // Obtenir les informations du pool via l'adaptateur
      const poolInfo = await this.raydiumAdapter.fetchPoolInfo(poolKeys);
      
      // Calculer la liquidité totale
      const baseReserve = Number(poolInfo.baseReserve.toString()) / (10 ** poolKeys.baseDecimals);
      const quoteReserve = Number(poolInfo.quoteReserve.toString()) / (10 ** poolKeys.quoteDecimals);
      
      // Obtenir le prix pour convertir en une seule unité (USDC)
      const basePrice = poolKeys.baseMint.toString() === this.usdcAddress ? 1 : 
                       await this.getPrice(poolKeys.baseMint.toString(), this.usdcAddress);
      
      const quotePrice = poolKeys.quoteMint.toString() === this.usdcAddress ? 1 :
                        await this.getPrice(poolKeys.quoteMint.toString(), this.usdcAddress);
      
      // Calculer la liquidité totale en USDC
      const totalLiquidityInUsdc = (baseReserve * basePrice) + (quoteReserve * quotePrice);
      
      logger.info(`Pool liquidity for ${tokenAAddress}-${tokenBAddress}: ${totalLiquidityInUsdc} USDC`);
      
      return totalLiquidityInUsdc;
    } catch (error) {
      logger.error(`Failed to get pool liquidity: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to get pool liquidity');
    }
  }
}

// Exporter une instance singleton du service
export const priceService = new PriceService();
