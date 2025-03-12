// Configuration for the application
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'MASTER_WALLET_PRIVATE_KEY',
  'ZERO_EX_API_KEY',
  'MONGODB_URI'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`Warning: Environment variable ${envVar} is not set.`);
  }
}

export const config = {
  // MongoDB connection
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/swappy',
  
  // Wallet settings
  MASTER_WALLET_PRIVATE_KEY: process.env.MASTER_WALLET_PRIVATE_KEY || '',
  MASTER_WALLET_ADDRESS: process.env.MASTER_WALLET_ADDRESS || '',
  
  // API Keys
  ZERO_EX_API_KEY: process.env.ZERO_EX_API_KEY || '',
  
  // Blockchain settings
  RPC_URL: process.env.RPC_URL || 'https://testnet-rpc.monad.xyz',
  CHAIN_ID: 10143,  // Monad testnet
  
  // DCA settings
  MIN_DCA_INTERVAL_SECONDS: 3600,  // Minimum interval between DCA executions (1 hour)
  MAX_DCA_TRADES: 1000,            // Maximum number of trades for a single DCA order
  MIN_DCA_TRADES: 2,               // Minimum number of trades for a single DCA order
  
  // Server settings
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  OX_API_KEY: process.env.OX_API_KEY || '3a91c837-7567-4778-92f0-a5e14d7f2313', // Use env variable in production!
  DEFAULT_TAKER_ADDRESS: process.env.DEFAULT_TAKER_ADDRESS || '0x0000000000000000000000000000000000000000'
}; 