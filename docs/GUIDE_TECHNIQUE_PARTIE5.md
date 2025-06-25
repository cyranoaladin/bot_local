# Guide Technique du Bot de Trading $COLLAT - Partie 5 : Problèmes rencontrés et solutions


## 9. Problèmes rencontrés et solutions

### 9.1 Problèmes d'accès à l'API backend

#### 9.1.1 Erreur 500 sur `/api/bot/status`

**Problème** : L'endpoint `/api/bot/status` retournait systématiquement une erreur 500, empêchant le frontend de récupérer l'état du bot.

**Cause** : La méthode `getBotState()` dans `tradingService.ts` ne gérait pas correctement les erreurs lors des appels asynchrones (base de données, soldes, prix). Les exceptions non gérées étaient propagées jusqu'au contrôleur API, provoquant l'erreur 500.

**Solution** : Refactorisation complète de la méthode `getBotState()` pour gérer individuellement chaque source potentielle d'erreur et retourner des valeurs par défaut en cas d'échec :

```typescript
public async getBotState(): Promise<any> {
  try {
    // Récupérer l'état du bot depuis la base de données
    const botState = await prisma.botState.findFirst().catch((dbError: unknown) => {
      logger.error(`Database error when fetching bot state: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      return { isActive: false, lastPrice: 0, lastCheck: new Date() };
    }) || { isActive: false, lastPrice: 0, lastCheck: new Date() };

    // Vérifier si le portefeuille est configuré et déverrouillé
    let walletStatus = {
      isConfigured: false,
      isUnlocked: false
    };

    try {
      const walletInfo = await prisma.walletInfo.findFirst();
      walletStatus.isConfigured = walletInfo?.isConfigured || false;
      walletStatus.isUnlocked = walletService.isUnlocked();
    } catch (walletError: unknown) {
      logger.error(`Error checking wallet status: ${walletError instanceof Error ? walletError.message : String(walletError)}`);
    }

    // Récupérer les soldes (avec gestion des erreurs)
    let balances = {
      collat: 0,
      usdc: 0,
      sol: 0,
      totalValueUsdc: 0
    };

    if (walletStatus.isUnlocked) {
      try {
        balances.collat = await walletService.getTokenBalance(this.collatAddress);
      } catch (collatError: unknown) {
        logger.error(`Error getting COLLAT balance: ${collatError instanceof Error ? collatError.message : String(collatError)}`);
      }

      try {
        balances.usdc = await walletService.getTokenBalance(this.usdcAddress);
      } catch (usdcError: unknown) {
        logger.error(`Error getting USDC balance: ${usdcError instanceof Error ? usdcError.message : String(usdcError)}`);
      }

      try {
        balances.sol = await walletService.getSolBalance();
      } catch (solError: unknown) {
        logger.error(`Error getting SOL balance: ${solError instanceof Error ? solError.message : String(solError)}`);
      }
    }

    // Récupérer le prix actuel (avec gestion des erreurs)
    let currentPrice = 0;
    try {
      currentPrice = await this.getCurrentPrice();
    } catch (priceError: unknown) {
      logger.error(`Error getting current price: ${priceError instanceof Error ? priceError.message : String(priceError)}`);
    }

    // Calculer la valeur totale en USDC
    balances.totalValueUsdc = balances.usdc + (balances.collat * currentPrice);

    // Récupérer la configuration (avec gestion des erreurs)
    let config = {
      sellThreshold: 10,
      buyThreshold: 5,
      slippageTolerance: 1.5,
      maxTransactionPercentage: 50
    };

    try {
      const dbConfig = await prisma.configuration.findFirst();
      if (dbConfig) {
        config = {
          sellThreshold: dbConfig.sellThreshold,
          buyThreshold: dbConfig.buyThreshold,
          slippageTolerance: dbConfig.slippageTolerance,
          maxTransactionPercentage: dbConfig.maxTransactionPercentage
        };
      }
    } catch (configError: unknown) {
      logger.error(`Error getting configuration: ${configError instanceof Error ? configError.message : String(configError)}`);
    }

    // Récupérer les transactions récentes (avec gestion des erreurs)
    let recentTransactions = [];
    try {
      recentTransactions = await prisma.transaction.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10
      });
    } catch (txError: unknown) {
      logger.error(`Error getting recent transactions: ${txError instanceof Error ? txError.message : String(txError)}`);
    }

    // Construire et retourner l'état complet
    return {
      isRunning: botState.isActive,
      currentPrice,
      lastEntryPrice: this.lastEntryPrice,
      priceChange: this.calculatePriceChange(botState.lastPrice, currentPrice),
      balances,
      config,
      lastTransaction: recentTransactions[0] || null,
      walletStatus
    };
  } catch (error: unknown) {
    // Gestion des erreurs globales
    logger.error(`Failed to get bot state: ${error instanceof Error ? error.message : String(error)}`);
    
    // Retourner un état par défaut en cas d'erreur
    return {
      isRunning: false,
      currentPrice: 0,
      lastEntryPrice: 0,
      priceChange: 0,
      balances: { collat: 0, usdc: 0, sol: 0, totalValueUsdc: 0 },
      config: { sellThreshold: 10, buyThreshold: 5, slippageTolerance: 1.5, maxTransactionPercentage: 50 },
      lastTransaction: null,
      walletStatus: { isConfigured: false, isUnlocked: false }
    };
  }
}
```

### 9.2 Problèmes d'accès au frontend via réseau local

#### 9.2.1 Frontend inaccessible depuis l'adresse IP locale

**Problème** : Le frontend n'était pas accessible depuis d'autres appareils du réseau local via l'adresse IP 192.168.1.16:3002.

**Causes** :
1. Le serveur frontend n'était pas configuré pour écouter sur toutes les interfaces réseau
2. Le serveur frontend n'était pas démarré ou avait été arrêté

**Solution** : 
1. Démarrage du serveur frontend avec la configuration pour écouter sur toutes les interfaces réseau :
```bash
npx serve -s dist -l tcp://0.0.0.0:3002
```
2. Configuration de PM2 pour gérer le serveur frontend et assurer son redémarrage automatique :
```javascript
pm2 start --name collat-frontend -- npx serve -s dist -l tcp://0.0.0.0:3002
pm2 save
```

### 9.3 Problèmes de connexion au portefeuille Phantom

#### 9.3.1 Boucle infinie de connexion au portefeuille

**Problème** : Le frontend entrait dans une boucle infinie lors de la tentative de connexion au portefeuille Phantom, avec des erreurs CORS et des tentatives répétées de connexion.

**Causes** :
1. Configuration CORS incorrecte dans le backend, ne permettant pas les requêtes depuis l'adresse IP locale
2. URL de base de l'API incorrecte dans le frontend, utilisant `localhost` au lieu de l'adresse IP du serveur
3. Adaptateur Phantom non explicitement inclus dans la configuration du `WalletProvider`

**Solutions** :

1. Correction de la configuration CORS dans `app.ts` :
```typescript
// Configuration CORS correcte
app.use(cors({
  origin: [
    'http://localhost:3002',
    'http://192.168.1.16:3002',
    'http://0.0.0.0:3002'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

2. Modification de l'URL de base de l'API dans `apiClient.ts` pour utiliser dynamiquement l'adresse IP du serveur :
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  `http://${window.location.hostname}:3001/api`;
```

3. Inclusion explicite de l'adaptateur Phantom dans `WalletProvider.tsx` :
```typescript
const wallets = useMemo(() => [
  // Ajouter explicitement l'adaptateur Phantom
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
], []);
```

### 9.4 Problèmes de récupération des prix

#### 9.4.1 Échec de récupération du prix du token COLLAT

**Problème** : Le service de prix échouait parfois à récupérer le prix actuel du token COLLAT, causant des erreurs en cascade dans d'autres parties de l'application.

**Causes** :
1. Limites d'appels API des RPC Solana atteintes
2. Problèmes de connexion aux endpoints RPC
3. Absence de mécanisme de basculement entre différents endpoints RPC

**Solutions** :

1. Implémentation d'un système de cache pour les prix :
```typescript
private priceCache = {
  price: 0,
  timestamp: 0,
  ttl: 5 * 60 * 1000 // 5 minutes
};

private async getCachedOrFetchPrice(): Promise<number> {
  const now = Date.now();
  
  // Utiliser le cache si disponible et non expiré
  if (this.priceCache.price > 0 && now - this.priceCache.timestamp < this.priceCache.ttl) {
    return this.priceCache.price;
  }
  
  try {
    // Récupérer le prix frais
    const price = await this.fetchCurrentPrice();
    
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

2. Création d'une connexion résiliente avec basculement entre endpoints RPC :
```typescript
class ResilientConnection {
  private connections: Connection[] = [];
  private currentIndex = 0;
  
  constructor(endpoints: string[], commitment: Commitment = 'confirmed') {
    this.connections = endpoints.map(endpoint => new Connection(endpoint, commitment));
  }
  
  public getCurrentConnection(): Connection {
    return this.connections[this.currentIndex];
  }
  
  public async switchConnection(): Promise<Connection> {
    // Passer à l'endpoint suivant
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    logger.info(`Switched to RPC endpoint: ${this.currentIndex + 1}/${this.connections.length}`);
    
    return this.getCurrentConnection();
  }
}
```

### 9.5 Problèmes de gestion des erreurs

#### 9.5.1 Erreurs non gérées dans les appels asynchrones

**Problème** : De nombreuses parties du code ne géraient pas correctement les erreurs dans les appels asynchrones, causant des crashs ou des comportements inattendus.

**Cause** : Absence de blocs try/catch autour des appels asynchrones et absence de typage correct des erreurs.

**Solution** : Refactorisation systématique du code pour inclure une gestion des erreurs robuste :

```typescript
// Exemple de pattern de gestion des erreurs
public async someAsyncFunction(): Promise<ResultType> {
  try {
    // Code asynchrone...
    return result;
  } catch (error: unknown) {
    // Typage correct de l'erreur
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Operation failed: ${errorMessage}`);
    
    // Retourner une valeur par défaut ou relancer l'erreur selon le contexte
    return defaultValue; // ou throw new CustomError(errorMessage);
  }
}
```

### 9.6 Problèmes de configuration réseau

#### 9.6.1 Accès impossible au backend depuis le réseau local

**Problème** : Le backend n'était pas accessible depuis d'autres appareils du réseau local.

**Cause** : Le serveur Express était configuré pour écouter uniquement sur l'interface localhost (127.0.0.1).

**Solution** : Modification de la configuration du serveur pour écouter sur toutes les interfaces réseau :

```typescript
// Dans app.ts
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
});
```

### 9.7 Problèmes de déverrouillage du portefeuille

#### 9.7.1 Échec du déverrouillage du portefeuille

**Problème** : Le portefeuille ne pouvait pas être déverrouillé même avec le mot de passe correct.

**Causes** :
1. Erreurs dans le processus de déchiffrement de la phrase de récupération
2. Problèmes de format des données chiffrées stockées

**Solution** : Correction du processus de déchiffrement et amélioration de la validation des données :

```typescript
public async unlockWallet(masterPassword: string): Promise<boolean> {
  try {
    // Récupérer les informations chiffrées
    const walletInfo = await prisma.walletInfo.findFirst();
    if (!walletInfo || !walletInfo.encryptedSeed) {
      logger.error('Wallet not configured or encrypted seed missing');
      return false;
    }
    
    // Parser les données chiffrées avec validation
    let encryptedData;
    try {
      encryptedData = JSON.parse(walletInfo.encryptedSeed);
      
      // Valider la structure des données
      if (!encryptedData.cipher || !encryptedData.iv || !encryptedData.authTag || !encryptedData.salt) {
        throw new Error('Invalid encrypted data structure');
      }
    } catch (parseError) {
      logger.error(`Failed to parse encrypted data: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      return false;
    }
    
    const { cipher, iv, authTag, salt } = encryptedData;
    
    // Dériver la clé de chiffrement
    const key = await this.deriveKey(masterPassword, salt);
    
    // Déchiffrer la phrase de récupération avec gestion des erreurs
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(cipher, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Valider la phrase de récupération déchiffrée
      if (!this.validateSeedPhrase(decrypted)) {
        logger.error('Decrypted seed phrase is invalid');
        return false;
      }
      
      // Initialiser le portefeuille en mémoire
      this.initializeWallet(decrypted);
      
      // Marquer le portefeuille comme déverrouillé
      this.unlocked = true;
      
      // Configurer le verrouillage automatique
      this.setupAutoLock();
      
      logger.info('Wallet unlocked successfully');
      return true;
    } catch (decryptError) {
      logger.error(`Decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`);
      return false;
    }
  } catch (error) {
    logger.error(`Failed to unlock wallet: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
```

### 9.8 Problèmes de démarrage automatique

#### 9.8.1 Services ne démarrant pas automatiquement au redémarrage du système

**Problème** : Les services backend et frontend ne démarraient pas automatiquement après un redémarrage du système.

**Cause** : Configuration PM2 incomplète ou incorrecte.

**Solution** : Configuration correcte de PM2 pour le démarrage automatique :

```bash
# Configurer PM2 pour démarrer automatiquement au démarrage du système
pm2 startup

# Suivre les instructions affichées pour installer le script de démarrage

# Sauvegarder la configuration PM2 actuelle
pm2 save
```

### 9.9 Problèmes de performances

#### 9.9.1 Ralentissements et timeouts lors de l'exécution des swaps

**Problème** : L'exécution des swaps était parfois lente ou échouait avec des timeouts.

**Causes** :
1. Congestion du réseau Solana
2. Limites d'appels API des RPC atteintes
3. Absence de gestion des timeouts pour les transactions

**Solutions** :

1. Implémentation d'un système de retry avec backoff exponentiel :
```typescript
public async executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let retries = 0;
  let lastError: Error | null = null;
  
  while (retries < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Operation failed (retry ${retries + 1}/${maxRetries}): ${lastError.message}`);
      
      retries++;
      
      // Attendre avant de réessayer (backoff exponentiel)
      const delay = initialDelay * Math.pow(2, retries);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Operation failed after ${maxRetries} retries: ${lastError?.message}`);
}
```

2. Augmentation des timeouts pour les transactions :
```typescript
const confirmOptions = {
  commitment: 'confirmed',
  preflightCommitment: 'processed',
  maxRetries: 5,
  skipPreflight: false
};

const signature = await connection.sendTransaction(transaction, [this.keyPair], confirmOptions);

// Attendre la confirmation avec un timeout plus long
const confirmation = await connection.confirmTransaction({
  signature,
  blockhash: transaction.recentBlockhash!,
  lastValidBlockHeight: blockHeight + 150
}, 'confirmed');
```


