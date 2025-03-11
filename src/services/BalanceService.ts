import { parseUnits, formatUnits } from 'ethers';
import { UserBalance, IUserBalance } from '../models/UserBalance';
import { DCAOrder, IDCAOrder } from '../models/DCAOrder';

export class BalanceService {
  async recordDeposit(
    userId: string,
    userWalletAddress: string,
    tokenAddress: string,
    tokenSymbol: string,
    amount: string,
    txHash: string
  ): Promise<IUserBalance> {
    // Convert string amount to number for MongoDB operations
    const amountNumber = Number(amount);
    
    const balance = await UserBalance.findOneAndUpdate(
      { userId, tokenAddress },
      {
        $setOnInsert: {
          userWalletAddress,
          tokenSymbol,
        },
        $inc: {
          totalBalance: amountNumber,
          availableBalance: amountNumber
        },
        $push: {
          transactions: {
            type: 'DEPOSIT',
            amount,
            txHash,
            timestamp: new Date()
          }
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    return balance;
  }

  async lockTokensForDCA(
    userId: string,
    tokenAddress: string,
    amount: string,
    dcaOrderId: string
  ): Promise<boolean> {
    // Convert string amount to number for MongoDB operations
    const amountNumber = Number(amount);
    
    const result = await UserBalance.findOneAndUpdate(
      { 
        userId, 
        tokenAddress,
        availableBalance: { $gte: amountNumber } // Check if enough available balance
      },
      {
        $inc: {
          availableBalance: -amountNumber,
          lockedBalance: amountNumber
        },
        $push: {
          transactions: {
            type: 'LOCK',
            amount,
            dcaOrderId,
            timestamp: new Date()
          }
        }
      }
    );

    return !!result; // Return true if update was successful
  }

  async recordSwap(
    order: IDCAOrder,
    sourceAmount: string,
    targetAmount: string,
    txHash: string,
    swapPrice: string
  ): Promise<void> {
    try {
      console.log('Recording swap with amounts:', {
        sourceAmount,
        targetAmount
      });

      // First, get the current balances
      const sourceBalance = await UserBalance.findOne({ 
        userId: order.userId, 
        tokenAddress: order.sourceToken 
      });
      
      const targetBalance = await UserBalance.findOne({ 
        userId: order.userId, 
        tokenAddress: order.targetToken 
      }) || {
        userId: order.userId,
        tokenAddress: order.targetToken,
        totalBalance: '0',
        availableBalance: '0',
        lockedBalance: '0',
        swappedBalance: '0',
        transactions: []
      };
      
      // Calculate new balances using BigInt to handle large numbers
      const currentLockedBalance = BigInt(sourceBalance?.lockedBalance || '0');
      const sourceAmountBigInt = BigInt(sourceAmount);
      const newLockedBalance = (currentLockedBalance - sourceAmountBigInt).toString();
      
      const currentSwappedBalance = BigInt(targetBalance.swappedBalance || '0');
      const currentTotalBalance = BigInt(targetBalance.totalBalance || '0');
      const targetAmountBigInt = BigInt(targetAmount);
      const newSwappedBalance = (currentSwappedBalance + targetAmountBigInt).toString();
      const newTotalBalance = (currentTotalBalance + targetAmountBigInt).toString();
      
      // Update source token balance with the new calculated value
      await UserBalance.findOneAndUpdate(
        { userId: order.userId, tokenAddress: order.sourceToken },
        { 
          $set: { lockedBalance: newLockedBalance },
          $push: {
            transactions: {
              type: 'SWAP_OUT',
              amount: sourceAmount,
              txHash,
              timestamp: new Date(),
              dcaOrderId: order._id,
              swapPrice
            }
          }
        },
        { upsert: true }
      );

      // Update target token balance with the new calculated value
      await UserBalance.findOneAndUpdate(
        { userId: order.userId, tokenAddress: order.targetToken },
        { 
          $set: { 
            swappedBalance: newSwappedBalance,
            totalBalance: newTotalBalance
          },
          $push: {
            transactions: {
              type: 'SWAP_IN',
              amount: targetAmount,
              txHash,
              timestamp: new Date(),
              dcaOrderId: order._id,
              swapPrice
            }
          }
        },
        { upsert: true }
      );
      
      console.log('Swap recorded successfully');
    } catch (error) {
      console.error('Error recording swap:', error);
      throw error;
    }
  }

  async getUserPortfolio(userId: string): Promise<any> {
    const balances = await UserBalance.find({ userId });
    
    return {
      balances: balances.map(balance => ({
        token: balance.tokenSymbol,
        tokenAddress: balance.tokenAddress,
        totalBalance: balance.totalBalance,
        availableBalance: balance.availableBalance,
        lockedInDCA: balance.lockedBalance,
        swappedFromDCA: balance.swappedBalance,
        details: {
          originalDeposits: balance.totalBalance,
          pendingSwaps: balance.lockedBalance,
          receivedFromSwaps: balance.swappedBalance
        }
      })),
      dcaOrders: await this.getDCAOrdersStatus(userId)
    };
  }

  async getDCAOrdersStatus(userId: string): Promise<any[]> {
    const orders = await DCAOrder.find({ userId });
    
    const orderDetails = await Promise.all(orders.map(async order => {
      const sourceBalance = await UserBalance.findOne({
        userId,
        tokenAddress: order.sourceToken
      });

      const targetBalance = await UserBalance.findOne({
        userId,
        tokenAddress: order.targetToken
      });

      return {
        orderId: order._id,
        status: order.status,
        sourceToken: {
          symbol: sourceBalance?.tokenSymbol,
          originalAmount: order.totalAmount,
          remainingToSwap: order.remainingAmount,
          alreadySwapped: order.totalAmount - order.remainingAmount
        },
        targetToken: {
          symbol: targetBalance?.tokenSymbol,
          receivedAmount: targetBalance?.swappedBalance || '0',
          averageSwapPrice: this.calculateAverageSwapPrice(order.executedTrades)
        },
        progress: {
          completedSwaps: order.executedTrades.length,
          totalSwaps: Math.ceil(order.totalAmount / order.amountPerTrade),
          percentageComplete: ((order.totalAmount - order.remainingAmount) / order.totalAmount) * 100
        }
      };
    }));

    return orderDetails;
  }

  private calculateAverageSwapPrice(trades: any[]): string {
    if (trades.length === 0) return '0';
    
    const totalPrice = trades.reduce((sum, trade) => sum + Number(trade.price), 0);
    return (totalPrice / trades.length).toString();
  }

  private async getTokenSymbol(tokenAddress: string): Promise<string> {
    // Implement token symbol lookup using ethers
    // Cache results to minimize RPC calls
    return 'TOKEN'; // Placeholder
  }
} 