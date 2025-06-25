const config = {
  // API configuration
  apiHost: 'localhost',
  apiPort: 3001,
  
  // Tokens
  tokens: {
    COLLAT: 'C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    Pool: 'BtxxZetfDCpBfFJ4QVXh853BhzD4RgRKpwCXxzq1QmSM'
  },
  
  // Trading settings
  trading: {
    defaultSellThreshold: 10,
    defaultBuyThreshold: 5,
    defaultSlippageTolerance: 1.5,
    defaultMaxTransactionPercentage: 50
  },
  
  // Notification settings
  notifications: {
    desktopEnabled: true,
    emailEnabled: false,
    telegramEnabled: false
  }
};

export default config;
