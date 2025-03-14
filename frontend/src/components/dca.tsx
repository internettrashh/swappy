"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { 
  ArrowRightLeft, Timer, Zap, HelpCircle, Settings, ChevronDown, Loader2 
} from 'lucide-react';
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { BrowserProvider } from "ethers";
import { toast } from 'react-hot-toast';

// Token type definition
interface Token {
  name: string
  decimals: number
  symbol: string
  address: string
  logoUrl?: string
  chainId?: number
  isNative?: boolean
}

// Constants for native token handling
const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" // Standard placeholder for native tokens

// ERC20 ABI for token interactions
const ERC20_ABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  // decimals
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  // approve
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  }
];

// Token list
const tokenlist: Token[] = [
  {
    name: "Monad",
    decimals: 18,
    symbol: "MON",
    address: NATIVE_TOKEN_ADDRESS,
    isNative: true,
  },
  {
    name: "Wrapped Monad",
    decimals: 18,
    symbol: "WMON",
    address: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
  },
  {
    name: "Tether USD",
    decimals: 18,
    symbol: "USDT",
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
  },
  {
    name: "Wrapped Ethereum",
    decimals: 18,
    symbol: "WETH",
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
  },
  {
    name: "Wrapped Bitcoin",
    decimals: 18,
    symbol: "WBTC",
    address: "0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d",
  },
  {
    name: "USD Coin",
    decimals: 18,
    symbol: "USDC",
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
  },
  {
    name: "Molandak",
    decimals: 18,
    symbol: "DAK",
    address: "0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714",
  },
];

// Master wallet address (you should move this to environment variables or get from API)
const MASTER_WALLET_ADDRESS = "0x0015d013510C40a5779Beb25a6Cd0654A1f33aF8";

function Dca() {
  const router = useRouter();
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];

  // State for input values
  const [allocateAmount, setAllocateAmount] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  
  // Token selection
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [showFromTokenList, setShowFromTokenList] = useState(false);
  const [showToTokenList, setShowToTokenList] = useState(false);
  
  // Token balances
  const [fromTokenBalance, setFromTokenBalance] = useState("0");
  const [isLoadingFromBalance, setIsLoadingFromBalance] = useState(false);
  
  // Order status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  
  // Initialize default tokens
  useEffect(() => {
    // Default MON as source token and DAK as target token
    setFromToken(tokenlist.find((t) => t.symbol === "MON") || tokenlist[0]);
    setToToken(tokenlist.find((t) => t.symbol === "DAK") || tokenlist[6]);
  }, []);
  
  // Fetch balances when tokens or wallet changes
  useEffect(() => {
    if (fromToken && activeWallet?.address) {
      fetchTokenBalance(fromToken);
    }
  }, [fromToken, activeWallet?.address]);

  // Function to fetch token balance
  const fetchTokenBalance = async (token: Token) => {
    if (!activeWallet?.address) {
      setFromTokenBalance("0");
      return;
    }

    try {
      setIsLoadingFromBalance(true);

      const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");

      // If it's a native token (MON)
      if (token.isNative) {
        const balanceWei = await provider.getBalance(activeWallet.address);
        const balanceFormatted = ethers.formatEther(balanceWei);
        setFromTokenBalance(balanceFormatted);
      }
      // If it's an ERC20 token
      else {
        const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);

        // Get token decimals (use the one from token object or fetch from contract)
        let decimals = token.decimals;
        try {
          decimals = await tokenContract.decimals();
        } catch (error) {
          console.log("Using default decimals from token object:", decimals);
        }

        // Get balance
        const balance = await tokenContract.balanceOf(activeWallet.address);
        const balanceFormatted = ethers.formatUnits(balance, decimals);
        setFromTokenBalance(balanceFormatted);
      }
    } catch (error) {
      console.error(`Error fetching ${token.symbol} balance:`, error);
      setFromTokenBalance("0");
    } finally {
      setIsLoadingFromBalance(false);
    }
  };

  // Handle amount change
  const handleAllocateAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "");
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAllocateAmount(value);
    }
  };

  // Handle hours change
  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setHours(value);
    }
  };

  // Handle minutes change
  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && parseInt(value) < 60) {
      setMinutes(value);
    }
  };

  // Format amount with commas
  const formatAmount = (amount: string) => {
    if (!amount) return "";

    // Remove existing commas
    const value = amount.replace(/,/g, "");

    // Check if it's a valid number
    if (!/^\d*\.?\d*$/.test(value)) return amount;

    const num = Number.parseFloat(value);

    // Handle very small numbers
    if (num < 0.000001) {
      return num.toFixed(10).replace(/\.?0+$/, ""); // Remove trailing zeros
    }

    // For normal numbers, format with commas
    const parts = value.split(".");

    // Format the integer part with commas
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Join back with decimal part if exists
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
  };

  // Handle Max button click
  const handleMaxButtonClick = async () => {
    if (!activeWallet?.address || !fromToken) {
      return;
    }

    // If it's the native token, leave some for gas
    if (fromToken.isNative) {
      const balance = Number.parseFloat(fromTokenBalance);
      const reservedForGas = 0.01; // Reserve 0.01 for gas
      const availableBalance = balance > reservedForGas ? (balance - reservedForGas).toString() : "0";
      setAllocateAmount(availableBalance);
    } else {
      // For ERC20 tokens, use the full balance
      setAllocateAmount(fromTokenBalance);
    }
  };

  // Set predefined durations
  const setDuration = (h: number, m: number) => {
    setHours(h.toString());
    setMinutes(m.toString());
  };

  // Calculate total duration in seconds
  const calculateDurationSeconds = () => {
    const hoursInSeconds = parseInt(hours || "0") * 3600;
    const minutesInSeconds = parseInt(minutes || "0") * 60;
    return hoursInSeconds + minutesInSeconds;
  };

  // Create DCA order
  const handleCreateDCA = async () => {
    if (!activeWallet || !fromToken || !toToken) {
      setError("Please connect your wallet and select tokens");
      return;
    }

    if (parseFloat(allocateAmount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const durationSeconds = calculateDurationSeconds();
    if (durationSeconds < 180 || durationSeconds > 604800) { // 3 min to 7 days
      setError("Duration must be between 3 minutes and 7 days");
      return;
    }

    setLoading(true);
    setError(null);
    setTxStatus("idle");
    
    try {
      // Get API base URL from environment variable
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      
      // Get token addresses
      const sourceTokenAddress = fromToken.address;
      const targetTokenAddress = toToken.address;
      
      // Parse amount to wei (18 decimals) - using BigInt to handle large numbers properly
      const totalAmountInWei = ethers.parseUnits(allocateAmount, fromToken.decimals).toString();
      
      // Use wallet address as user ID
      const userWalletAddress = activeWallet.address;
      
      // Step 1: Create DCA order in the API
      const createOrderResponse = await fetch(`${apiBaseUrl}/dca/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userWalletAddress,
          sourceToken: sourceTokenAddress,
          targetToken: targetTokenAddress,
          totalAmount: totalAmountInWei,
          totalDurationSeconds: durationSeconds,
          userWalletAddress
        }),
      });

      if (!createOrderResponse.ok) {
        const errorData = await createOrderResponse.json();
        throw new Error(errorData.message || 'Failed to create DCA order');
      }

      const orderData = await createOrderResponse.json();
      console.log("Order data received:", orderData);

      // Check if order ID exists - update to use correct path
      if (!orderData?.order?._id) {
        throw new Error('Invalid order data returned from server - missing order ID');
      }

      setOrderId(orderData.order._id);
      
      // Step 2: Transfer tokens to master wallet
      setTxStatus("pending");
      
      // Get Ethereum provider and signer
      const ethereumProvider = await activeWallet.getEthereumProvider();
      const ethersProvider = new BrowserProvider(ethereumProvider);
      const signer = await ethersProvider.getSigner();
      
      let transaction;
      
      // If it's a native token (like MON), send directly
      if (fromToken.isNative) {
        // Prepare transaction object without gasLimit initially
        const txParams = {
          to: MASTER_WALLET_ADDRESS,
          value: totalAmountInWei,
          chainId: 10143, // Monad testnet
        };
        
        try {
          // Estimate the gas needed for this transaction
          const estimatedGas = await signer.estimateGas(txParams);
          
          // Add some buffer to the estimated gas (e.g., 20% more)
          // Convert to number temporarily for calculation if needed or use BigInt() constructor
          const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.2));
          
          // Create a new transaction object with the gas limit
          const txWithGas = {
            ...txParams,
            gasLimit: gasLimit
          };
          
          // Send the transaction
          transaction = await signer.sendTransaction(txWithGas);
        } catch (error) {
          console.error("Error estimating gas:", error);
          // Handle error appropriately
        }
      }
      // If it's an ERC20 token, approve and transfer
      else {
        // Create contract instance with signer
        const tokenContract = new ethers.Contract(fromToken.address, ERC20_ABI, signer);
        
        // Approve the master wallet to spend tokens
        const approveTx = await tokenContract.approve(MASTER_WALLET_ADDRESS, totalAmountInWei);
        await approveTx.wait();
        
        // Now transfer the tokens to the master wallet
        // Note: You may need a separate contract function for this depending on your setup
        transaction = approveTx; // In this example we're just tracking the approve transaction
      }
      
      setTxHash(transaction.hash);
      
      // Wait for transaction confirmation
      await transaction.wait();
      
      // Step 3: Activate the DCA order with the transaction hash
      // Use the stored orderId state variable as a fallback
      const orderIdToUse = orderData.order._id || orderId;
      if (!orderIdToUse) {
        throw new Error('Cannot activate order: missing order ID');
      }

      const activateResponse = await fetch(`${apiBaseUrl}/dca/activate/${orderIdToUse}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          depositTxHash: transaction.hash
        }),
      });
      
      if (!activateResponse.ok) {
        const errorData = await activateResponse.json();
        throw new Error(errorData.message || 'Failed to activate DCA order');
      }
      
      setTxStatus("success");
      toast.success("DCA order placed successfully!");
      toast(
        "your traded funds will be sent to your wallet after the dca is completed.",
        {
          duration: 6000,
        }
      );
      // Refresh token balance
      fetchTokenBalance(fromToken);
      
    } catch (err: any) {
      console.error("Error creating DCA order:", err);
      
      let errorMessage = "Failed to create DCA order. Please try again.";
      toast.error(errorMessage);
      
      if (err.message) {
        if (err.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected in your wallet.";
        } else if (err.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for this order including gas fees.";
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setTxStatus("error");
    } finally {
      setLoading(false);
    }
  };

  // Transaction status component
  const TransactionStatus = () => {
    if (txStatus === "idle") return null;

    return (
      <div
        className={`mt-4 p-3 rounded-xl ${
          txStatus === "pending"
            ? "bg-blue-900/30 border border-blue-700/50"
            : txStatus === "success"
              ? "bg-green-900/30 border border-green-700/50"
              : "bg-red-900/30 border border-red-700/50"
        }`}
      >
        <div className="flex items-center mb-1">
          {txStatus === "pending" && <Loader2 size={16} className="animate-spin text-blue-400 mr-2" />}
          <span
            className={`text-sm font-medium ${
              txStatus === "pending" ? "text-blue-400" : txStatus === "success" ? "text-green-400" : "text-red-400"
            }`}
          >
            {txStatus === "pending"
              ? "Transaction in progress"
              : txStatus === "success"
                ? "DCA order created successfully!"
                : "Transaction failed"}
          </span>
        </div>

        {txHash && (
          <div className="text-xs text-gray-400 break-all">
            <span>Transaction: </span>
            <a
              href={`https://explorer.monad.xyz/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              {txHash.substring(0, 14)}...{txHash.substring(txHash.length - 14)}
            </a>
          </div>
        )}

        {error && txStatus === "error" && <div className="text-xs text-red-400 mt-1">{error}</div>}
      </div>
    );
  };

  return (
    <div className="w-full">
       {/* Main Content */}
       <main className="max-w-4xl mx-auto px-4">
        {/* DCA Card */}
       <div className="bg-[#2a2f35] rounded-lg p-6">
         {/* Trading Options */}
         <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={() => router.push("/")}
              className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Swap</span>
            </button>
            <button
              className="flex items-center space-x-1 text-green-500 font-medium"
            >
              <Zap className="w-4 h-4" />
              <span>DCA</span>
            </button>
            <button
              onClick={() => router.push("/limit")}
              className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
            >
              <Timer className="w-4 h-4" />
              <span>Limit</span>
            </button>
            <div className="flex-grow"></div>
            <HelpCircle className="w-5 h-5 text-gray-400" />
            <Settings className="w-5 h-5 text-gray-400" />
          </div>

          {/* Error Message */}
          {error && !txHash && (
            <div className="bg-[#332332] border border-red-400/30 rounded-xl p-3 mb-4 text-red-300 text-sm">
              <div className="flex items-start">
                <span className="mr-2">⚠️</span>
                <div>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#1c2127] rounded-lg p-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-400">I want to allocate:</div>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={allocateAmount}
                onChange={handleAllocateAmountChange}
                className="bg-transparent text-3xl outline-none w-full"
                placeholder="0"
              />
              <button 
                className="flex items-center space-x-2 px-3 py-1 rounded bg-[#2a2f35]"
                onClick={() => setShowFromTokenList(!showFromTokenList)}
              >
                <span>{fromToken?.symbol || "Select"}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              
              {showFromTokenList && (
                <div className="absolute mt-40 right-24 z-20 bg-[#2a2f35] rounded-xl p-2 shadow-lg border border-[#3a3f45] w-48">
                  {tokenlist.map((token) => (
                    <div
                      key={token.address}
                      className="flex items-center p-2 hover:bg-[#3a3f45] rounded-lg cursor-pointer transition-colors"
                      onClick={() => {
                        setFromToken(token);
                        setShowFromTokenList(false);
                      }}
                    >
                      <div className="text-white">{token.symbol}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="text-sm text-gray-400 mt-2">
              Balance: {isLoadingFromBalance ? (
                <Loader2 size={12} className="inline animate-spin ml-1" />
              ) : (
                formatAmount(fromTokenBalance)
              )}
            </div>
            
            <div className="flex justify-end space-x-4 mt-2">
              <button className="text-green-500 text-sm" onClick={() => setAllocateAmount((parseFloat(fromTokenBalance) * 0.25).toString())}>
                25%
              </button>
              <button className="text-green-500 text-sm" onClick={() => setAllocateAmount((parseFloat(fromTokenBalance) * 0.5).toString())}>
                50%
              </button>
              <button className="text-green-500 text-sm" onClick={() => setAllocateAmount((parseFloat(fromTokenBalance) * 0.75).toString())}>
                75%
              </button>
              <button className="text-green-500 text-sm" onClick={handleMaxButtonClick}>
                MAX
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex-1 bg-[#1c2127] rounded-lg p-5">
              <div className="text-sm text-gray-400 mb-2">To Buy</div>
              <div className="flex items-center">
                <button 
                  className="flex items-center space-x-2 px-3 py-1 rounded bg-[#2a2f35]"
                  onClick={() => setShowToTokenList(!showToTokenList)}
                >
                  <span>{toToken?.symbol || "Select"}</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
                
                {showToTokenList && (
                  <div className="absolute z-20 mt-1 bg-[#2a2f35] rounded-xl p-2 shadow-lg border border-[#3a3f45] w-48">
                    {tokenlist.map((token) => (
                      <div
                        key={token.address}
                        className="flex items-center p-2 hover:bg-[#3a3f45] rounded-lg cursor-pointer transition-colors"
                        onClick={() => {
                          setToToken(token);
                          setShowToTokenList(false);
                        }}
                      >
                        <div className="text-white">{token.symbol}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#1c2127] rounded-lg p-5 mt-4">
            <div className="text-sm text-gray-400 mb-3">Running Time (3 min - 7 days)</div>
            <div className="flex items-center space-x-4 mb-4">
              <input
                type="text"
                value={hours}
                onChange={handleHoursChange}
                className="w-20 bg-transparent text-2xl text-right outline-none"
                placeholder="0"
              />
              <span className="text-gray-400">Hour(s)</span>
              <input
                type="text"
                value={minutes}
                onChange={handleMinutesChange}
                className="w-20 bg-transparent text-2xl text-right outline-none"
                placeholder="30"
              />
              <span className="text-gray-400">Minute(s)</span>
            </div>
            <div className="flex space-x-6">
            <button className="text-green-500 text-sm" onClick={() => setDuration(0, 3)}>3MIN</button>
            <button className="text-green-500 text-sm" onClick={() => setDuration(0, 5)}>5MIN</button>
              <button className="text-green-500 text-sm" onClick={() => setDuration(0, 10)}>10MIN</button>
              <button className="text-green-500 text-sm" onClick={() => setDuration(1, 0)}>1H</button>
              <button className="text-green-500 text-sm" onClick={() => setDuration(4, 0)}>4H</button>
              <button className="text-green-500 text-sm" onClick={() => setDuration(24, 0)}>1D</button>
              <button className="text-green-500 text-sm" onClick={() => setDuration(72, 0)}>3D</button>
              <button className="text-green-500 text-sm" onClick={() => setDuration(168, 0)}>7D</button>
            </div>
          </div>

          {/* Transaction Status */}
          <TransactionStatus />

          <button 
            className={`w-full ${
              !activeWallet || parseFloat(allocateAmount) <= 0 || loading
                ? "bg-[#1c2127] text-gray-400"
                : "bg-green-500 text-white hover:bg-green-600 transition-colors"
            } rounded-lg py-5 mt-4 text-lg ${loading ? "cursor-not-allowed" : ""}`}
            disabled={!activeWallet || parseFloat(allocateAmount) <= 0 || loading}
            onClick={handleCreateDCA}
          >
            {loading 
              ? "Processing..." 
              : !activeWallet 
                ? "Connect Wallet" 
                : parseFloat(allocateAmount) <= 0 
                  ? "Enter an amount" 
                  : "Create Trade Order"}
          </button>
        </div>
      </main>
      </div>
  );
}

export default Dca;
