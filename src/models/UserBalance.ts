import mongoose, { Schema, Document } from 'mongoose';

export interface IUserBalance extends Document {
  userId: string;
  userWalletAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  totalBalance: string;      // Total tokens deposited
  availableBalance: string;  // Tokens free to use
  lockedBalance: string;     // Source tokens reserved for DCA but not yet swapped
  swappedBalance: string;    // Tokens received from swaps
  lastUpdated: Date;
  transactions: Array<{
    type: 'DEPOSIT' | 'SWAP_IN' | 'SWAP_OUT' | 'WITHDRAWAL';
    amount: string;
    txHash: string;
    timestamp: Date;
    dcaOrderId?: string;
    swapPrice?: string;      // Price at which swap occurred
  }>;
}

const UserBalanceSchema: Schema = new Schema({
  userId: { type: String, required: true },
  userWalletAddress: { type: String, required: true },
  tokenAddress: { type: String, required: true },
  tokenSymbol: { type: String, required: true },
  totalBalance: { type: String, required: true },
  availableBalance: { type: String, required: true },
  lockedBalance: { type: String, default: '0' },    // Unswapped tokens in DCA
  swappedBalance: { type: String, default: '0' },   // Received tokens from swaps
  lastUpdated: { type: Date, default: Date.now },
  transactions: [{
    type: { type: String, required: true },
    amount: { type: String, required: true },
    txHash: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    dcaOrderId: { type: Schema.Types.ObjectId, ref: 'DCAOrder' },
    swapPrice: { type: String }
  }]
});

// Compound index for quick lookups
UserBalanceSchema.index({ userId: 1, tokenAddress: 1 }, { unique: true });

export const UserBalance = mongoose.model<IUserBalance>('UserBalance', UserBalanceSchema); 