import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';

dotenv.config();


const priceFeedId = '0xe786153cc54abd4b0e53b4c246d54d9f8eb3f3b5a34d4fc5a2e9a423b0ba5d6b'; // MON/USD price feed ID

// PyTh price service connection
const pythConnection = new EvmPriceServiceConnection(
  'https://hermes-beta.pyth.network', // For mainnet, use an appropriate endpoint
);

// Function to get the latest price from PyTh
async function getPythPrice(priceFeedId) {
  try {
    // Fetch the latest price update
    const priceFeeds = await pythConnection.getLatestPriceFeeds([priceFeedId]);
    
    if (!priceFeeds || priceFeeds.length === 0) {
      throw new Error('No price feed data returned');
    }
    
    const priceFeed = priceFeeds[0];
    
    // Extract the price information - the structure is different than expected
    const priceObj = priceFeed.price;
    const price = Number(priceObj.price);
    const confidence = Number(priceObj.conf);
    const expo = priceObj.expo;
    const publishTime = new Date(priceObj.publishTime * 1000);
    
    // Calculate the actual price considering the exponent
    const fullPrice = price * Math.pow(10, expo);
    
    // Format the price in USD with high precision
    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(fullPrice);
    
    console.log(`Price Feed ID: ${priceFeedId}`);
    console.log(`Raw Price: ${price}`);
    console.log(`Confidence: ${confidence}`);
    console.log(`Exponent: ${expo}`);
    console.log(`Publish Time: ${publishTime.toLocaleString()}`);
    console.log(`Price in USD: ${formattedPrice}`);
    
    return {
      rawPrice: price,
      confidence,
      publishTime,
      expo,
      fullPrice,
      formattedPrice
    };
  } catch (error) {
    console.error('Error fetching PyTh price:', error);
    throw error;
  }
}

// Main function to run the test
(async () => {
  try {
    const priceData = await getPythPrice(priceFeedId);
    console.log('Price data:', priceData);
    
    // You can use this price data in your DCA logic
    // For example, to determine the amount of target token to buy
    
  } catch (error) {
    console.error('Error in process:', error);
  }
})();