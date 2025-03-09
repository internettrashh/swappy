import express from 'express';
import DCAService from '../services/DCAService';
import WalletService from '../services/WalletService';
import { config } from '../config';
import BalanceService from '../services/BalanceService';

const router = express.Router();
const dcaService = new DCAService();
const walletService = new WalletService();
const balanceService = new BalanceService();

// Step 1: Create pending DCA order
router.post('/dca/order/create', async (req, res) => {
  try {
    const {
      sourceToken,
      targetToken,
      totalAmount,
      totalDurationSeconds,
      userWalletAddress,
      userId
    } = req.body;

    // Validate inputs
    if (!sourceToken || !targetToken || !totalAmount || !totalDurationSeconds || !userWalletAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create pending order
    const orderData = {
      userId,
      sourceToken,
      targetToken,
      totalAmount,
      totalDurationSeconds,
      userWalletAddress,
      status: 'pending',
      remainingAmount: totalAmount,
      remainingSeconds: totalDurationSeconds
    };

    const pendingOrder = await dcaService.createPendingOrder(orderData);

    // Return order details and master wallet address for deposit
    res.json({
      orderId: pendingOrder._id,
      masterWalletAddress: config.MASTER_WALLET_ADDRESS,
      requiredAmount: totalAmount,
      status: 'pending'
    });

  } catch (error) {
    console.error('Failed to create pending order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Step 2: Confirm deposit and activate DCA order
router.post('/dca/order/activate', async (req, res) => {
  try {
    const { orderId, depositTxHash } = req.body;

    if (!orderId || !depositTxHash) {
      return res.status(400).json({ error: 'Missing orderId or depositTxHash' });
    }

    // Get pending order
    const order = await dcaService.getPendingOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify deposit
    const isDepositValid = await walletService.verifyDeposit(
      depositTxHash,
      order.totalAmount,
      order.sourceToken,
      order.userWalletAddress
    );

    if (!isDepositValid) {
      return res.status(400).json({ error: 'Invalid or insufficient deposit' });
    }

    // Activate order
    const activatedOrder = await dcaService.activateOrder(orderId, depositTxHash);

    res.json({
      message: 'DCA order activated successfully',
      order: activatedOrder
    });

  } catch (error) {
    console.error('Failed to activate order:', error);
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
    const progress = await dcaService.getDCAProgress(req.params.orderId);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Get user portfolio
router.get('/dca/portfolio/:userId', async (req, res) => {
  try {
    const portfolio = await dcaService.getUserPortfolio(req.params.userId);
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Get user's portfolio
router.get('/portfolio/:userId', async (req, res) => {
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
    const performance = await balanceService.getDCAOrderBalance(req.params.orderId);
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch DCA performance' });
  }
});

export default router; 