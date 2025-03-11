import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { exec } from 'child_process';

dotenv.config();

// Configuration
const providerUrl = 'https://testnet-rpc.monad.xyz'; // Replace with your RPC URL
const privateKey = process.env.TESTWALLET_PRIVATE_KEY; // Replace with the provided private key
const userWalletAddress = '0x3FF1841743d1bFf0a93BAb21e6bae41e2326F810'; // Replace with the actual wallet address
const sourceToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // Replace with actual token address
const targetToken = '0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714'; // Replace with actual token address
const totalAmount = ethers.parseUnits('0.3', 18); // 0.3 MON in wei
const totalDurationSeconds = 300; // 5 minutes in seconds

// Create a provider and wallet
const provider = new ethers.JsonRpcProvider(providerUrl);
const wallet = new ethers.Wallet(privateKey, provider);

export const config = {
    // Blockchain settings
    RPC_URL: process.env.RPC_URL || 'https://testnet-rpc.monad.xyz',
    CHAIN_ID: 10143,  // Monad testnet
};

// Function to create a DCA order
async function createDCAOrder() {
    const createOrderCommand = `curl -X POST http://localhost:3001/api/dca/order \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "user1",
      "sourceToken": "${sourceToken}",
      "targetToken": "${targetToken}",
      "totalAmount": "${totalAmount}",
      "totalDurationSeconds": "${totalDurationSeconds}",
      "userWalletAddress": "${userWalletAddress}"
    }'`;

    return new Promise((resolve, reject) => {
        exec(createOrderCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error creating DCA order: ${stderr}`);
                return reject(error);
            }
            console.log(`DCA Order Created: ${stdout}`);
            resolve(JSON.parse(stdout));
        });
    });
}

// Function to fund the trade
async function fundTrade(orderId) {
    try {
        // Get the master wallet address from environment variables or use a default
        const masterWalletAddress = '0x0015d013510C40a5779Beb25a6Cd0654A1f33aF8';
        
        // Use a fixed gas price
        const gasPrice = ethers.parseUnits('150', 'gwei');
        
        // Create transaction to send funds to the master wallet (not to self)
        const tx = {
            to: masterWalletAddress, // Send to master wallet instead of user wallet
            value: totalAmount,
            gasLimit: 100000, // Increase gas limit
            gasPrice: gasPrice,
            chainId: config.CHAIN_ID,
            // Add nonce to avoid transaction conflicts
            nonce: await provider.getTransactionCount(wallet.address)
        };

        console.log("Sending transaction with params:", 
            JSON.stringify(tx, (key, value) => 
                typeof value === 'bigint' ? value.toString() : value
            )
        );
        
        const transaction = await wallet.sendTransaction(tx);
        console.log(`Funding transaction sent: ${transaction.hash}`);

        // Wait for transaction to be mined
        await transaction.wait();
        console.log(`Funding transaction confirmed: ${transaction.hash}`);
        return transaction.hash;
    } catch (error) {
        console.error("Error in fundTrade:", error);
        throw error;
    }
}

// Function to activate the DCA order
async function activateDCAOrder(orderId, depositTxHash) {
    const activateOrderCommand = `curl -X POST http://localhost:3001/api/dca/activate/${orderId} \
    -H "Content-Type: application/json" \
    -d '{
      "depositTxHash": "${depositTxHash}"
    }'`;

    return new Promise((resolve, reject) => {
        exec(activateOrderCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error activating DCA order: ${stderr}`);
                return reject(error);
            }
            console.log(`DCA Order Activated: ${stdout}`);
            resolve(stdout);
        });
    });
}

// Add this before your fundTrade function
async function checkBalance() {
    try {
        const balance = await provider.getBalance(wallet.address);
        console.log(`Wallet address: ${wallet.address}`);
        console.log(`Wallet balance: ${ethers.formatEther(balance)} MON`);
        
        // Check if balance is sufficient
        if (balance < totalAmount) {
            console.error(`Insufficient balance: ${ethers.formatEther(balance)} MON, need at least ${ethers.formatEther(totalAmount)} MON`);
            throw new Error("Insufficient funds");
        }
    } catch (error) {
        console.error("Error checking balance:", error);
        throw error;
    }
}

// Main function to run the test
(async () => {
    try {
        // Step 1: Create DCA Order
        const orderResponse = await createDCAOrder();
        const orderId = orderResponse.order._id; // Extract order ID from response

        // Step 2: Fund the trade
        await checkBalance();
        const depositTxHash = await fundTrade(orderId);

        // Step 3: Activate the DCA Order
        await activateDCAOrder(orderId, depositTxHash);
    } catch (error) {
        console.error('Error in DCA process:', error);
    }
})();