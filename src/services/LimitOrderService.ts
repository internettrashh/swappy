import { LimitOrder, ILimitOrder } from '../models/LimitOrder';
import { UserBalance } from '../models/UserBalance';
import { PriceService } from './PriceService'; // Assuming you have a service to get token prices

export class LimitOrderService {
  private priceService: PriceService;
  
  constructor() {
    this.priceService = new PriceService();
  }

  // Create a pending limit order
  async createPendingOrder(orderData: Partial<ILimitOrder>): Promise<ILimitOrder> {
    const limitOrder = new LimitOrder({
      ...orderData,
      status: 'pending'
    });
    
    return await limitOrder.save();
  }

  // Activate a limit order after deposit is confirmed
  async activateOrder(orderId: string, depositTxHash: string): Promise<ILimitOrder | null> {
    try {
      const order = await LimitOrder.findById(orderId);
      
      if (!order || order.status !== 'pending') {
        throw new Error('Order not found or not in pending status');
      }
      
      // Get token symbol (you might need to implement this)
      const tokenSymbol = "TOKEN"; // Replace with actual token symbol lookup
      
      // Convert amount to string for UserBalance
      const amountString = order.amount.toString();
      
      // Create or update the UserBalance record
      await UserBalance.findOneAndUpdate(
        { 
          userId: order.userId,
          tokenAddress: order.sourceToken
        },
        { 
          $setOnInsert: {
            userWalletAddress: order.userWalletAddress,
            tokenSymbol: tokenSymbol, // Set a valid token symbol
            totalBalance: amountString,
            availableBalance: "0",
            lockedBalance: amountString,
            swappedBalance: "0"
          }
        },
        { upsert: true, new: true }
      );
      
      // Update order status
      order.status = 'active';
      order.depositTxHash = depositTxHash;
      await order.save();
      
      return order;
    } catch (error) {
      console.error("Error activating order:", error);
      throw error; // Re-throw to be caught by the API route
    }
  }

  // Cancel a limit order
  async cancelLimitOrder(orderId: string): Promise<boolean> {
    const order = await LimitOrder.findById(orderId);
    
    if (!order || order.status !== 'active') {
      return false;
    }
    
    // Update order status
    order.status = 'cancelled';
    await order.save();
    
    // Return locked funds to available balance
    await UserBalance.findOneAndUpdate(
      { 
        userId: order.userId,
        tokenAddress: order.sourceToken
      },
      { 
        $inc: { 
          lockedBalance: (-order.amount).toString(),
          availableBalance: order.amount.toString()
        }
      }
    );
    
    return true;
  }

  // Execute a limit order when price condition is met
  async executeLimitOrder(orderId: string, currentPrice: number, txHash: string): Promise<ILimitOrder | null> {
    const order = await LimitOrder.findById(orderId);
    
    if (!order || order.status !== 'active') {
      return null;
    }
    
    // Check if price condition is met
    if (
      (order.direction === 'above' && currentPrice >= order.targetPrice) ||
      (order.direction === 'below' && currentPrice <= order.targetPrice)
    ) {
      // Update order status
      order.status = 'executed';
      order.executedTrade = {
        amount: order.amount,
        price: currentPrice,
        timestamp: new Date(),
        txHash
      };
      
      // Move funds from locked to swapped
      await UserBalance.findOneAndUpdate(
        { 
          userId: order.userId,
          tokenAddress: order.sourceToken
        },
        { 
          $inc: { 
            lockedBalance: (-order.amount).toString()
          }
        }
      );
      
      // Add the swapped tokens to user balance
      const receivedAmount = order.amount / currentPrice;
      await UserBalance.findOneAndUpdate(
        { 
          userId: order.userId,
          tokenAddress: order.targetToken
        },
        { 
          $inc: { 
            swappedBalance: receivedAmount.toString(),
            totalBalance: receivedAmount.toString()
          }
        },
        { upsert: true }
      );
      
      return await order.save();
    }
    
    return null;
  }

  // Get all limit orders for a user
  async getUserLimitOrders(userId: string): Promise<ILimitOrder[]> {
    return await LimitOrder.find({ userId });
  }

  // Get limit order by ID
  async getLimitOrder(orderId: string): Promise<ILimitOrder | null> {
    return await LimitOrder.findById(orderId);
  }

  // Method to check and process all active limit orders
  async checkAndProcessLimitOrders(): Promise<void> {
    const activeOrders = await LimitOrder.find({ status: 'active' });
    
    for (const order of activeOrders) {
      try {
        // Check if order has expired
        if (order.expiryDate && new Date() > order.expiryDate) {
          await this.cancelLimitOrder(order._id);
          continue;
        }
        
        // Get current price for the token pair
        const currentPrice = await this.priceService.getTokenPrice(
          order.sourceToken,
          order.targetToken
        );
        
        // Check if order should be executed
        if (
          (order.direction === 'above' && currentPrice >= order.targetPrice) ||
          (order.direction === 'below' && currentPrice <= order.targetPrice)
        ) {
          // In a real implementation, you would:
          // 1. Execute the trade on an exchange
          // 2. Get the transaction hash
          const mockTxHash = `tx_${Date.now()}`;
          await this.executeLimitOrder(order._id, currentPrice, mockTxHash);
        }
      } catch (error) {
        console.error(`Error processing limit order ${order._id}:`, error);
      }
    }
  }

  // Add this method to LimitOrderService class
  async getOrdersByWalletAddress(walletAddress: string): Promise<ILimitOrder[]> {
    return await LimitOrder.find({ 
      userWalletAddress: walletAddress 
    });
  }
} 