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
    const balance = await UserBalance.findOneAndUpdate(
      { userId, tokenAddress },
      {
        $setOnInsert: {
          userWalletAddress,
          tokenSymbol,
        },
        $inc: {
          balance: amount
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
    const balance = await UserBalance.findOne({ userId, tokenAddress });
    if (!balance) return false;

    const availableBalance = BigInt(balance.availableBalance);
    const amountBigInt = BigInt(amount);

    if (availableBalance < amountBigInt) {
      return false;
    }

    balance.lockedBalance = (BigInt(balance.lockedBalance) + amountBigInt).toString();
    balance.availableBalance = (availableBalance - amountBigInt).toString();

    await balance.save();
    return true;
  }

  async recordSwap(
    dcaOrder: IDCAOrder,
    sourceAmount: string,
    targetAmount: string,
    txHash: string,
    swapPrice: string
  ): Promise<void> {
    // Update source token balance
    await UserBalance.findOneAndUpdate(
      { userId: dcaOrder.userId, tokenAddress: dcaOrder.sourceToken },
      {
        $inc: {
          lockedBalance: `-${sourceAmount}`
        },
        $push: {
          transactions: {
            type: 'SWAP_OUT',
            amount: sourceAmount,
            txHash,
            timestamp: new Date(),
            dcaOrderId: dcaOrder._id,
            swapPrice
          }
        }
      }
    );

    // Update target token balance
    await UserBalance.findOneAndUpdate(
      { 
        userId: dcaOrder.userId, 
        tokenAddress: dcaOrder.targetToken 
      },
      {
        $setOnInsert: {
          userWalletAddress: dcaOrder.userWalletAddress,
          tokenSymbol: await this.getTokenSymbol(dcaOrder.targetToken),
          totalBalance: '0',
          availableBalance: '0'
        },
        $inc: {
          swappedBalance: targetAmount,
          totalBalance: targetAmount
        },
        $push: {
          transactions: {
            type: 'SWAP_IN',
            amount: targetAmount,
            txHash,
            timestamp: new Date(),
            dcaOrderId: dcaOrder._id,
            swapPrice
          }
        }
      },
      { upsert: true }
    );
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