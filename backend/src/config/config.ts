import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  app: {
    env: string;
    port: number;
    apiSecret: string;
  };
  database: {
    url: string;
  };
  solana: {
    rpcEndpoints: string[];
    tokenInfo: {
      COLLAT: {
        symbol: string;
        address: string;
        decimals: number;
      };
      USDC: {
        symbol: string;
        address: string;
        decimals: number;
      };
    };
  };
  wallet: {
    privateKey: string;
  };
  trading: {
    sellThreshold: number;
    buyThreshold: number;
    slippageTolerance: number;
    maxTransactionPercentage: number;
  };
  api: {
    callIntervalMs: number;
    maxCallsPerDay: number;
  };
  notifications: {
    telegram: {
      botToken: string;
      chatId: string;
    };
    email: {
      service: string;
      user: string;
      password: string;
      notificationEmail: string;
    };
  };
}

// Token addresses
const COLLAT_ADDRESS = 'C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ';
const USDC_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Configuration object
const config: Config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    apiSecret: process.env.API_SECRET || 'default_secret_key_change_in_production',
  },
  database: {
    // Use SQLite by default to match Prisma schema
    url:
      process.env.DATABASE_URL ||
      `file:${path.resolve(__dirname, '../data/collat_bot.db')}`,
  },
  solana: {
    rpcEndpoints: [
      process.env.PRIMARY_RPC_ENDPOINT || 'https://kamel-solanam-876d.mainnet.rpcpool.com',
      process.env.SECONDARY_RPC_ENDPOINT || 'https://rpc.triton.one',
    ],
    tokenInfo: {
      COLLAT: {
        symbol: 'COLLAT',
        address: COLLAT_ADDRESS,
        decimals: 6,
      },
      USDC: {
        symbol: 'USDC',
        address: USDC_ADDRESS,
        decimals: 6,
      },
    },
  },
  wallet: {
    privateKey: process.env.WALLET_PRIVATE_KEY || '',
  },
  trading: {
    sellThreshold: parseFloat(process.env.SELL_THRESHOLD || '10'),
    buyThreshold: parseFloat(process.env.BUY_THRESHOLD || '5'),
    slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '1.5'),
    maxTransactionPercentage: parseFloat(process.env.MAX_TRANSACTION_PERCENTAGE || '50'),
  },
  api: {
    callIntervalMs: parseInt(process.env.API_CALL_INTERVAL_MS || '1000', 10),
    maxCallsPerDay: parseInt(process.env.MAX_API_CALLS_PER_DAY || String(Number.MAX_SAFE_INTEGER), 10),
  },
  notifications: {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
    },
    email: {
      service: process.env.EMAIL_SERVICE || '',
      user: process.env.EMAIL_USER || '',
      password: process.env.EMAIL_PASSWORD || '',
      notificationEmail: process.env.NOTIFICATION_EMAIL || '',
    },
  },
};

// Validate critical configuration
if (config.app.env === 'production') {
  if (!process.env.API_SECRET || process.env.API_SECRET === 'your_api_secret_key_here') {
    throw new Error('API_SECRET must be set in production environment');
  }
  
  if (!process.env.WALLET_PRIVATE_KEY) {
    throw new Error('WALLET_PRIVATE_KEY must be set in production environment');
  }
  
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('username:password')) {
    throw new Error('Valid DATABASE_URL must be set in production environment');
  }
}

export default config;
