import express from 'express';
import { DCAService } from '../services/DCAService';
import { BalanceService } from '../services/BalanceService';

const router = express.Router();
const dcaService = new DCAService();
const balanceService = new BalanceService();

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
    const intervalSeconds = tradeIntervalSeconds || 10; // Default to 10 seconds
    
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
    const { orderId } = req.params;
    const { depositTxHash } = req.body;
    if (!orderId || !depositTxHash) {
      return res.status(400).json({ error: 'Missing orderId or depositTxHash' });
    }
    const order = await dcaService.activateOrder(orderId, depositTxHash);
    res.json({ order });
  } catch (error) {
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

export default router; 