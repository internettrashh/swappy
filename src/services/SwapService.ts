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
} from "viem";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

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

interface QuoteResponse extends PriceResponse {
  guaranteedPrice: string;
  to: string;
  data: Hex;
  transaction: {
    to: string;
    data: Hex;
    value: string;
    gas: string;
    gasPrice: string;
  };
  permit2?: {
    eip712: any;
  };
}

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
  ): Promise<{ success: boolean; txHash?: string; price?: number }> {
    try {
      const [address] = await this.client.getAddresses();

      // 1. Fetch price quote
      const priceParams = new URLSearchParams({
        chainId: this.CHAIN_CONFIG.id.toString(),
        sellToken: sourceToken,
        buyToken: targetToken,
        sellAmount: amount.toString(),
        taker: address,
      });

      const priceResponse = await fetch(
        "https://api.0x.org/swap/permit2/price?" + priceParams.toString(),
        { headers: this.headers }
      );

      const price = (await priceResponse.json()) as PriceResponse;
      
      if (price.error) {
        throw new Error(`Price fetch failed: ${price.error}`);
      }

      // 2. Handle token approvals
      if (sourceToken !== "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE") {
        const sourceTokenContract = getContract({
          address: sourceToken as `0x${string}`,
          abi: erc20Abi,
          client: this.client,
          //@ts-ignore
          publicClient: this.publicClient,
        });

        if (price.issues?.allowance) {
          const currentAllowance = await sourceTokenContract.read.allowance([
            address,
            price.issues.allowance.spender as `0x${string}`
          ]);

          if (currentAllowance < amount) {
            const hash = await sourceTokenContract.write.approve([
              price.issues.allowance.spender as `0x${string}`,
              maxUint256
            ]);
            
            await this.client.waitForTransactionReceipt({ hash });
          }
        }
      }

      // 3. Get final quote
      const quoteResponse = await fetch(
        "https://api.0x.org/swap/permit2/quote?" + priceParams.toString(),
        { headers: this.headers }
      );

      const quote = (await quoteResponse.json()) as QuoteResponse;

      // 4. Handle permit2 signature if needed
      let signature: Hex | undefined;
      if (quote.permit2?.eip712) {
        signature = await this.client.signTypedData(quote.permit2.eip712);
        
        if (signature && quote.transaction?.data) {
          const signatureLengthInHex = numberToHex(size(signature), {
            signed: false,
            size: 32,
          });

          quote.transaction.data = concat([
            quote.transaction.data,
            signatureLengthInHex,
            signature,
          ]);
        }
      }

      // 5. Execute the swap
      const nonce = await this.client.getTransactionCount({
        address: address,
      });

      let txHash;
      if (sourceToken === 'ETH') {
        txHash = await this.client.sendTransaction({
          account: this.client.account,
          chain: this.CHAIN_CONFIG,
          gas: quote.transaction?.gas ? BigInt(quote.transaction.gas) : undefined,
          to: quote.transaction?.to as `0x${string}`,
          data: quote.transaction?.data,
          value: BigInt(quote.transaction?.value || '0'),
          gasPrice: quote.transaction?.gasPrice ? BigInt(quote.transaction.gasPrice) : undefined,
          nonce: nonce,
        });
      } else {
        const signedTx = await this.client.signTransaction({
          account: this.client.account,
          chain: this.CHAIN_CONFIG,
          gas: quote.transaction?.gas ? BigInt(quote.transaction.gas) : undefined,
          to: quote.transaction?.to as `0x${string}`,
          data: quote.transaction?.data,
          gasPrice: quote.transaction?.gasPrice ? BigInt(quote.transaction.gasPrice) : undefined,
          nonce: nonce,
        });

        txHash = await this.client.sendRawTransaction({
          serializedTransaction: signedTx,
        });
      }

      return {
        success: true,
        txHash,
        price: Number(quote.price)
      };

    } catch (error) {
      console.error('Swap execution failed:', error);
      return {
        success: false
      };
    }
  }

  async getQuote(
    sourceToken: string,
    targetToken: string,
    amount: bigint
  ): Promise<number> {
    const [address] = await this.client.getAddresses();
    
    const params = new URLSearchParams({
      chainId: this.CHAIN_CONFIG.id.toString(),
      sellToken: sourceToken,
      buyToken: targetToken,
      sellAmount: amount.toString(),
      taker: address,
    });

    const response = await fetch(
      "https://api.0x.org/swap/permit2/price?" + params.toString(),
      { headers: this.headers }
    );

    const quote = (await response.json()) as PriceResponse;
    return Number(quote.price);
  }
} 