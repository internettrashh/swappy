import mongoose, { Schema, Document } from 'mongoose';

export interface IDCAOrder extends Document {
  userId: string;
  userWalletAddress: string;
  sourceToken: string;
  targetToken: string;
  totalAmount: number;
  amountPerTrade: number;
  totalDurationSeconds: number;  // Total duration in seconds
  tradeIntervalSeconds: number; // Add this field
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  executedTrades: Array<{
    amount: number;
    price: number;
    timestamp: Date;
    txHash: string;  // Added transaction hash
  }>;
  remainingAmount: number;
  remainingSeconds: number;    // Remaining time in seconds
  depositTxHash: string;     // Track the initial deposit transaction
}

const DCAOrderSchema: Schema = new Schema({
  userId: { type: String, required: true },
  userWalletAddress: { type: String, required: true },
  sourceToken: { type: String, required: true },
  targetToken: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  amountPerTrade: { type: Number, required: true },
  totalDurationSeconds: { type: Number, required: true },
  tradeIntervalSeconds: { type: Number, required: true, default: 60 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  status: { type: String, required: true, default: 'pending' },
  executedTrades: [{
    amount: { type: Number, required: true },
    price: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    txHash: { type: String, required: true }
  }],
  remainingAmount: { type: Number, required: true },
  remainingSeconds: { type: Number, required: true },
  depositTxHash: { type: String },
});

export const DCAOrder = mongoose.model<IDCAOrder>('DCAOrder', DCAOrderSchema);
