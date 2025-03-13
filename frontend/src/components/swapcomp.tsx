"use client"

import type React from "react"

import { Settings, ChevronDown, ArrowDown, Info, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from "ethers";
import { BrowserProvider } from "ethers";
import { concat, encodeAbiParameters, parseAbiParameters } from 'viem';

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

// Chain type definition
interface Chain {
  id: number
  name: string
  symbol: string
  color: string
  shortName: string
}

// Constants for native token handling
const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // Standard placeholder for native tokens

export default function SwapComponent() {
  // Token amounts
  const [fromAmount, setFromAmount] = useState("2")
  const [toAmount, setToAmount] = useState("")

  // Selected tokens
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)

  // Selected chains
  const [fromChain, setFromChain] = useState<Chain>(chains[0])
  const [toChain, setToChain] = useState<Chain>(chains[0])

  // UI states
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [showFromTokenList, setShowFromTokenList] = useState(false)
  const [showToTokenList, setShowToTokenList] = useState(false)
  const [showFromChainList, setShowFromChainList] = useState(false)
  const [showToChainList, setShowToChainList] = useState(false)
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];

  console.log("Connected wallet address:", activeWallet?.address);
  // Quote data
  const [quoteData, setQuoteData] = useState<any>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  // Add gas fee state
  const [gasFee, setGasFee] = useState<string | null>(null)
  const [route, setRoute] = useState<any>(null)

  // Add slippage
  const [slippage, setSlippage] = useState("100") // Default 1%
  const [showSlippageSettings, setShowSlippageSettings] = useState(false)

  // Add state for animation
  const [showQuoteSuccess, setShowQuoteSuccess] = useState(false)

  // Add transaction state
  const [isSwapping, setIsSwapping] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [txError, setTxError] = useState<string | null>(null)

  // Initialize default tokens
  useEffect(() => {
    setFromToken(tokenlist.find((t) => t.symbol === "MON") || tokenlist[0])
    setToToken(tokenlist.find((t) => t.symbol === "DAK") || tokenlist[5])
  }, [])

  // Fetch quote when tokens or amounts change
  useEffect(() => {
    if (fromToken && toToken && fromAmount && Number.parseFloat(fromAmount) > 0) {
      fetchQuote()
    }
  }, [fromToken, toToken, fromAmount])

  // Format amount with commas
  const formatAmount = (amount: string) => {
    if (!amount) return ""

    // Remove existing commas
    const value = amount.replace(/,/g, "")

    // Check if it's a valid number
    if (!/^\d*\.?\d*$/.test(value)) return amount

    const num = parseFloat(value)
    
    // Handle very small numbers
    if (num < 0.000001) {
      return num.toFixed(10).replace(/\.?0+$/, '') // Remove trailing zeros
    }

    // For normal numbers, format with commas
    const parts = value.split(".")

    // Format the integer part with commas
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")

    // Join back with decimal part if exists
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0]
  }

  // Handle from amount change
  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "")
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setFromAmount(value)
    }
  }

  // Add blur handler for from amount input
  const handleFromAmountBlur = () => {
    fetchQuote()
  }

  // Fetch quote from API with improved error handling
  const fetchQuote = async () => {
    if (!fromToken || !toToken || !fromAmount || Number.parseFloat(fromAmount) === 0) {
      setToAmount("")
      setGasFee(null)
      setRoute(null)
      return
    }

    setIsLoadingQuote(true)
    setQuoteError(null)

    try {
      // Convert fromAmount to wei (18 decimals)
      const fromAmountInWei = BigInt(Math.floor(Number.parseFloat(fromAmount) * 10 ** 18)).toString()

      // Use the connected wallet address as taker if available, otherwise use a fallback
      const takerAddress = activeWallet?.address || ""
      
      // Use the actual address for tokens, not the string "NATIVE"
      const fromTokenAddress = fromToken.isNative 
        ? NATIVE_TOKEN_ADDRESS  // Use the actual native token address
        : fromToken.address
      
      const toTokenAddress = toToken.isNative
        ? NATIVE_TOKEN_ADDRESS  // Use the actual native token address
        : toToken.address
      
      // Add slippage parameter - default 1% (100 basis points)
      const slippageBps = "100"
      
      const response = await fetch(
        `/api/price?fromAmount=${fromAmountInWei}&fromToken=${fromTokenAddress}&toToken=${toTokenAddress}&taker=${takerAddress}&slippageBps=${slippageBps}`
      )
      const data = await response.json()

      if (response.ok) {
        // Convert buyAmount from wei (18 decimals) back to decimal
        const buyAmountInWei = BigInt(data.buyAmount)
        const buyAmount = Number(buyAmountInWei) / (10 ** 18)
        
        // Format the amount based on size
        let formattedAmount
        if (buyAmount < 0.000001) {
          // For very small numbers, show more decimals
          formattedAmount = buyAmount.toLocaleString('fullwide', {
            useGrouping: false,
            minimumFractionDigits: 0,
            maximumFractionDigits: 18
          }).replace(/\.?0+$/, '') // Remove trailing zeros
        } else if (buyAmount < 1) {
          // For numbers less than 1, show 6 decimals
          formattedAmount = buyAmount.toFixed(6)
        } else {
          // For numbers >= 1, show 2 decimals
          formattedAmount = buyAmount.toFixed(2)
        }
        
        setToAmount(formattedAmount)
        setQuoteData({
          ...data,
          price: buyAmount
        })
        
        // Use the pre-calculated gas fee from API if available
        if (data.estimatedGasCostInETH) {
          setGasFee(data.estimatedGasCostInETH + " ETH")
        } else if (data.transaction && data.transaction.gas && data.transaction.gasPrice) {
          const gasCost = BigInt(data.transaction.gas) * BigInt(data.transaction.gasPrice)
          const gasCostInETH = Number(gasCost) / 10**18
          setGasFee(gasCostInETH.toFixed(6) + " ETH")
        } else if (data.totalNetworkFee) {
          const networkFeeInETH = Number(BigInt(data.totalNetworkFee)) / 10**18
          setGasFee(networkFeeInETH.toFixed(6) + " ETH")
        } else {
          setGasFee(null)
        }
        
        // Set route information
        if (data.route) {
          setRoute(data.route)
        }
        
        // Show success info if available
        if (data.uiMessage) {
          // You could add a success message toast here
          console.log(data.uiMessage)
        }

        // Trigger success animation
        setShowQuoteSuccess(true)
        setTimeout(() => setShowQuoteSuccess(false), 2000)
      } else {
        // Use the UI-friendly message if available
        setQuoteError(data.uiMessage || data.error || "Failed to fetch quote.")
        setToAmount("")
        setGasFee(null)
        setRoute(null)
        
        // If error is recoverable, we might want to suggest actions
        if (data.recoverable) {
          // Could add suggestion UI here
        }
      }
    } catch (error) {
      console.error("Error fetching quote:", error)
      setQuoteError("Failed to fetch quote. Please try again.")
      setToAmount("")
      setGasFee(null)
      setRoute(null)
    } finally {
      setIsLoadingQuote(false)
    }
  }

  // Calculate USD value (simplified - in production this would use real price data)
  const calculateUsdValue = (amount: string, token: Token | null) => {
    if (!amount || !token) return "$0.00"

    // This is a simplified example - in production you would use real price data
    const tokenPrices: Record<string, number> = {
      WETH: 2611.2,
      USDT: 1.0,
      USDC: 1.0,
      WBTC: 61000.0,
      WMON: 0.5,
      DAK: 0.1,
    }

    const price = tokenPrices[token.symbol] || 0
    const value = Number.parseFloat(amount.replace(/,/g, "")) * price

    // Return the amount with the token symbol
    return `${token.symbol} ${Number.parseFloat(amount.replace(/,/g, "")).toFixed(2)}`
  }

  // Swap tokens
  const handleSwapTokens = () => {
    const tempToken = fromToken
    setFromToken(toToken)
    setToToken(tempToken)

    const tempChain = fromChain
    setFromChain(toChain)
    setToChain(tempChain)

    // Reset amounts to trigger a new quote
    setFromAmount("1")
    setToAmount("")
  }

  // Exchange rate display
  const getExchangeRate = () => {
    if (!quoteData || !fromToken || !toToken) {
      return `1 ${fromToken?.symbol || ""} = ? ${toToken?.symbol || ""}`
    }

    const rate = Number.parseFloat(quoteData.price)
    return `1 ${fromToken.symbol} = ${rate.toFixed(6)} ${toToken.symbol} (${calculateUsdValue("1", fromToken)})`
  }

  // Fee display
  const getFeeInfo = () => {
    if (!quoteData) return "-"

    // Extract fee from quote data
    const feePercentage = quoteData.estimatedPriceImpact ? Number.parseFloat(quoteData.estimatedPriceImpact) : 0

    return `${feePercentage.toFixed(2)}%`
  }

  // Add function to display route path
  const getRoutePath = () => {
    if (!route || !route.tokens) return null;
    
    return (
      <div className="flex items-center text-xs text-gray-400 mt-1">
        <span>Route: </span>
        {route.tokens.map((token: any, index: number) => (
          <div key={token.address} className="flex items-center">
            <span>{token.symbol}</span>
            {index < route.tokens.length - 1 && <span className="mx-1">→</span>}
          </div>
        ))}
      </div>
    );
  };

  // Add Max functionality for MON
  const handleMaxButtonClick = async () => {
    if (!activeWallet?.address) {
      // If no wallet is connected, just use a placeholder value
      setFromAmount("10")
      return
    }

    // If MON is selected, fetch actual balance
    if (fromToken?.symbol === "MON") {
      try {
        const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz")
        const balanceWei = await provider.getBalance(activeWallet.address)
        
        // Leave a small amount for gas (0.01 MON)
        const reservedForGas = ethers.parseEther("0.01")
        
        // If balance is less than reserved amount, use zero
        const availableBalanceWei = balanceWei > reservedForGas 
          ? balanceWei - reservedForGas
          : BigInt(0)
        
        const balanceMON = ethers.formatEther(availableBalanceWei)
        setFromAmount(balanceMON)
      } catch (error) {
        console.error("Error fetching MON balance:", error)
        setFromAmount("0")
      }
    } else {
      // For other tokens, use placeholder (in a real app, you'd fetch token balances)
      setFromAmount("10")
    }
  }

  // Add this component somewhere in your UI
  const SlippageSelector = () => (
    <div className="bg-[#0d141f] rounded-xl p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-400 text-sm">Slippage Tolerance</span>
        <button 
          onClick={() => setShowSlippageSettings(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      <div className="flex space-x-2 mb-2">
        {["0.5", "1.0", "2.0"].map(value => (
          <button
            key={value}
            onClick={() => setSlippage((parseFloat(value) * 100).toString())}
            className={`px-4 py-2 rounded-lg text-sm ${
              slippage === (parseFloat(value) * 100).toString() 
                ? "bg-[#77b5fe] text-black" 
                : "bg-[#1a2232] text-white"
            }`}
          >
            {value}%
          </button>
        ))}
        
        <div className="relative flex-1">
          <input
            type="text"
            value={(parseInt(slippage) / 100).toFixed(1)}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              if (!isNaN(val) && val > 0 && val <= 50) {
                setSlippage((val * 100).toString())
              }
            }}
            className="w-full px-4 py-2 bg-[#1a2232] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#77b5fe]"
          />
          <div className="absolute right-3 top-2 text-gray-400">%</div>
        </div>
      </div>
      
      <div className="text-xs text-gray-400">
        Your transaction will revert if the price changes unfavorably by more than this percentage.
      </div>
    </div>
  )

  // Error message component with improved UX
  const ErrorMessage = ({ error }: { error: string | null }) => {
    if (!error) return null
    
    return (
      <div className="bg-[#332332] border border-red-400/30 rounded-xl p-3 mb-4 text-red-300 text-sm">
        <div className="flex items-start">
          <span className="mr-2">⚠️</span>
          <div>
            <p>{error}</p>
            {error.includes("liquidity") && (
              <p className="mt-1 text-xs">Try reducing the swap amount or choosing different tokens.</p>
            )}
            {error.includes("temporarily") && (
              <button 
                onClick={fetchQuote}
                className="mt-2 bg-red-400/20 hover:bg-red-400/30 text-red-300 px-3 py-1 rounded-md text-xs"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Execute the swap
  const executeSwap = async () => {
    if (!activeWallet || !quoteData || !fromToken || !toToken) {
      setTxError("Wallet not connected or quote not available")
      return
    }

    setIsSwapping(true)
    setTxStatus('pending')
    setTxError(null)
    setTxHash(null)

    try {
      console.log("Quote data:", quoteData); // Debug log
      
      // Check for the transaction object and 'to' address location
      if (!quoteData.transaction || !quoteData.transaction.to || !quoteData.transaction.to.startsWith('0x')) {
        throw new Error("Invalid or missing 'to' address in quote data");
      }
      
      // Create transaction object - using the correct path to transaction data
      const tx = {
        to: quoteData.transaction.to,
        data: quoteData.transaction.data,
        value: quoteData.transaction.value || "0", // Use the value from transaction object
        gasLimit: quoteData.transaction.gas 
          ? BigInt(Math.floor(Number(quoteData.transaction.gas) * 1.2)).toString()
          : undefined
      };
      
      console.log("Transaction object:", tx); // Debug log
      
      // Handle Permit2 if present in the quote (not needed for your current response)
      if (quoteData.permit2 && quoteData.permit2.eip712) {
        // Permit2 handling (your response shows permit2: null, so this won't execute)
        const ethereumProvider = await activeWallet.getEthereumProvider();
        const ethersProvider = new BrowserProvider(ethereumProvider);
        const signer = await ethersProvider.getSigner();
        
        // Sign and append the permit as described in the docs
        // ...code for Permit2 handling...
      }
      
      // Get provider and signer
      const ethereumProvider = await activeWallet.getEthereumProvider();
      const ethersProvider = new BrowserProvider(ethereumProvider);
      const signer = await ethersProvider.getSigner();

      // Send the transaction with all necessary fields
      console.log("Sending transaction:", tx);
      const transaction = await signer.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gasLimit: tx.gasLimit
      });
      
      setTxHash(transaction.hash);
      console.log("Transaction sent:", transaction.hash);

      // Wait for transaction confirmation
      console.log("Waiting for transaction confirmation...");
      const receipt = await transaction.wait();
      
      if (receipt && receipt.status === 1) {
        console.log("Swap transaction successful!");
        setTxStatus('success');
        
        // Reset amount inputs after successful swap
        setFromAmount("");
        setToAmount("");
        
        // Trigger success animation
        setShowQuoteSuccess(true);
        setTimeout(() => setShowQuoteSuccess(false), 2000);
      } else {
        console.error("Transaction failed:", receipt);
        setTxStatus('error');
        setTxError("Transaction failed. Please check your wallet for details.");
      }
    } catch (error) {
      console.error("Error executing swap:", error);
      
      // Provide user-friendly error message
      let errorMessage = "Failed to execute swap. Please try again.";
      
      if (error instanceof Error) {
        console.log("Error message:", error.message);
        
        // Parse common errors
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected in your wallet.";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for this swap including gas fees.";
        } else if (error.message.includes("gas required exceeds")) {
          errorMessage = "Transaction would fail - likely due to slippage or gas issues.";
        } else if (error.message.includes("Invalid")) {
          errorMessage = error.message; // Use the exact error for clarity
        }
      }
      
      setTxStatus('error');
      setTxError(errorMessage);
    } finally {
      setIsSwapping(false);
    }
  };

  // Add transaction status component
  const TransactionStatus = () => {
    if (txStatus === 'idle') return null
    
    return (
      <div className={`mt-4 p-3 rounded-xl ${
        txStatus === 'pending' ? 'bg-blue-900/30 border border-blue-700/50' :
        txStatus === 'success' ? 'bg-green-900/30 border border-green-700/50' : 
        'bg-red-900/30 border border-red-700/50'
      }`}>
        <div className="flex items-center mb-1">
          {txStatus === 'pending' && (
            <Loader2 size={16} className="animate-spin text-blue-400 mr-2" />
          )}
          <span className={`text-sm font-medium ${
            txStatus === 'pending' ? 'text-blue-400' :
            txStatus === 'success' ? 'text-green-400' : 
            'text-red-400'
          }`}>
            {txStatus === 'pending' ? 'Transaction in progress' :
             txStatus === 'success' ? 'Swap successful!' : 
             'Transaction failed'}
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
        
        {txError && <div className="text-xs text-red-400 mt-1">{txError}</div>}
      </div>
    )
  }

  return (
    <div>
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-[#131b29] rounded-3xl w-full max-w-md p-6 border border-[#1f2937] shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-white text-xl font-semibold">Swap</h2>
            <div className="flex space-x-2">
              <button 
                className="text-gray-400 hover:text-gray-300 transition-colors"
                onClick={() => setShowSlippageSettings(!showSlippageSettings)}
              >
                <Settings size={20} />
              </button>
            </div>
          </div>

          {/* From Section */}
          <div className="bg-[#0d141f] rounded-xl p-4 mb-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">FROM</span>
              <div
                className="flex items-center bg-[#1a2232] rounded-full px-2 py-1 cursor-pointer hover:bg-[#232d40] transition-colors"
                onClick={() => setShowFromChainList(!showFromChainList)}
              >
                <div className={`w-5 h-5 rounded-full ${fromChain.color} flex items-center justify-center mr-1`}>
                  <span className="text-white text-xs">{fromChain.shortName}</span>
                </div>
                <span className="text-white text-sm mr-1">{fromChain.name}</span>
                <ChevronDown size={16} className="text-gray-400" />
              </div>
            </div>

            {showFromChainList && (
              <div className="absolute z-20 mt-1 bg-[#1a2232] rounded-xl p-2 shadow-lg border border-[#2a3548] w-48">
                {chains.map((chain) => (
                  <div
                    key={chain.id}
                    className="flex items-center p-2 hover:bg-[#232d40] rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      setFromChain(chain)
                      setShowFromChainList(false)
                    }}
                  >
                    <div className={`w-5 h-5 rounded-full ${chain.color} flex items-center justify-center mr-2`}>
                      <span className="text-white text-xs">{chain.shortName}</span>
                    </div>
                    <span className="text-white text-sm">{chain.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center">
              <div
                className="flex items-center cursor-pointer hover:bg-[#1a2232] p-1 rounded-lg transition-colors"
                onClick={() => setShowFromTokenList(!showFromTokenList)}
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-2">
                  <span className="text-white">{fromToken?.symbol?.charAt(0) || "T"}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-white text-xl font-semibold mr-1">{fromToken?.symbol || "Select"}</span>
                  <ChevronDown size={20} className="text-gray-400" />
                </div>
              </div>
              <input
                type="text"
                value={fromAmount}
                onChange={handleFromAmountChange}
                onBlur={handleFromAmountBlur}
                className="bg-transparent text-white text-3xl text-right w-1/2 focus:outline-none"
                placeholder="0.0"
              />
            </div>

            {showFromTokenList && (
              <div className="absolute z-20 mt-1 bg-[#1a2232] rounded-xl p-2 shadow-lg border border-[#2a3548] max-h-60 overflow-y-auto w-64">
                {tokenlist.map((token) => (
                  <div
                    key={token.address}
                    className="flex items-center p-2 hover:bg-[#232d40] rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      setFromToken(token)
                      setShowFromTokenList(false)
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-2">
                      <span className="text-white">{token.symbol.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="text-white font-medium">{token.symbol}</div>
                      <div className="text-gray-400 text-xs">{token.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-2">
              <button
                className="bg-[#1a2232] text-gray-400 text-xs px-3 py-1 rounded-md hover:bg-[#232d40] transition-colors"
                onClick={handleMaxButtonClick}
              >
                Max
              </button>
              <span className="text-gray-400 text-sm">{calculateUsdValue(fromAmount, fromToken)}</span>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center -my-3 relative z-10">
            <button
              className="bg-[#1a2232] p-3 rounded-full hover:bg-[#232d40] transition-colors"
              onClick={handleSwapTokens}
            >
              <ArrowDown size={20} className="text-gray-400" />
            </button>
          </div>

          {/* To Section */}
          <div className="bg-[#0d141f] rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">TO</span>
              <div
                className="flex items-center bg-[#1a2232] rounded-full px-2 py-1 cursor-pointer hover:bg-[#232d40] transition-colors"
                onClick={() => setShowToChainList(!showToChainList)}
              >
                <div className={`w-5 h-5 rounded-full ${toChain.color} flex items-center justify-center mr-1`}>
                  <span className="text-white text-xs">{toChain.shortName}</span>
                </div>
                <span className="text-white text-sm mr-1">{toChain.name}</span>
                <ChevronDown size={16} className="text-gray-400" />
              </div>
            </div>

            {showToChainList && (
              <div className="absolute z-20 mt-1 bg-[#1a2232] rounded-xl p-2 shadow-lg border border-[#2a3548] w-48">
                {chains.map((chain) => (
                  <div
                    key={chain.id}
                    className="flex items-center p-2 hover:bg-[#232d40] rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      setToChain(chain)
                      setShowToChainList(false)
                    }}
                  >
                    <div className={`w-5 h-5 rounded-full ${chain.color} flex items-center justify-center mr-2`}>
                      <span className="text-white text-xs">{chain.shortName}</span>
                    </div>
                    <span className="text-white text-sm">{chain.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center">
              <div
                className="flex items-center cursor-pointer hover:bg-[#1a2232] p-1 rounded-lg transition-colors"
                onClick={() => setShowToTokenList(!showToTokenList)}
              >
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center mr-2">
                  <span className="text-white">{toToken?.symbol?.charAt(0) || "T"}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-white text-xl font-semibold mr-1">{toToken?.symbol || "Select"}</span>
                  <ChevronDown size={20} className="text-gray-400" />
                </div>
              </div>
              <div className={`text-white text-3xl text-right w-1/2 ${showQuoteSuccess ? 'animate-pulse text-green-400' : ''}`}>
                {isLoadingQuote ? (
                  <div className="flex justify-end items-center h-[36px]">
                    <div className="bg-[#1a2232] rounded-md h-8 w-24 animate-pulse"></div>
                  </div>
                ) : (
                  formatAmount(toAmount)
                )}
              </div>
            </div>

            {showToTokenList && (
              <div className="absolute z-20 mt-1 bg-[#1a2232] rounded-xl p-2 shadow-lg border border-[#2a3548] max-h-60 overflow-y-auto w-64">
                {tokenlist.map((token) => (
                  <div
                    key={token.address}
                    className="flex items-center p-2 hover:bg-[#232d40] rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      setToToken(token)
                      setShowToTokenList(false)
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center mr-2">
                      <span className="text-white">{token.symbol.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="text-white font-medium">{token.symbol}</div>
                      <div className="text-gray-400 text-xs">{token.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-2">
              <div className="w-12"></div> {/* Spacer to align with the "Max" button on the From section */}
              <span className="text-gray-400 text-sm">{calculateUsdValue(toAmount, toToken)}</span>
            </div>
          </div>

        

          {/* Exchange Rate */}
          <div className="flex justify-between items-center mb-2 text-sm">
            <span className="text-gray-400">{getExchangeRate()}</span>
            <div className="flex items-center text-gray-400">
              <span className="mr-1">FEE: {getFeeInfo()}</span>
              <Info size={14} className="cursor-help" />
            </div>
          </div>

          {/* Add Gas Fee and Route Info */}
          <div className="flex flex-col mb-4">
            {gasFee && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Gas fee:</span>
                <span className="text-gray-400">{gasFee}</span>
              </div>
            )}
            {route && getRoutePath()}
          </div>

          {/* Error Message */}
          <ErrorMessage error={quoteError} />

          {/* Add conditional rendering for slippage settings */}
          {showSlippageSettings && <SlippageSelector />}
          
          {/* Transaction Status */}
          <TransactionStatus />

          {/* Swap Button */}
          <button
            className="w-full bg-gradient-to-r from-[#5edfff] to-[#77b5fe] text-black font-semibold py-4 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            disabled={isLoadingQuote || isSwapping || !fromToken || !toToken || !fromAmount || !toAmount || !activeWallet}
            onClick={executeSwap}
          >
            {isLoadingQuote ? "Loading Quote..." : 
             isSwapping ? "Swapping..." :
             !activeWallet ? "Connect Wallet to Swap" :
             "Swap"}
          </button>
          
          {/* Add wallet connection prompt if needed */}
          {!activeWallet && (
            <div className="text-center text-xs text-gray-400 mt-2">
              You need to connect a wallet to perform a swap
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Token list from the original component
const tokenlist: Token[] = [
  {
    name: "Monad",
    decimals: 18,
    symbol: "MON",
    address: NATIVE_TOKEN_ADDRESS,  // Use the constant for consistency
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
]

// Chain list
const chains: Chain[] = [
  {
    id: 10143,
    name: "Monad",
    symbol: "MON",
    color: "bg-red-500",
    shortName: "M",
  }
]

