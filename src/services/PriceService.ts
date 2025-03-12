import fetch from 'node-fetch';
import { config } from '../config';

// Interface for the 0x API response
interface ZeroExPriceResponse {
  buyAmount: string;
  sellAmount: string;
  price?: string;  // Some responses might include price directly
  buyToken: string;
  sellToken: string;
  estimatedGas?: string;
  route?: {
    tokens: Array<{
      address: string;
      symbol: string;
    }>;
  };
  // Additional fields omitted for brevity
}

export class PriceService {
  private readonly API_KEY: string;
  private readonly API_URL: string = 'https://api.0x.org/swap/permit2/price?';
  private readonly CHAIN_ID: string = '10143'; 
  
  // Common token addresses for reference - corrected with Native ETH address
  private readonly TOKENS: Record<string, string> = {
    MON : '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', 
    WMON: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701', 
    DAI: '0x6b175474e89094c44da98b954eedeac495271d0f',
    USDC: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    USDT: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
    WBTC: "0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d",
    WETH: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    DAK:  "0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714",
    ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" // Added ETH token (same as MON for native ETH)
  };
  
  // Cache for token prices (token pair -> price)
  private priceCache: Map<string, { price: number, timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute in milliseconds
  
  // Rate limiting
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private readonly MAX_REQUESTS_PER_SECOND = 5; // Safe limit (half of the actual limit)
  private readonly REQUEST_DELAY = 1000 / this.MAX_REQUESTS_PER_SECOND; // ms between requests
  
  constructor() {
    this.API_KEY = config.OX_API_KEY || '';
    if (!this.API_KEY) {
      console.warn('0x API key not configured. Price service may not work correctly.');
    }
  }
  
  /**
   * Add a request to the queue and process it according to rate limits
   */
  private async enqueueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Add the request to the queue
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      // Start processing the queue if it's not already running
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process the request queue with rate limiting
   */
  private async processQueue() {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          console.error('Error processing queued request:', error);
        }
        
        // Wait to respect the rate limit
        await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
      }
    }
    
    this.isProcessingQueue = false;
  }
  
  /**
   * Get token price from source token to target token
   * @param sourceToken Source token address
   * @param targetToken Target token address
   * @returns Price of 1 source token in target token units
   */
  async getTokenPrice(sourceToken: string, targetToken: string): Promise<number> {
    const cacheKey = `${sourceToken}_${targetToken}`;
    const cachedData = this.priceCache.get(cacheKey);
    
    // If cache is valid, return cached price
    if (cachedData && (Date.now() - cachedData.timestamp) < this.CACHE_TTL) {
      return cachedData.price;
    }
    
    // If not in cache or expired, fetch new price with rate limiting
    return this.enqueueRequest(async () => {
      try {
        // Use a standard amount based on token decimals
        // For most ERC20 tokens, including ETH, it's 18 decimals
        // For tokens like USDC with 6 decimals, we would need to adjust this
        const sellAmount = '100000'; // Small amount to avoid balance issues in simulation
        
        const priceParams = new URLSearchParams({
          chainId: this.CHAIN_ID,
          sellToken: sourceToken,
          buyToken: this.TOKENS.USDT,
          sellAmount: sellAmount,
          taker: '0x0015d013510C40a5779Beb25a6Cd0654A1f33aF8',
        });
        console.log( 'price params are ',priceParams.toString());
        
        const headers = {
          '0x-api-key': this.API_KEY,
          '0x-version': 'v2',
        };
        
        console.log(`Fetching price for ${sourceToken} to ${targetToken}...`);
        const priceResponse = await fetch(this.API_URL + priceParams.toString(), { headers });
        
        if (!priceResponse.ok) {
          const errorText = await priceResponse.text();
          throw new Error(`Price fetch failed (${priceResponse.status}): ${errorText}`);
        }
        
        const priceData = await priceResponse.json() as ZeroExPriceResponse;
        
        // Calculate price based on the response
        // buyAmount represents how much of the target token we get for the sellAmount
        const price = Number(priceData.buyAmount) / Number(priceData.sellAmount);
        
        console.log(`Price for ${sourceToken} to ${targetToken}: ${price}`);
        
        // Get token symbols for logging (if available)
        let sourceSymbol = 'Unknown';
        let targetSymbol = 'Unknown';
        
        if (priceData.route && priceData.route.tokens) {
          // Find source and target tokens in the route
          const sourceTokenInfo = priceData.route.tokens.find(t => 
            t.address.toLowerCase() === sourceToken.toLowerCase());
          const targetTokenInfo = priceData.route.tokens.find(t => 
            t.address.toLowerCase() === targetToken.toLowerCase());
            
          if (sourceTokenInfo) sourceSymbol = sourceTokenInfo.symbol;
          if (targetTokenInfo) targetSymbol = targetTokenInfo.symbol;
        }
        
        console.log(`Received price: 1 ${sourceSymbol} = ${price} ${targetSymbol}`);
        
        // Cache the result
        this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
        
        return price;
      } catch (error) {
        console.error(`Failed to fetch price for ${sourceToken} to ${targetToken}:`, error);
        
        // If we have a cached price, return that as fallback even if expired
        if (cachedData) {
          console.log(`Using expired cache for ${sourceToken} to ${targetToken}`);
          return cachedData.price;
        }
        
        throw error;
      }
    });
  }
  
  /**
   * Get token price in USDT
   * @param tokenAddress Address of the token to price
   * @returns Price of 1 full token in USDT
   */
  async getTokenPriceInUSDT(tokenAddress: string): Promise<number> {
    // Use the existing method but always with USDT as target
    return this.getTokenPrice(tokenAddress, this.TOKENS.USDT);
  }
  
  /**
   * Update the top 5 token pairs by priority
   */
  async updatePriorityTokenPrices(): Promise<void> {
    try {
      // Predefined list of 5 most important token pairs
      const tokenPairs = [
        { source: this.TOKENS.ETH, target: this.TOKENS.USDC },
        { source: this.TOKENS.ETH, target: this.TOKENS.DAI },
        { source: this.TOKENS.WBTC, target: this.TOKENS.USDC },
        { source: this.TOKENS.ETH, target: this.TOKENS.USDT },
        { source: this.TOKENS.WBTC, target: this.TOKENS.ETH }
      ];
      
      console.log('Updating priority token prices...');
      
      // Update prices one by one to respect rate limits
      for (const { source, target } of tokenPairs) {
        try {
          await this.getTokenPrice(source, target);
          // The rate limiting happens inside getTokenPrice
        } catch (error) {
          console.error(`Failed to update price for ${source} to ${target}:`, error);
        }
      }
      
      console.log('Priority token prices updated successfully');
    } catch (error) {
      console.error('Failed to update priority token prices:', error);
    }
  }
  
  /**
   * For updating priority prices against USDT
   */
  async updatePriorityTokenPricesInUSDT(): Promise<void> {
    try {
      // List of important tokens to price against USDT
      const tokensToPrice = [
        this.TOKENS.MON,
        this.TOKENS.WMON,
        this.TOKENS.DAI,
        this.TOKENS.WBTC,
        this.TOKENS.WETH,
        this.TOKENS.DAK
      ];
      
      console.log('Updating token prices in USDT...');
      
      for (const tokenAddress of tokensToPrice) {
        try {
          await this.getTokenPriceInUSDT(tokenAddress);
        } catch (error) {
          console.error(`Failed to update price for token to USDT:`, error);
        }
      }
      
      console.log('Token prices in USDT updated successfully');
    } catch (error) {
      console.error('Failed to update token prices in USDT:', error);
    }
  }
  
  /**
   * Get prices for an array of token pairs (for limit orders)
   * @param orderPairs Array of token pairs to check
   */
  async getOrderPrices(orderPairs: Array<{sourceToken: string, targetToken: string}>): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    
    // Group pairs to reduce redundant requests
    const uniquePairs = new Map<string, {sourceToken: string, targetToken: string}>();
    
    for (const pair of orderPairs) {
      const key = `${pair.sourceToken}_${pair.targetToken}`;
      if (!uniquePairs.has(key)) {
        uniquePairs.set(key, pair);
      }
    }
    
    console.log(`Fetching prices for ${uniquePairs.size} unique token pairs...`);
    
    // Get prices for unique pairs
    for (const [key, pair] of uniquePairs.entries()) {
      try {
        const price = await this.getTokenPrice(pair.sourceToken, pair.targetToken);
        results.set(key, price);
      } catch (error) {
        console.error(`Failed to get price for pair ${key}:`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Get address for a token symbol
   * @param symbol Token symbol (e.g., 'ETH', 'DAI')
   * @returns Token address or null if not found
   */
  getTokenAddress(symbol: string): string | null {
    const upperSymbol = symbol.toUpperCase();
    return this.TOKENS[upperSymbol] || null;
  }
  
  /**
   * Convert token symbol to address for use in pricing
   * @param symbol Token symbol (e.g., 'ETH', 'WETH', 'DAI')
   * @returns Correct token address for 0x API
   */
  getTokenAddressForPricing(symbol: string): string | null {
    const upperSymbol = symbol.toUpperCase();
    // Return the proper address based on symbol
    return this.TOKENS[upperSymbol] || null;
  }
} 