# 5. Logique métier du bot de trading

## 5.1 Stratégie de trading

Le bot $COLLAT implémente une stratégie de trading basée sur les seuils de prix, conçue pour automatiser l'achat et la vente du token $COLLAT contre USDC en fonction des variations de prix.

### 5.1.1 Principes fondamentaux

La stratégie repose sur les principes suivants :
1. **Achat lors des baisses** : Le bot achète $COLLAT lorsque le prix baisse d'un certain pourcentage par rapport au dernier prix d'entrée
2. **Vente lors des hausses** : Le bot vend $COLLAT lorsque le prix augmente d'un certain pourcentage par rapport au dernier prix d'entrée
3. **Gestion du slippage** : Une tolérance de slippage configurable est appliquée pour s'adapter aux conditions du marché
4. **Limitation des transactions** : Un pourcentage maximum du portefeuille peut être utilisé par transaction pour gérer le risque

### 5.1.2 Paramètres configurables

Les paramètres clés de la stratégie sont :
- `buyThreshold` : Pourcentage de baisse du prix déclenchant un achat (par défaut : 5%)
- `sellThreshold` : Pourcentage de hausse du prix déclenchant une vente (par défaut : 10%)
- `slippageTolerance` : Tolérance de glissement de prix acceptable (par défaut : 1.5%)
- `maxTransactionPercentage` : Pourcentage maximum du portefeuille utilisé par transaction (par défaut : 50%)

## 5.2 Cycle de trading

### 5.2.1 Surveillance des prix

Le bot surveille en continu le prix du token $COLLAT selon un intervalle défini :

```typescript
private async startPriceMonitoring(): void {
  if (this.priceMonitoringInterval) {
    clearInterval(this.priceMonitoringInterval);
  }
  
  this.priceMonitoringInterval = setInterval(async () => {
    try {
      // Vérifier si le bot est en cours d'exécution
      if (!this.isRunning) return;
      
      // Vérifier si le portefeuille est déverrouillé
      if (!walletService.isUnlocked()) {
        logger.warn('Wallet is locked, skipping price check');
        return;
      }
      
      // Récupérer le prix actuel
      const currentPrice = await priceService.getCurrentPrice();
      
      // Mettre à jour l'état du bot
      await this.handlePriceUpdate(currentPrice);
      
      // Notifier via WebSocket
      websocketService.notifyPriceUpdate(currentPrice);
      
      // Vérifier les conditions de trading
      await this.checkAndExecuteTrade(currentPrice);
      
    } catch (error) {
      logger.error(`Error in price monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, this.priceCheckInterval);
}
```

### 5.2.2 Évaluation des conditions de trading

À chaque mise à jour de prix, le bot évalue si les conditions d'achat ou de vente sont remplies :

```typescript
private async checkAndExecuteTrade(currentPrice: number): Promise<void> {
  try {
    // Récupérer la configuration
    const config = await prisma.configuration.findFirst();
    if (!config) throw new Error('Configuration not found');
    
    // Récupérer le dernier prix d'entrée
    const lastEntryPrice = this.lastEntryPrice;
    
    // Si aucun prix d'entrée n'est défini, définir le prix actuel comme référence
    if (lastEntryPrice === 0) {
      this.lastEntryPrice = currentPrice;
      return;
    }
    
    // Calculer la variation de prix en pourcentage
    const priceChange = ((currentPrice - lastEntryPrice) / lastEntryPrice) * 100;
    
    // Vérifier les conditions d'achat (prix en baisse)
    if (priceChange <= -config.buyThreshold) {
      // Récupérer le solde USDC
      const usdcBalance = await walletService.getTokenBalance(priceService['usdcAddress']);
      
      // Vérifier s'il y a suffisamment d'USDC pour trader
      if (usdcBalance > 0) {
        // Calculer le montant à utiliser pour l'achat
        const amountToUse = usdcBalance * (config.maxTransactionPercentage / 100);
        
        // Exécuter l'achat
        await this.executeSwap(SwapDirection.BUY, amountToUse);
        
        // Mettre à jour le prix d'entrée
        this.lastEntryPrice = currentPrice;
      }
    }
    // Vérifier les conditions de vente (prix en hausse)
    else if (priceChange >= config.sellThreshold) {
      // Récupérer le solde COLLAT
      const collatBalance = await walletService.getTokenBalance(priceService['collatAddress']);
      
      // Vérifier s'il y a suffisamment de COLLAT pour trader
      if (collatBalance > 0) {
        // Calculer le montant à utiliser pour la vente
        const amountToUse = collatBalance * (config.maxTransactionPercentage / 100);
        
        // Exécuter la vente
        await this.executeSwap(SwapDirection.SELL, amountToUse);
        
        // Mettre à jour le prix d'entrée
        this.lastEntryPrice = currentPrice;
      }
    }
  } catch (error) {
    logger.error(`Error checking trading conditions: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### 5.2.3 Exécution des swaps

Lorsque les conditions sont remplies, le bot exécute un swap entre $COLLAT et USDC :

```typescript
public async executeSwap(direction: SwapDirection, amount: number): Promise<TransactionResult> {
  try {
    logger.info(`Executing ${direction} swap for ${amount} ${direction === SwapDirection.BUY ? 'USDC' : 'COLLAT'}`);
    
    // Récupérer la configuration
    const config = await prisma.configuration.findFirst();
    if (!config) throw new Error('Configuration not found');
    
    // Récupérer le prix actuel
    const currentPrice = await priceService.getCurrentPrice();
    
    // Créer une transaction Solana
    const transaction = new Transaction();
    
    // Ajouter les instructions de swap en fonction de la direction
    if (direction === SwapDirection.BUY) {
      // Instructions pour acheter COLLAT avec USDC
      // Utilisation de Jupiter Aggregator ou autre DEX pour obtenir le meilleur prix
      // ...
    } else {
      // Instructions pour vendre COLLAT contre USDC
      // ...
    }
    
    // Signer et envoyer la transaction
    const signature = await walletService.signAndSendTransaction(transaction);
    
    // Attendre la confirmation de la transaction
    const confirmation = await connection.confirmTransaction(signature);
    
    // Calculer les montants échangés
    const tokenAmount = direction === SwapDirection.BUY ? amount / currentPrice : amount;
    const usdcAmount = direction === SwapDirection.BUY ? amount : amount * currentPrice;
    
    // Enregistrer la transaction dans la base de données
    const txRecord = await prisma.transaction.create({
      data: {
        type: direction,
        amount: amount,
        price: currentPrice,
        tokenAmount: tokenAmount,
        usdcAmount: usdcAmount,
        txHash: signature,
        status: 'SUCCESS'
      }
    });
    
    // Notifier via WebSocket
    websocketService.notifyTransactionExecuted(txRecord);
    
    return {
      success: true,
      transaction: txRecord
    };
  } catch (error) {
    logger.error(`Swap execution failed: ${error instanceof Error ? error.message : String(error)}`);
    
    // Enregistrer la transaction échouée
    const failedTx = await prisma.transaction.create({
      data: {
        type: direction,
        amount: amount,
        price: await priceService.getCurrentPrice(),
        tokenAmount: 0,
        usdcAmount: 0,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      transaction: failedTx
    };
  }
}
```

## 5.3 Gestion de l'état du bot

### 5.3.1 États possibles

Le bot peut se trouver dans l'un des états suivants :
- `STOPPED` : Le bot est arrêté et n'effectue aucune opération
- `RUNNING` : Le bot surveille activement les prix et exécute des transactions
- `PAUSED` : Le bot est temporairement en pause (par exemple, en cas d'erreur)
- `ERROR` : Le bot a rencontré une erreur qui nécessite une intervention

### 5.3.2 Transitions d'état

Les transitions entre les différents états sont gérées par le service de trading :

```typescript
public async startBot(): Promise<boolean> {
  try {
    // Vérifier si le portefeuille est déverrouillé
    if (!walletService.isUnlocked()) {
      throw new Error('Wallet must be unlocked to start the bot');
    }
    
    // Mettre à jour l'état dans la base de données
    await prisma.botState.upsert({
      where: { id: 1 },
      update: { isActive: true },
      create: { id: 1, isActive: true }
    });
    
    // Mettre à jour l'état en mémoire
    this.isRunning = true;
    
    // Démarrer la surveillance des prix
    this.startPriceMonitoring();
    
    // Notifier le changement d'état
    websocketService.notifyBotStateChange(BotState.RUNNING);
    
    logger.info('Bot started successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to start bot: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

public async stopBot(): Promise<boolean> {
  try {
    // Mettre à jour l'état dans la base de données
    await prisma.botState.upsert({
      where: { id: 1 },
      update: { isActive: false },
      create: { id: 1, isActive: false }
    });
    
    // Mettre à jour l'état en mémoire
    this.isRunning = false;
    
    // Arrêter la surveillance des prix
    if (this.priceMonitoringInterval) {
      clearInterval(this.priceMonitoringInterval);
      this.priceMonitoringInterval = null;
    }
    
    // Notifier le changement d'état
    websocketService.notifyBotStateChange(BotState.STOPPED);
    
    logger.info('Bot stopped successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to stop bot: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
```

## 5.4 Gestion des erreurs et récupération

### 5.4.1 Types d'erreurs gérées

Le bot gère plusieurs types d'erreurs :
- **Erreurs de connexion RPC** : Problèmes de connexion aux nœuds Solana
- **Erreurs de transaction** : Échecs lors de l'exécution des swaps
- **Erreurs de portefeuille** : Problèmes liés au portefeuille (verrouillé, solde insuffisant)
- **Erreurs de prix** : Impossibilité d'obtenir le prix actuel du token

### 5.4.2 Stratégies de récupération

Pour chaque type d'erreur, le bot implémente des stratégies de récupération :

```typescript
private async handleError(error: Error, errorType: ErrorType): Promise<void> {
  logger.error(`Bot error (${errorType}): ${error.message}`);
  
  switch (errorType) {
    case ErrorType.RPC_CONNECTION:
      // Essayer de basculer vers un autre endpoint RPC
      await this.switchRpcEndpoint();
      break;
      
    case ErrorType.TRANSACTION:
      // Attendre et réessayer plus tard
      this.pauseTrading(5 * 60 * 1000); // 5 minutes
      break;
      
    case ErrorType.WALLET:
      // Mettre le bot en pause jusqu'à ce que le portefeuille soit déverrouillé
      this.isRunning = false;
      websocketService.notifyBotStateChange(BotState.ERROR);
      break;
      
    case ErrorType.PRICE:
      // Réessayer avec un autre service de prix ou attendre
      this.pauseTrading(2 * 60 * 1000); // 2 minutes
      break;
      
    default:
      // Erreur inconnue, mettre le bot en pause
      this.pauseTrading(10 * 60 * 1000); // 10 minutes
  }
  
  // Enregistrer l'erreur dans la base de données
  await prisma.botError.create({
    data: {
      type: errorType,
      message: error.message,
      timestamp: new Date()
    }
  });
  
  // Notifier l'erreur
  websocketService.notifyBotError({
    type: errorType,
    message: error.message
  });
}
```

## 5.5 Optimisation des performances

### 5.5.1 Gestion des appels API

Pour éviter de dépasser les limites d'appels API des RPC Solana, le bot implémente un système de limitation :

```typescript
private apiCallCount = 0;
private apiCallCountResetTime = Date.now() + 24 * 60 * 60 * 1000; // 24 heures
private readonly maxApiCallsPerDay = 100;
private readonly apiCallInterval = 10 * 60 * 1000; // 10 minutes
private lastApiCallTime = 0;

private async checkApiRateLimit(): Promise<boolean> {
  const now = Date.now();
  
  // Réinitialiser le compteur si nécessaire
  if (now > this.apiCallCountResetTime) {
    this.apiCallCount = 0;
    this.apiCallCountResetTime = now + 24 * 60 * 60 * 1000;
  }
  
  // Vérifier si la limite quotidienne est atteinte
  if (this.apiCallCount >= this.maxApiCallsPerDay) {
    logger.warn('Daily API call limit reached');
    return false;
  }
  
  // Vérifier l'intervalle entre les appels
  if (now - this.lastApiCallTime < this.apiCallInterval) {
    logger.warn('API call rate limit reached, using cached data');
    return false;
  }
  
  // Mettre à jour les compteurs
  this.apiCallCount++;
  this.lastApiCallTime = now;
  
  return true;
}
```

### 5.5.2 Mise en cache des données

Pour réduire le nombre d'appels API, le bot met en cache certaines données :

```typescript
private priceCache = {
  price: 0,
  timestamp: 0,
  ttl: 5 * 60 * 1000 // 5 minutes
};

private balanceCache = {
  collat: 0,
  usdc: 0,
  sol: 0,
  timestamp: 0,
  ttl: 10 * 60 * 1000 // 10 minutes
};

private async getCachedOrFetchPrice(): Promise<number> {
  const now = Date.now();
  
  // Utiliser le cache si disponible et non expiré
  if (this.priceCache.price > 0 && now - this.priceCache.timestamp < this.priceCache.ttl) {
    return this.priceCache.price;
  }
  
  // Vérifier les limites d'appels API
  if (!await this.checkApiRateLimit()) {
    return this.priceCache.price || 0;
  }
  
  try {
    // Récupérer le prix frais
    const price = await priceService.getCurrentPrice();
    
    // Mettre à jour le cache
    this.priceCache = {
      price,
      timestamp: now,
      ttl: this.priceCache.ttl
    };
    
    return price;
  } catch (error) {
    logger.error(`Error fetching price: ${error instanceof Error ? error.message : String(error)}`);
    return this.priceCache.price || 0;
  }
}
```

