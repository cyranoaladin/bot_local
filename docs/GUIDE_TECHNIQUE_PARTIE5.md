# Guide Technique du Bot de Trading $COLLAT - Partie 5 : Sécurité et Gestion des Portefeuilles

## 6. Sécurité et gestion des portefeuilles

## 6.1 Architecture de sécurité

Le bot $COLLAT implémente une architecture de sécurité multicouche pour protéger les fonds des utilisateurs et les informations sensibles :

### 6.1.1 Principes fondamentaux

1. **Chiffrement des clés privées** : Les phrases de récupération (seed phrases) ne sont jamais stockées en clair
2. **Authentification à deux facteurs** : Protection de l'accès à l'interface d'administration
3. **Verrouillage automatique** : Verrouillage du portefeuille après une période d'inactivité
4. **Isolation des composants** : Séparation claire entre les composants manipulant les clés privées et le reste de l'application
5. **Audit des accès** : Journalisation de toutes les actions sensibles

## 6.2 Gestion des clés privées

### 6.2.1 Importation et stockage sécurisé

```typescript
public async importWallet(seedPhrase: string, masterPassword: string): Promise<boolean> {
  try {
    // Valider la phrase de récupération
    if (!this.validateSeedPhrase(seedPhrase)) {
      throw new Error('Invalid seed phrase');
    }
    
    // Générer un sel aléatoire
    const salt = crypto.randomBytes(16).toString('hex');
    
    // Dériver une clé de chiffrement à partir du mot de passe maître
    const key = await this.deriveKey(masterPassword, salt);
    
    // Chiffrer la phrase de récupération
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encryptedSeed = cipher.update(seedPhrase, 'utf8', 'hex');
    encryptedSeed += cipher.final('hex');
    
    // Obtenir le tag d'authentification
    const authTag = cipher.getAuthTag();
    
    // Stocker les informations chiffrées dans la base de données
    await prisma.walletInfo.upsert({
      where: { id: 1 },
      update: {
        encryptedSeed: JSON.stringify({
          cipher: encryptedSeed,
          iv: iv.toString('hex'),
          authTag: authTag.toString('hex'),
          salt
        }),
        isConfigured: true
      },
      create: {
        id: 1,
        encryptedSeed: JSON.stringify({
          cipher: encryptedSeed,
          iv: iv.toString('hex'),
          authTag: authTag.toString('hex'),
          salt
        }),
        isConfigured: true
      }
    });
    
    // Initialiser le portefeuille en mémoire (sans stocker la clé privée)
    this.initializeWallet(seedPhrase);
    
    return true;
  } catch (error) {
    logger.error(`Failed to import wallet: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
```

### 6.2.2 Déverrouillage du portefeuille

```typescript
public async unlockWallet(masterPassword: string): Promise<boolean> {
  try {
    // Récupérer les informations chiffrées
    const walletInfo = await prisma.walletInfo.findFirst();
    if (!walletInfo || !walletInfo.encryptedSeed) {
      throw new Error('Wallet not configured');
    }
    
    // Parser les données chiffrées
    const encryptedData = JSON.parse(walletInfo.encryptedSeed);
    const { cipher, iv, authTag, salt } = encryptedData;
    
    // Dériver la clé de chiffrement
    const key = await this.deriveKey(masterPassword, salt);
    
    // Déchiffrer la phrase de récupération
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(cipher, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Initialiser le portefeuille en mémoire
    this.initializeWallet(decrypted);
    
    // Marquer le portefeuille comme déverrouillé
    this.unlocked = true;
    
    // Configurer le verrouillage automatique
    this.setupAutoLock();
    
    return true;
  } catch (error) {
    logger.error(`Failed to unlock wallet: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
```

### 6.2.3 Verrouillage automatique

```typescript
private setupAutoLock(): void {
  // Effacer le timer existant s'il y en a un
  if (this.autoLockTimer) {
    clearTimeout(this.autoLockTimer);
  }
  
  // Configurer un nouveau timer (30 minutes par défaut)
  this.autoLockTimer = setTimeout(() => {
    this.lockWallet();
    logger.info('Wallet auto-locked due to inactivity');
  }, this.autoLockTimeout);
}

public lockWallet(): void {
  // Effacer les données sensibles de la mémoire
  this.wallet = null;
  this.keyPair = null;
  this.unlocked = false;
  
  // Effacer le timer de verrouillage automatique
  if (this.autoLockTimer) {
    clearTimeout(this.autoLockTimer);
    this.autoLockTimer = null;
  }
  
  logger.info('Wallet locked');
}
```

## 6.3 Sécurité des transactions

### 6.3.1 Validation des transactions

```typescript
public async validateAndSignTransaction(transaction: Transaction): Promise<Transaction> {
  // Vérifier si le portefeuille est déverrouillé
  if (!this.isUnlocked() || !this.keyPair) {
    throw new Error('Wallet is locked');
  }
  
  // Vérifier le solde pour les frais de transaction
  const solBalance = await this.getSolBalance();
  if (solBalance < 0.001) { // Minimum pour les frais
    throw new Error('Insufficient SOL for transaction fees');
  }
  
  // Vérifier les instructions de la transaction
  for (const instruction of transaction.instructions) {
    // Vérifier si l'instruction est autorisée
    if (!this.isInstructionAllowed(instruction)) {
      throw new Error('Unauthorized transaction instruction');
    }
  }
  
  // Signer la transaction
  transaction.feePayer = this.wallet?.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.sign(this.keyPair);
  
  return transaction;
}
```

### 6.3.2 Limites de transaction

```typescript
private async enforceTransactionLimits(
  direction: SwapDirection,
  amount: number
): Promise<number> {
  // Récupérer les limites configurées
  const config = await prisma.configuration.findFirst();
  if (!config) throw new Error('Configuration not found');
  
  // Récupérer les soldes actuels
  const balances = await this.getBalances();
  
  // Calculer le montant maximum autorisé
  const maxAmount = direction === SwapDirection.BUY
    ? balances.usdc * (config.maxTransactionPercentage / 100)
    : balances.collat * (config.maxTransactionPercentage / 100);
  
  // Appliquer la limite quotidienne
  const dailyLimit = direction === SwapDirection.BUY
    ? config.dailyBuyLimit
    : config.dailySellLimit;
  
  // Calculer le total des transactions de la journée
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyTransactions = await prisma.transaction.findMany({
    where: {
      type: direction,
      timestamp: {
        gte: today
      },
      status: 'SUCCESS'
    }
  });
  
  const dailyTotal = dailyTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const remainingDaily = Math.max(0, dailyLimit - dailyTotal);
  
  // Retourner le montant limité
  return Math.min(amount, maxAmount, remainingDaily);
}
```

## 6.4 Authentification et autorisation

### 6.4.1 Système d'authentification

```typescript
// Service d'authentification
class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  
  constructor() {
    this.jwtSecret = config.jwtSecret;
    this.jwtExpiresIn = config.jwtExpiresIn;
  }
  
  public async authenticate(masterPassword: string): Promise<string | null> {
    try {
      // Vérifier si le mot de passe permet de déverrouiller le portefeuille
      const unlocked = await walletService.unlockWallet(masterPassword);
      
      if (!unlocked) {
        return null;
      }
      
      // Générer un token JWT
      const token = jwt.sign(
        { authorized: true },
        this.jwtSecret,
        { expiresIn: this.jwtExpiresIn }
      );
      
      return token;
    } catch (error) {
      logger.error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  public verifyToken(token: string): boolean {
    try {
      jwt.verify(token, this.jwtSecret);
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

### 6.4.2 Middleware d'autorisation

```typescript
// Middleware d'authentification
const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }
  
  try {
    const verified = jwt.verify(token, config.jwtSecret);
    req.user = verified;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Application du middleware aux routes protégées
app.use('/api/wallet', authenticateJWT);
app.use('/api/bot', authenticateJWT);
app.use('/api/config', authenticateJWT);
```

## 6.5 Audit et journalisation

### 6.5.1 Journalisation des événements de sécurité

```typescript
// Logger de sécurité
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, metadata }) => {
      return `${timestamp} ${level}: ${message} ${metadata ? JSON.stringify(metadata) : ''}`;
    })
  ),
  defaultMeta: { service: 'security' },
  transports: [
    new winston.transports.File({ filename: 'logs/security.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Fonction pour enregistrer les événements de sécurité
function logSecurityEvent(event: string, details: any): void {
  securityLogger.info(event, { metadata: details });
  
  // Stocker également dans la base de données
  prisma.securityLog.create({
    data: {
      event,
      details: JSON.stringify(details),
      timestamp: new Date()
    }
  }).catch(error => {
    logger.error(`Failed to log security event to database: ${error instanceof Error ? error.message : String(error)}`);
  });
}
```

### 6.5.2 Détection des activités suspectes

```typescript
// Détection des tentatives de connexion échouées
let failedLoginAttempts = new Map<string, { count: number, lastAttempt: number }>();

// Middleware pour détecter les tentatives de connexion échouées
const detectBruteForce = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  
  // Réinitialiser les tentatives après 24 heures
  const now = Date.now();
  const resetTime = 24 * 60 * 60 * 1000; // 24 heures
  
  // Nettoyer les anciennes entrées
  for (const [storedIp, data] of failedLoginAttempts.entries()) {
    if (now - data.lastAttempt > resetTime) {
      failedLoginAttempts.delete(storedIp);
    }
  }
  
  // Vérifier si l'IP est bloquée
  const attempts = failedLoginAttempts.get(ip);
  if (attempts && attempts.count >= 5) {
    // Bloquer après 5 tentatives échouées
    logSecurityEvent('brute_force_blocked', { ip });
    return res.status(429).json({ error: 'Too many failed attempts' });
  }
  
  next();
};

// Mise à jour des tentatives échouées
const recordFailedLogin = (ip: string): void => {
  const attempts = failedLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count += 1;
  attempts.lastAttempt = Date.now();
  failedLoginAttempts.set(ip, attempts);
  
  logSecurityEvent('failed_login', { ip, attempts: attempts.count });
};
```

## 6.6 Protection contre les attaques

### 6.6.1 Protection CORS

```typescript
// Configuration CORS
const corsOptions = {
  origin: [
    'http://localhost:3002',
    'http://192.168.1.16:3002',
    'http://0.0.0.0:3002'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
```

### 6.6.2 Protection contre les attaques XSS et CSRF

```typescript
// Configuration Helmet pour la sécurité HTTP
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Protection contre les attaques CSRF
app.use(csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));
```

### 6.6.3 Limitation de débit

```typescript
// Limitation de débit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  standardHeaders: true,
  legacyHeaders: false
});

// Appliquer la limitation à toutes les routes
app.use(limiter);

// Limitation plus stricte pour les routes sensibles
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 requêtes par IP
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/auth', authLimiter);
app.use('/api/wallet', authLimiter);
```
