import express from 'express';
import { DCAService } from '../services/DCAService';
import { BalanceService } from '../services/BalanceService';
import { LimitOrderService } from '../services/LimitOrderService';
import cron from 'node-cron';

const router = express.Router();
const dcaService = new DCAService();
const balanceService = new BalanceService();
const limitOrderService = new LimitOrderService();

// Create new DCA order
router.post('/dca/order', async (req, res) => {
  try {
    const {
      sourceToken,
      targetToken,
      totalAmount,
      totalDurationSeconds,
      tradeIntervalSeconds, // New optional parameter
      userId  // You might get this from auth middleware
    } = req.body;

    // Validate required fields
    if (!sourceToken || !targetToken || !totalAmount || !totalDurationSeconds) {
      return res.status(400).json({ 
        error: 'Missing required fields: sourceToken, targetToken, totalAmount, totalDurationSeconds' 
      });
    }

    // Set default trade interval if not provided
    const intervalSeconds = tradeIntervalSeconds || 60; // Default to 10 seconds
    
    // Validate trade interval (max 7 days)
    const MAX_INTERVAL_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
    if (intervalSeconds > MAX_INTERVAL_SECONDS) {
      return res.status(400).json({
        error: `Trade interval cannot exceed ${MAX_INTERVAL_SECONDS} seconds (7 days)`
      });
    }

    // Calculate number of trades based on interval
    const totalTrades = Math.ceil(totalDurationSeconds / intervalSeconds);
    
    // Calculate amount per trade
    const amountPerTrade = totalAmount / totalTrades;

    const orderData = {
      userId,
      sourceToken,
      targetToken,
      totalAmount,
      totalDurationSeconds,
      tradeIntervalSeconds: intervalSeconds, // Store the interval
      amountPerTrade: amountPerTrade,
      remainingAmount: totalAmount,
      remainingSeconds: totalDurationSeconds,
      userWalletAddress: req.body.userWalletAddress,
    };

    const order = await dcaService.createPendingOrder(orderData);
    res.json({ order });

  } catch (error) {
    console.error('DCA order creation failed:', error);
    res.status(500).json({ error: 'Failed to create DCA order' });
  }
});

// Activate DCA order after deposit
router.post('/dca/activate/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params; // Ensure orderId is defined
    const { depositTxHash } = req.body; // Ensure depositTxHash is defined

    if (!orderId || !depositTxHash) {
      console.error('Missing parameters:', { orderId, depositTxHash }); // Log missing parameters
      return res.status(400).json({ error: 'Missing orderId or depositTxHash' });
    }

    const order = await dcaService.activateOrder(orderId, depositTxHash);
    res.json({ order });
  } catch (error) {
    console.error('Error activating order:', { error }); // Log the error with context
    res.status(500).json({ error: 'Failed to activate order' });
  }
});

// Cancel DCA order
router.post('/dca/cancel/:orderId', async (req, res) => {
  try {
    const success = await dcaService.cancelDCAOrder(req.params.orderId);
    if (success) {
      res.json({ message: 'Order cancelled successfully' });
    } else {
      res.status(400).json({ error: 'Failed to cancel order' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get DCA progress
router.get('/dca/progress/:orderId', async (req, res) => {
  try {
    const order = await dcaService.getPendingOrder(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const progress = await balanceService.getDCAOrdersStatus(order.userId);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Get user portfolio
router.get('/dca/portfolio/:userId', async (req, res) => {
  try {
    const portfolio = await balanceService.getUserPortfolio(req.params.userId);
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Get specific DCA order performance
router.get('/dca/performance/:orderId', async (req, res) => {
  try {
    const order = await dcaService.getPendingOrder(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const performance = await balanceService.getDCAOrdersStatus(order.userId);
    const orderPerformance = performance.find(p => p.orderId === req.params.orderId);
    
    if (!orderPerformance) {
      return res.status(404).json({ error: 'Performance data not found' });
    }

    res.json(orderPerformance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch DCA performance' });
  }
});

// Get all orders (DCA and limit) by wallet address
router.get('/wallet/:walletAddress/orders', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    // Get DCA orders
    const dcaOrders = await dcaService.getOrdersByWalletAddress(walletAddress);
    
    // Get limit orders
    const limitOrders = await limitOrderService.getOrdersByWalletAddress(walletAddress);
    
    // Format DCA orders
    const formattedDcaOrders = await Promise.all(dcaOrders.map(async (order) => {
      const progress = await balanceService.getDCAOrdersStatus(order.userId);
      const orderDetails = progress.find(p => p.orderId.toString() === order._id.toString());
      
      return {
        orderId: order._id,
        orderType: 'dca', // Add order type identifier
        status: order.status,
        sourceToken: order.sourceToken,
        targetToken: order.targetToken,
        totalAmount: order.totalAmount,
        remainingAmount: order.remainingAmount,
        startDate: order.startDate,
        progress: orderDetails ? orderDetails.progress : {
          completedSwaps: order.executedTrades.length,
          totalSwaps: Math.ceil(order.totalAmount / order.amountPerTrade),
          percentageComplete: ((order.totalAmount - order.remainingAmount) / order.totalAmount) * 100
        }
      };
    }));
    
    // Format limit orders
    const formattedLimitOrders = limitOrders.map(order => {
      return {
        orderId: order._id,
        orderType: 'limit', // Add order type identifier
        status: order.status,
        sourceToken: order.sourceToken,
        targetToken: order.targetToken,
        amount: order.amount,
        targetPrice: order.targetPrice,
        direction: order.direction,
        createdAt: order.createdAt,
        expiryDate: order.expiryDate,
        executedTrade: order.executedTrade
      };
    });
    
    // Combine both types of orders
    const allOrders = [...formattedDcaOrders, ...formattedLimitOrders];
    
    res.json({ orders: allOrders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wallet orders' });
  }
});

// Get user portfolio by wallet address
router.get('/dca/portfolio/wallet/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    const portfolio = await balanceService.getUserPortfolioByWalletAddress(walletAddress);
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Withdraw funds from a DCA order and cancel it
router.post('/dca/withdraw/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { walletAddress } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'Missing orderId' });
    }
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Missing walletAddress' });
    }
    
    // Verify that the wallet address matches the order's wallet address
    const order = await dcaService.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.userWalletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Wallet address does not match order owner' });
    }
    
    // Process the withdrawal and cancel the order
    const result = await dcaService.withdrawAndCancelOrder(orderId);
    
    if (result.success) {
      res.json({ 
        message: 'Order cancelled and funds withdrawn successfully',
        transactionHash: result.txHash,
        refundedAmount: result.refundedAmount
      });
    } else {
      res.status(500).json({ error: result.error || 'Failed to withdraw funds' });
    }
  } catch (error) {
    console.error('Error in withdraw endpoint:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new limit order
router.post('/limit/order', async (req, res) => {
  try {
    const {
      sourceToken,
      targetToken,
      amount,
      targetPrice,
      direction,
      userId,
      userWalletAddress,
      expiryDate
    } = req.body;

    // Validate required fields
    if (!sourceToken || !targetToken || !amount || !targetPrice || !direction) {
      return res.status(400).json({ 
        error: 'Missing required fields: sourceToken, targetToken, amount, targetPrice, direction' 
      });
    }

    // Validate direction
    if (direction !== 'above' && direction !== 'below') {
      return res.status(400).json({
        error: 'Direction must be "above" or "below"'
      });
    }

    const orderData = {
      userId,
      userWalletAddress,
      sourceToken,
      targetToken,
      amount: parseFloat(amount),
      targetPrice: parseFloat(targetPrice),
      direction,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined
    };

    const order = await limitOrderService.createPendingOrder(orderData);
    res.json({ order });

  } catch (error) {
    console.error('Limit order creation failed:', error);
    res.status(500).json({ error: 'Failed to create limit order' });
  }
});

// Activate limit order after deposit
router.post('/limit/activate/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { depositTxHash } = req.body;
    if (!orderId || !depositTxHash) {
      return res.status(400).json({ error: 'Missing orderId or depositTxHash' });
    }
    const order = await limitOrderService.activateOrder(orderId, depositTxHash);
    res.json({ order });
  } catch (error) {
    console.error("Error activating order:", error);
    //@ts-ignore
    res.status(500).json({ error: `Failed to activate order: ${error.message}` });
  }
});

// Cancel limit order
router.post('/limit/cancel/:orderId', async (req, res) => {
  try {
    const success = await limitOrderService.cancelLimitOrder(req.params.orderId);
    if (success) {
      res.json({ message: 'Limit order cancelled successfully' });
    } else {
      res.status(400).json({ error: 'Failed to cancel limit order' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all limit orders for a user
router.get('/limit/orders/:userId', async (req, res) => {
  try {
    const orders = await limitOrderService.getUserLimitOrders(req.params.userId);
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch limit orders' });
  }
});

// Get specific limit order
router.get('/limit/order/:orderId', async (req, res) => {
  try {
    const order = await limitOrderService.getLimitOrder(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Run every minute
cron.schedule('* * * * *', async () => {
  console.log('Checking limit orders...');
  try {
    await limitOrderService.checkAndProcessLimitOrders();
  } catch (error) {
    console.error('Error checking limit orders:', error);
  }
});

export default router; 