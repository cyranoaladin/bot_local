export const DEFAULT_CONFIG = {
  tokenAddress: "C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ", // $COLLAT
  stablecoin: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  sellThreshold: 5, // %
  buyThreshold: 3,  // %
  targetGain: 10,   // %
  slippage: 1.5     // %
};

export const TOKEN_INFO = {
  COLLAT: {
    symbol: "COLLAT",
    address: "C7heQqfNzdMbUFQwcHkL9FvdwsFsDRBnfwZDDyWYCLTZ",
    decimals: 6 // To be verified
  },
  USDC: {
    symbol: "USDC",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6
  }
};

export const TEST_WALLET = "FKxNTsxE83WwGSqLs7o6mWYPaZybZPFgKr3B7m7x2qxf";

export const RPC_ENDPOINTS = [
  "https://kamel-solanam-876d.mainnet.rpcpool.com",
  "https://rpc.triton.one"
];

export const PRIMARY_RPC_ENDPOINT = RPC_ENDPOINTS[0];
