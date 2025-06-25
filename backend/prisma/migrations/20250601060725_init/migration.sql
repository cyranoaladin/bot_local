-- CreateTable
CREATE TABLE "Configuration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sellThreshold" REAL NOT NULL DEFAULT 10.0,
    "buyThreshold" REAL NOT NULL DEFAULT 5.0,
    "slippageTolerance" REAL NOT NULL DEFAULT 1.5,
    "maxTransactionPercentage" REAL NOT NULL DEFAULT 50.0,
    "rpcEndpoints" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "tokenAmount" DECIMAL NOT NULL,
    "tokenPrice" DECIMAL NOT NULL,
    "usdcAmount" DECIMAL NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collatBalance" DECIMAL NOT NULL,
    "usdcBalance" DECIMAL NOT NULL,
    "solBalance" DECIMAL NOT NULL,
    "totalValueUsdc" DECIMAL NOT NULL,
    "profitLoss" DECIMAL
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BotState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "entryPrice" DECIMAL,
    "currentPrice" DECIMAL,
    "lastTransaction" DATETIME,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
