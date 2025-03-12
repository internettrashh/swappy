import mongoose, { Schema, Document } from 'mongoose';

export interface ILimitOrder extends Document {
  userId: string;
  userWalletAddress: string;
  sourceToken: string;
  targetToken: string;
  amount: number;              // Amount of source token to trade
  targetPrice: number;         // The price threshold that triggers the order
  direction: 'above' | 'below'; // Whether to execute when price goes above or below target
  status: 'pending' | 'active' | 'executed' | 'cancelled' | 'expired';
  createdAt: Date;
  expiryDate?: Date;           // Optional expiration date
  executedTrade?: {
    amount: number;
    price: number;
    timestamp: Date;
    txHash: string;
  };
  depositTxHash?: string;      // Transaction hash of initial deposit
}

const LimitOrderSchema: Schema = new Schema({
  userId: { type: String, required: true },
  userWalletAddress: { type: String, required: true },
  sourceToken: { type: String, required: true },
  targetToken: { type: String, required: true },
  amount: { type: Number, required: true },
  targetPrice: { type: Number, required: true },
  direction: { type: String, enum: ['above', 'below'], required: true },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'executed', 'cancelled', 'expired'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now },
  expiryDate: { type: Date },
  executedTrade: {
    amount: { type: Number },
    price: { type: Number },
    timestamp: { type: Date },
    txHash: { type: String }
  },
  depositTxHash: { type: String }
});

export const LimitOrder = mongoose.model<ILimitOrder>('LimitOrder', LimitOrderSchema); 