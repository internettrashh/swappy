import { SwapService } from './SwapService';
import { DCAOrder, IDCAOrder } from '../models/DCAOrder';
import { BalanceService } from './BalanceService';
import { UserBalance } from '../models/UserBalance';
import { dcaQueue } from './Queueservice';

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
        this.handleCompletedOrder(order);
      }

      await order.save();
      return true;
    } catch (error) {
      console.error('DCA trade execution failed:', error);
      return false;
    }
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
    // Handle any remaining dust amounts or final state updates
    // For completed orders, we may want to unlock any remaining tokens
    if (order.remainingAmount > 0) {
      await this.refundUnswappedTokens(order);
    }
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
} 