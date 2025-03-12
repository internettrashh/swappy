import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import axios from 'axios'; // Import axios for making HTTP requests

dotenv.config();

// Configuration
const providerUrl = 'https://testnet-rpc.monad.xyz';
const privateKey = process.env.TESTWALLET_PRIVATE_KEY;
const userWalletAddress = '0x3FF1841743d1bFf0a93BAb21e6bae41e2326F810';
const sourceToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const targetToken = '0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714';
const amount = ethers.parseUnits('0.1', 18); // 0.1 MON
const userId = "1";

// Create a provider and wallet
const provider = new ethers.JsonRpcProvider(providerUrl);
const wallet = new ethers.Wallet(privateKey, provider);

export const config = {
    RPC_URL: process.env.RPC_URL || 'https://testnet-rpc.monad.xyz',
    CHAIN_ID: 10143,  // Monad testnet
};

// Function to fetch the current price of MON in USDT
async function fetchMonPriceInUSDT() {
    try {
        console.log("Making API request to fetch price...");
        const response = await axios.get('https://api.0x.org/swap/permit2/price', {
            headers: {
                '0x-api-key': process.env.ZERO_EX_API_KEY || '3a91c837-7567-4778-92f0-a5e14d7f2313',
                '0x-version': 'v2'
            },
            params: {
                sellToken: '0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714', // target token (DAK)
                buyToken: '0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D', // USDT token
                sellAmount: ethers.parseUnits('1', 18).toString(), // 1 token in wei
                chainId: 10143 // Monad testnet chain ID
            }
        });
        
        console.log("API Response:", JSON.stringify(response.data, null, 2));
        
        // Calculate price from buyAmount and sellAmount
        if (response.data && response.data.buyAmount) {
            // The price is how much USDT you get for 1 token
            // Convert from wei to normal units (assuming USDT has 6 decimals)
            const buyAmountInUSDT = ethers.formatUnits(response.data.buyAmount, 6);
            console.log(`Calculated price: 1 DAK = ${buyAmountInUSDT} USDT`);
            
            // Add a small premium (5%) to make the limit order more likely to trigger
            const targetPrice = (parseFloat(buyAmountInUSDT) * 1.05).toFixed(6);
            console.log(`Target price with 5% premium: ${targetPrice}`);
            
            return targetPrice;
        } else {
            // If we can't get a real price, we should throw an error instead of using a default
            throw new Error("Could not calculate price from API response - buyAmount missing");
        }
    } catch (error) {
        console.error('Error fetching price:', error.message);
        if (error.response) {
            console.error('API Error Response:', error.response.data);
        }
        // Instead of returning a default value, throw the error to be handled by the caller
        throw new Error(`Failed to get market price: ${error.message}`);
    }
}

// Function to create a limit order
async function createLimitOrder(targetPrice) {
    const createOrderCommand = `curl -X POST http://localhost:3001/api/limit/order \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "${userId}",
      "sourceToken": "${sourceToken}",
      "targetToken": "${targetToken}",
      "amount": "${amount}",
      "targetPrice": "${targetPrice}",
      "direction": "above",
      "userWalletAddress": "${userWalletAddress}",
      "expiryDate": "${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}"
    }'`;

    return new Promise((resolve, reject) => {
        exec(createOrderCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error creating limit order: ${stderr}`);
                return reject(error);
            }
            console.log(`Limit Order Created: ${stdout}`);
            try {
                const response = JSON.parse(stdout);
                if (response.error) {
                    console.error("API returned an error:", response.error);
                    return reject(new Error(response.error));
                }
                resolve(response);
            } catch (parseError) {
                console.error("Error parsing API response:", parseError);
                console.error("Raw response:", stdout);
                reject(parseError);
            }
        });
    });
}

// Function to fund the trade (reused from test.mjs)
async function fundTrade(orderId) {
    try {
        const masterWalletAddress = '0x0015d013510C40a5779Beb25a6Cd0654A1f33aF8';
        const gasPrice = ethers.parseUnits('180', 'gwei');
        
        const tx = {
            to: masterWalletAddress,
            value: amount,
            gasLimit: 100000,
            gasPrice: gasPrice,
            chainId: config.CHAIN_ID,
            nonce: await provider.getTransactionCount(wallet.address)
        };

        console.log("Sending transaction with params:", 
            JSON.stringify(tx, (key, value) => 
                typeof value === 'bigint' ? value.toString() : value
            )
        );
        
        const transaction = await wallet.sendTransaction(tx);
        console.log(`Funding transaction sent: ${transaction.hash}`);

        await transaction.wait();
        console.log(`Funding transaction confirmed: ${transaction.hash}`);
        return transaction.hash;
    } catch (error) {
        console.error("Error in fundTrade:", error);
        throw error;
    }
}

// Function to activate the limit order
async function activateLimitOrder(orderId, depositTxHash) {
    const activateOrderCommand = `curl -X POST http://localhost:3001/api/limit/activate/${orderId} \
    -H "Content-Type: application/json" \
    -d '{
      "depositTxHash": "${depositTxHash}"
    }'`;

    return new Promise((resolve, reject) => {
        exec(activateOrderCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error activating limit order: ${stderr}`);
                return reject(error);
            }
            console.log(`Limit Order Activated: ${stdout}`);
            resolve(JSON.parse(stdout));
        });
    });
}

// Function to get specific limit order
async function getLimitOrder(orderId) {
    const orderCommand = `curl -X GET http://localhost:3001/api/limit/order/${orderId}`;

    return new Promise((resolve, reject) => {
        exec(orderCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error getting limit order: ${stderr}`);
                return reject(error);
            }
            console.log(`Limit Order Details: ${stdout}`);
            resolve(JSON.parse(stdout));
        });
    });
}

// Function to get all limit orders for user
async function getUserLimitOrders(userId) {
    const ordersCommand = `curl -X GET http://localhost:3001/api/limit/orders/${userId}`;

    return new Promise((resolve, reject) => {
        exec(ordersCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error getting limit orders: ${stderr}`);
                return reject(error);
            }
            console.log(`Limit Orders: ${stdout}`);
            resolve(JSON.parse(stdout));
        });
    });
}

// Function to check balance
async function checkBalance() {
    try {
        const balance = await provider.getBalance(wallet.address);
        console.log(`Wallet address: ${wallet.address}`);
        console.log(`Wallet balance: ${ethers.formatEther(balance)} MON`);
        
        if (balance < amount) {
            console.error(`Insufficient balance: ${ethers.formatEther(balance)} MON, need at least ${ethers.formatEther(amount)} MON`);
            throw new Error("Insufficient funds");
        }
        return true;
    } catch (error) {
        console.error("Error checking balance:", error);
        throw error;
    }
}

// Function to get all orders (DCA and limit) for a wallet address
async function getWalletOrders(walletAddress) {
  const ordersCommand = `curl -X GET http://localhost:3001/api/wallet/${walletAddress}/orders`;

  return new Promise((resolve, reject) => {
    exec(ordersCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error getting wallet orders: ${stderr}`);
        return reject(error);
      }
      console.log(`Wallet Orders: ${stdout}`);
      resolve(JSON.parse(stdout));
    });
  });
}

// Main function to run the test
(async () => {
    try {
        // Step 1: Fetch the current price of MON in USDT
        console.log("Fetching current price of MON in USDT...");
        let targetPrice;
        try {
            targetPrice = await fetchMonPriceInUSDT();
            console.log(`Current target price for MON in USDT: ${targetPrice}`);
        } catch (priceError) {
            console.error(`Error fetching price: ${priceError.message}`);
            console.error("Cannot proceed without a valid market price. Exiting test.");
            return; // Exit the test if we can't get a valid price
        }

        // Step 2: Create Limit Order with the fetched target price
        console.log("Creating limit order...");
        const orderResponse = await createLimitOrder(targetPrice);
        
        if (!orderResponse.order || !orderResponse.order._id) {
            throw new Error("Failed to create order or get order ID");
        }
        
        const orderId = orderResponse.order._id;
        console.log(`Created limit order with ID: ${orderId}`);

        // Step 3: Fund the trade
        console.log("Checking balance and funding trade...");
        await checkBalance();
        const depositTxHash = await fundTrade(orderId);

        // Step 4: Activate the Limit Order
        console.log("Activating limit order...");
        await activateLimitOrder(orderId, depositTxHash);
        
        // Step 5: Get Limit Order Details
        console.log("Getting limit order details...");
        const orderDetails = await getLimitOrder(orderId);
        console.log("Limit Order Details:", JSON.stringify(orderDetails, null, 2));
        
        // Step 6: Get All User's Limit Orders
        console.log("Getting all user limit orders...");
        const userOrders = await getUserLimitOrders(userId);
        console.log("User Limit Orders:", JSON.stringify(userOrders, null, 2));
        
        // Optional: Wait for some time and check order status again
        console.log("Waiting 2 minutes to check order status again...");
        await new Promise(resolve => setTimeout(resolve, 120000));
        const updatedOrderDetails = await getLimitOrder(orderId);
        console.log("Updated Order Details:", JSON.stringify(updatedOrderDetails, null, 2));
    } catch (error) {
        console.error('Error in limit order test process:', error);
    }
})();