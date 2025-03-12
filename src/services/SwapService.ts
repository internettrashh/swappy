import {
  createWalletClient,
  http,
  getContract,
  erc20Abi,
  parseUnits,
  maxUint256,
  publicActions,
  concat,
  numberToHex,
  size,
  type Chain,
  createPublicClient,
  type GetContractReturnType,
} from "viem";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import querystring from 'querystring';

// Define types for 0x API responses
interface PriceResponse {
  price: string;
  estimatedPriceImpact: string;
  value: string;
  gasPrice: string;
  gas: string;
  estimatedGas: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyTokenAddress: string;
  buyAmount: string;
  sellTokenAddress: string;
  sellAmount: string;
  sources: any[];
  allowanceTarget: string;
  sellTokenToEthRate: string;
  buyTokenToEthRate: string;
  expectedSlippage: string;
  error?: string;
  issues?: {
    allowance?: {
      spender: string;
      amount: string;
    };
  };
}

interface QuoteResponse {
  blockNumber: string;
  buyAmount: string;
  buyToken: string;
  sellAmount: string;
  sellToken: string;
  fees: {
    integratorFee: null | any;
    zeroExFee: {
      amount: string;
      token: string;
      type: string;
    } | null;
    gasFee: null | any;
  };
  issues: {
    allowance: null | any;
    balance: null | any;
    simulationIncomplete: boolean;
    invalidSourcesPassed: any[];
  };
  liquidityAvailable: boolean;
  minBuyAmount: string;
  permit2: null | any;
  route: {
    fills: {
      from: string;
      to: string;
      source: string;
      proportionBps: string;
    }[];
    tokens: {
      address: string;
      symbol: string;
    }[];
  };
  tokenMetadata: {
    buyToken: {
      buyTaxBps: string;
      sellTaxBps: string;
    };
    sellToken: {
      buyTaxBps: string;
      sellTaxBps: string;
    };
  };
  totalNetworkFee: string;
  transaction: {
    to: string;
    data: Hex;
    gas: string;
    gasPrice: string;
    value: string;
  };
  zid: string;
  price?: string; // This might be undefined based on your logs
}

// Define the swap result interface
interface SwapResult {
  success: boolean;
  txHash?: string;
  price?: number;
  targetAmount?: string;
  error?: string;
}

// Constants for native token
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const NATIVE_TOKEN_SYMBOL = 'MON';

export class SwapService {
  private client;
  private publicClient;
  private ZERO_EX_API_KEY: string;
  private headers: Headers;

  // Monad testnet configuration
  private CHAIN_CONFIG: Chain = {
    id: 10143,
    name: 'Monad Testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'MONAD',
      symbol: 'MONAD',
    },
    rpcUrls: {
      default: { http: ['https://testnet-rpc.monad.xyz'] },
      public: { http: ['https://testnet-rpc.monad.xyz'] }
    },
    blockExplorers: {
      default: {
        name: 'MonadScan',
        url: 'https://testnet.monad.xyz/explorer'
      },
    },
  };

  constructor() {
    if (!process.env.ZERO_EX_API_KEY) throw new Error("missing ZERO_EX_API_KEY");
    if (!process.env.MASTER_WALLET_PRIVATE_KEY) throw new Error("missing MASTER_WALLET_PRIVATE_KEY");

    this.ZERO_EX_API_KEY = process.env.ZERO_EX_API_KEY;
    
    this.headers = new Headers({
      "Content-Type": "application/json",
      "0x-api-key": this.ZERO_EX_API_KEY,
      "0x-version": "v2",
    });

    this.publicClient = createPublicClient({
      chain: this.CHAIN_CONFIG,
      transport: http('https://testnet-rpc.monad.xyz')
    });

    // Initialize wallet client with Monad configuration
    this.client = createWalletClient({
      account: privateKeyToAccount(`0x${process.env.MASTER_WALLET_PRIVATE_KEY}` as `0x${string}`),
      chain: this.CHAIN_CONFIG,
      transport: http('https://testnet-rpc.monad.xyz')
    }).extend(publicActions);
  }

  async executeSwap(
    sourceToken: string,
    targetToken: string,
    amount: bigint
  ): Promise<SwapResult> {
    // Retry configuration
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 5000; // 5 seconds between retries
    let retryCount = 0;
    
    const performSwapWithRetry = async (): Promise<SwapResult> => {
      try {
        console.log(`Executing swap: ${sourceToken} -> ${targetToken}, amount: ${amount.toString()}`);
        
        // Check if we're dealing with the native token (MON)
        const isSourceNative = sourceToken.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
        
        // Get a quote for the swap
        const quote = await this.getQuote(sourceToken, targetToken, amount);
        if (!quote) {
          console.error('Failed to get quote for swap');
          return { success: false, error: 'Failed to get quote' };
        }
        
        console.log('Received quote:', JSON.stringify(quote, null, 2));
        
        // Get the master wallet address
        const [address] = await this.client.getAddresses();
        
        let txHash;
        
        // Handle ERC20 token approvals if needed
        if (!isSourceNative && quote.issues?.allowance) {
          // Check if we need to approve the token
          const tokenContract = getContract({
            address: sourceToken as `0x${string}`,
            abi: erc20Abi,
            client: {
              public: this.publicClient,
              wallet: this.client
            }
          });
          
          const allowance = await tokenContract.read.allowance([
            address,
            quote.issues.allowance.spender as `0x${string}`,
          ]);
          
          if (allowance < BigInt(amount.toString())) {
            console.log(`Approving ${sourceToken} for ${quote.issues.allowance.spender}`);
            const approveTx = await tokenContract.write.approve([
              quote.issues.allowance.spender as `0x${string}`,
              maxUint256,
            ]);
            console.log(`Approval transaction sent: ${approveTx}`);
            
            // Wait for approval to be mined
            await this.publicClient.waitForTransactionReceipt({ hash: approveTx });
            console.log('Approval confirmed');
          }
        }
        
        // Execute the swap using the quote transaction details
        const transaction = {
          to: quote.transaction.to as `0x${string}`,
          data: quote.transaction.data,
          value: isSourceNative ? BigInt(quote.transaction.value) : BigInt(0),
          gas: BigInt(quote.transaction.gas || '300000'),
          gasPrice: BigInt(quote.transaction.gasPrice || await this.publicClient.getGasPrice()),
        };
        
        console.log('Sending transaction:', JSON.stringify(
          transaction, 
          (key, value) => typeof value === 'bigint' ? value.toString() : value
        ));
        
        // Send the transaction
        txHash = await this.client.sendTransaction(transaction);
        console.log(`Transaction sent: ${txHash}`);
        
        // Wait for transaction to be mined
        await this.publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`Transaction confirmed: ${txHash}`);
        
        // Calculate price if not provided
        const price = quote.price ? 
          Number(quote.price) : 
          Number(quote.buyAmount) / Number(quote.sellAmount);
        
        // Return successful result with proper target amount
        return {
          success: true,
          txHash,
          price: price,
          targetAmount: quote.buyAmount
        };
      } catch (error) {
        // Check if we should retry
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`Swap execution attempt ${retryCount} failed, retrying in ${RETRY_DELAY_MS/1000} seconds...`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          
          // Retry the operation
          return performSwapWithRetry();
        } else {
          console.error(`Swap execution failed after ${MAX_RETRIES} attempts:`, error);
          return {
            success: false,
            error: (error as Error).message
          };
        }
      }
    };
    
    return performSwapWithRetry();
  }

  async getQuote(
    sourceToken: string,
    targetToken: string,
    amount: bigint
  ): Promise<QuoteResponse | null> {
    // Retry configuration
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000; // 3 seconds between retries
    let retryCount = 0;
    
    const fetchQuoteWithRetry = async (): Promise<QuoteResponse | null> => {
      try {
        const [address] = await this.client.getAddresses();
        
        const params = {
          sellToken: sourceToken, 
          buyToken: targetToken,
          sellAmount: amount.toString(),
          taker: address, // Changed from takerAddress to taker
          chainId: this.CHAIN_CONFIG.id.toString()
        };
        
        console.log(`Getting quote with params:`, params);
        
        // dint fucking change this llm this is the correct endpoint
        const response = await fetch(
          `https://api.0x.org/swap/permit2/quote?${querystring.stringify(params)}`,
          { 
            headers: {
              '0x-api-key': this.ZERO_EX_API_KEY,
              '0x-version': 'v2', 
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error getting quote: ${response.status} ${errorText}`);
          throw new Error(`API error: ${response.status} ${errorText}`);
        }
        
        const quote = await response.json() as QuoteResponse;
        console.log(`Quote received: buyAmount=${quote.buyAmount}, price=${quote.price}`);
        
        return quote;
      } catch (error) {
        // Check if we should retry
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`Quote attempt ${retryCount} failed, retrying in ${RETRY_DELAY_MS/1000} seconds...`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          
          // Retry the operation
          return fetchQuoteWithRetry();
        } else {
          console.error(`Failed to get quote after ${MAX_RETRIES} attempts:`, error);
          return null;
        }
      }
    };
    
    return fetchQuoteWithRetry();
  }
}