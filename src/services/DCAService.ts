import { SwapService } from './SwapService';
import { DCAOrder, IDCAOrder } from '../models/DCAOrder';
import { BalanceService } from './BalanceService';
import { UserBalance } from '../models/UserBalance';
import { dcaQueue } from './Queueservice';
import { WalletService } from './WalletService';

export class DCAService {
  private swapService: SwapService;
  private balanceService: BalanceService;

  constructor() {
    this.swapService = new SwapService();
    this.balanceService = new BalanceService();
  }

  async createPendingOrder(orderData: Partial<IDCAOrder>): Promise<IDCAOrder> {
    const newOrder = new DCAOrder({
      ...orderData,
      status: 'pending',
      remainingAmount: orderData.totalAmount,
      remainingSeconds: orderData.totalDurationSeconds,
      executedTrades: []
    });
    
    return await newOrder.save();
  }

  async getPendingOrder(orderId: string): Promise<IDCAOrder | null> {
    return await DCAOrder.findOne({ _id: orderId, status: 'pending' });
  }

  async activateOrder(orderId: string, depositTxHash: string): Promise<IDCAOrder> {
    const order = await DCAOrder.findById(orderId);
    if (!order || order.status !== 'pending') {
      throw new Error('Invalid order or order status');
    }

    order.status = 'active';
    await order.save();

    // Start DCA execution
    this.scheduleDCAExecution(order);

    return order;
  }

  private async scheduleDCAExecution(order: IDCAOrder) {
    // Calculate interval details
    const totalTrades = Math.ceil(order.totalAmount / order.amountPerTrade);
    const intervalSeconds = Math.floor(order.totalDurationSeconds / totalTrades);
    
    // Schedule the first job
    await dcaQueue.add(
      { orderId: order._id, intervalSeconds },
      { delay: 10000 }
    );
  }

  // New method to be called by the queue processor
  async processScheduledTrade(orderId: string, intervalSeconds: number): Promise<boolean> {
    const order = await DCAOrder.findById(orderId);
    if (!order || order.status !== 'active' || order.remainingAmount <= 0) {
      return false;
    }

    try {
      // Execute the trade
      const success = await this.executeDCATrade(orderId);
      
      if (success && order.remainingAmount > 0) {
        // Schedule the next trade using the provided interval
        await dcaQueue.add(
          { orderId, intervalSeconds },
          { delay: intervalSeconds * 1000 } // Convert to milliseconds
        );
        
        // Update remaining seconds
        const remainingSeconds = Math.max(0, order.remainingSeconds - intervalSeconds);
        await DCAOrder.findByIdAndUpdate(orderId, { remainingSeconds });
      }
      
      return success;
    } catch (error) {
      console.error(`Error processing scheduled trade for order ${orderId}:`, error);
      return false;
    }
  }

  async executeDCATrade(orderId: string): Promise<boolean> {
    const order = await DCAOrder.findById(orderId);
    if (!order || order.status !== 'active') return false;

    // Retry configuration
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 5000; // 5 seconds between retries
    let retryCount = 0;
    
    const executeSwapWithRetry = async (): Promise<boolean> => {
      try {
        // Calculate exact amounts
        const sourceAmount = order.amountPerTrade.toString();
        
        // Execute the swap
        const swapResult = await this.swapService.executeSwap(
          order.sourceToken,
          order.targetToken,
          BigInt(sourceAmount)
        );

        if (!swapResult.success) {
          throw new Error('Swap failed');
        }

        // Calculate target amount (this would come from the swap result)
        const targetAmount = (Number(sourceAmount) * (swapResult.price || 0)).toString();
        
        // Record the swap in user balances
        await this.balanceService.recordSwap(
          order,
          sourceAmount,
          targetAmount,
          swapResult.txHash || 'unknown',
          swapResult.price?.toString() || '0'
        );

        // Update order status
        order.executedTrades.push({
          amount: order.amountPerTrade,
          price: swapResult.price || 0,
          timestamp: new Date(),
          txHash: swapResult.txHash || 'unknown'
        });

        order.remainingAmount -= order.amountPerTrade;

        if (order.remainingAmount <= 0) {
          order.status = 'completed';
          // Handle any remaining dust amounts
          await this.handleCompletedOrder(order);
        }

        await order.save();
        return true;
      } catch (error) {
        // Check if we should retry
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`Swap attempt ${retryCount} failed, retrying in ${RETRY_DELAY_MS/1000} seconds...`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          
          // Retry the operation
          return executeSwapWithRetry();
        } else {
          console.error(`DCA trade execution failed after ${MAX_RETRIES} attempts:`, error);
          return false;
        }
      }
    };
    
    return executeSwapWithRetry();
  }

  async cancelDCAOrder(orderId: string): Promise<boolean> {
    const order = await DCAOrder.findById(orderId);
    if (!order || order.status !== 'active') return false;

    try {
      // Return unswapped tokens to user's available balance
      await this.refundUnswappedTokens(order);
      
      order.status = 'cancelled';
      await order.save();
      return true;
    } catch (error) {
      console.error('DCA order cancellation failed:', error);
      return false;
    }
  }

  private async refundUnswappedTokens(order: IDCAOrder): Promise<void> {
    // Move remaining tokens from locked to available in user's balance
    await UserBalance.findOneAndUpdate(
      { userId: order.userId, tokenAddress: order.sourceToken },
      {
        $inc: {
          lockedBalance: `-${order.remainingAmount}`,
          availableBalance: order.remainingAmount
        }
      }
    );
  }

  private async handleCompletedOrder(order: IDCAOrder): Promise<void> {
    try {
      // 1. Refund any remaining unswapped source tokens if there are any
      if (order.remainingAmount > 0) {
        await this.refundUnswappedTokens(order);
      }
      
      // 2. Calculate total swapped tokens (target tokens) received during the DCA process
      const targetTokenBalance = await this.getTargetTokenBalance(order.userId, order.targetToken);
      
      if (targetTokenBalance > 0) {
        // 3. Transfer the swapped tokens back to the user's wallet
        const walletService = new WalletService();
        const txHash = await walletService.transferTokensToUser(
          order.userWalletAddress,
          order.targetToken,
          targetTokenBalance
        );
        
        console.log(`Transferred ${targetTokenBalance} of target token ${order.targetToken} to user ${order.userWalletAddress}. Transaction: ${txHash}`);
        
        // 4. Update the user balance record to reflect the transfer
        await this.balanceService.recordWithdrawal(
          order.userId,
          order.userWalletAddress,
          order.targetToken,
          targetTokenBalance.toString(),
          txHash,
          order._id
        );
      }
      
      // 5. Update order to indicate tokens have been refunded
      order.tokensRefunded = true;
      await order.save();
      
    } catch (error) {
      console.error(`Error handling completed order ${order._id}:`, error);
      // You might want to add retry logic or notification system here
    }
  }

  // Helper method to get the target token balance for a user
  private async getTargetTokenBalance(userId: string, tokenAddress: string): Promise<number> {
    const balance = await UserBalance.findOne({
      userId,
      tokenAddress
    });
    
    return balance ? Number(balance.swappedBalance) : 0;
  }

  async getDCAProgress(orderId: string): Promise<any> {
    const order = await DCAOrder.findById(orderId);
    if (!order) throw new Error('Order not found');

    return {
      orderId: order._id,
      status: order.status,
      totalAmount: order.totalAmount,
      remainingAmount: order.remainingAmount,
      executedTrades: order.executedTrades,
      progress: ((order.totalAmount - order.remainingAmount) / order.totalAmount) * 100
    };
  }

  async getUserPortfolio(userId: string): Promise<any> {
    const orders = await DCAOrder.find({ userId });
    return {
      activeOrders: orders.filter(order => order.status === 'active'),
      completedOrders: orders.filter(order => order.status === 'completed'),
      cancelledOrders: orders.filter(order => order.status === 'cancelled'),
      totalInvested: orders.reduce((sum, order) => sum + (order.totalAmount - order.remainingAmount), 0)
    };
  }

  async getOrdersByWalletAddress(walletAddress: string): Promise<IDCAOrder[]> {
    return await DCAOrder.find({ 
      userWalletAddress: walletAddress 
    });
  }

  // Get order by ID regardless of status
  async getOrderById(orderId: string): Promise<IDCAOrder | null> {
    return await DCAOrder.findById(orderId);
  }

  // Withdraw funds and cancel order
  async withdrawAndCancelOrder(orderId: string): Promise<{
    success: boolean;
    txHash?: string;
    refundedAmount?: number;
    error?: string;
  }> {
    try {
      const order = await DCAOrder.findById(orderId);
      
      if (!order) {
        return { success: false, error: 'Order not found' };
      }
      
      // Check if order can be cancelled (not already completed or cancelled)
      if (order.status === 'completed' || order.status === 'cancelled') {
        return { 
          success: false, 
          error: `Order cannot be cancelled because it is already ${order.status}` 
        };
      }
      
      // Calculate the amount to refund
      const refundAmount = order.remainingAmount;
      
      if (refundAmount <= 0) {
        return { success: false, error: 'No funds available to withdraw' };
      }
      
      // Refund the remaining tokens to the user
      const walletService = new WalletService();
      const txHash = await walletService.refundRemainingTokens(
        order.userWalletAddress,
        order.sourceToken,
        refundAmount
      );
      
      // Update the order status to cancelled
      order.status = 'cancelled';
      await order.save();
      
      // Update user balance to reflect the withdrawal
      await this.balanceService.recordWithdrawal(
        order.userId,
        order.userWalletAddress,
        order.sourceToken,
        refundAmount.toString(),
        txHash,
        order._id
      );
      
      // Also check if there are any swapped tokens to refund
      const targetTokenBalance = await this.getTargetTokenBalance(order.userId, order.targetToken);
      
      if (targetTokenBalance > 0) {
        // Transfer the swapped tokens back to the user's wallet
        const targetTxHash = await walletService.transferTokensToUser(
          order.userWalletAddress,
          order.targetToken,
          targetTokenBalance
        );
        
        // Update the user balance record to reflect the transfer
        await this.balanceService.recordWithdrawal(
          order.userId,
          order.userWalletAddress,
          order.targetToken,
          targetTokenBalance.toString(),
          targetTxHash,
          order._id
        );
      }
      
      return {
        success: true,
        txHash,
        refundedAmount: refundAmount
      };
    } catch (error) {
      console.error('Error withdrawing and cancelling order:', error);
      return {
        success: false,
        error: (error as Error).message || 'Unknown error occurred'
      };
    }
  }
} 