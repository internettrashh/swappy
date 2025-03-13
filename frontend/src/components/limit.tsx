"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRightLeft,
  Timer,
  Zap,
  HelpCircle,
  Settings,
  ChevronDown,
  Loader2,
  ArrowUp,
  ArrowDown,
  Info,
} from "lucide-react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { ethers } from "ethers"
import { BrowserProvider } from "ethers"
import { toast } from "react-hot-toast"
import axios from "axios"

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
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
]

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
]

// Master wallet address (you should move this to environment variables or get from API)
const MASTER_WALLET_ADDRESS = "0x0015d013510C40a5779Beb25a6Cd0654A1f33aF8"

function Limit() {
  const router = useRouter()
  const { ready } = usePrivy()
  const { wallets } = useWallets()
  const activeWallet = wallets[0]

  // State for input values
  const [sellAmount, setSellAmount] = useState("")
  const [buyAmount, setBuyAmount] = useState("")
  const [targetPrice, setTargetPrice] = useState("")

  // Direction state (above or below current price)
  const [direction, setDirection] = useState<"above" | "below">("above")

  // Token selection
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)
  const [showFromTokenList, setShowFromTokenList] = useState(false)
  const [showToTokenList, setShowToTokenList] = useState(false)

  // Token balances
  const [fromTokenBalance, setFromTokenBalance] = useState("0")
  const [toTokenBalance, setToTokenBalance] = useState("0")
  const [isLoadingFromBalance, setIsLoadingFromBalance] = useState(false)
  const [isLoadingToBalance, setIsLoadingToBalance] = useState(false)

  // Expiry selection
  const [expiry, setExpiry] = useState<string>("24h") // Default to 24 hours

  // Order status
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle")

  // Add these new state variables
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)
  const [currentPrice, setCurrentPrice] = useState<string | null>(null)

  // Initialize default tokens
  useEffect(() => {
    // Default MON as source token and DAK as target token
    setFromToken(tokenlist.find((t) => t.symbol === "MON") || tokenlist[0])
    setToToken(tokenlist.find((t) => t.symbol === "DAK") || tokenlist[6])
  }, [])

  // Fetch balances when tokens or wallet changes
  useEffect(() => {
    if (fromToken && activeWallet?.address) {
      fetchTokenBalance(fromToken, true)
    }
    if (toToken && activeWallet?.address) {
      fetchTokenBalance(toToken, false)
    }
  }, [fromToken, toToken, activeWallet?.address])

  // Function to fetch token balance
  const fetchTokenBalance = async (token: Token, isFromToken: boolean) => {
    if (!activeWallet?.address) {
      if (isFromToken) setFromTokenBalance("0")
      else setToTokenBalance("0")
      return
    }

    try {
      if (isFromToken) setIsLoadingFromBalance(true)
      else setIsLoadingToBalance(true)

      const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz")

      // If it's a native token (MON)
      if (token.isNative) {
        const balanceWei = await provider.getBalance(activeWallet.address)
        const balanceFormatted = ethers.formatEther(balanceWei)
        if (isFromToken) setFromTokenBalance(balanceFormatted)
        else setToTokenBalance(balanceFormatted)
      }
      // If it's an ERC20 token
      else {
        const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider)

        // Get token decimals (use the one from token object or fetch from contract)
        let decimals = token.decimals
        try {
          decimals = await tokenContract.decimals()
        } catch (error) {
          console.log("Using default decimals from token object:", decimals)
        }

        // Get balance
        const balance = await tokenContract.balanceOf(activeWallet.address)
        const balanceFormatted = ethers.formatUnits(balance, decimals)
        if (isFromToken) setFromTokenBalance(balanceFormatted)
        else setToTokenBalance(balanceFormatted)
      }
    } catch (error) {
      console.error(`Error fetching ${token.symbol} balance:`, error)
      if (isFromToken) setFromTokenBalance("0")
      else setToTokenBalance("0")
    } finally {
      if (isFromToken) setIsLoadingFromBalance(false)
      else setIsLoadingToBalance(false)
    }
  }

  // Swap fromToken and toToken
  const swapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    setSellAmount("")
    setBuyAmount("")
    setTargetPrice("")
  }

  // Handle amount change
  const handleSellAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "")
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setSellAmount(value)
    }
  }

  // Handle buy amount change
  const handleBuyAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "")
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setBuyAmount(value)
    }
  }

  // Handle target price change
  const handleTargetPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "")
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setTargetPrice(value)
    }
  }

  // Format amount with commas
  const formatAmount = (amount: string) => {
    if (!amount) return ""

    // Remove existing commas
    const value = amount.replace(/,/g, "")

    // Check if it's a valid number
    if (!/^\d*\.?\d*$/.test(value)) return amount

    const num = Number.parseFloat(value)

    // Handle very small numbers
    if (num < 0.000001) {
      return num.toFixed(10).replace(/\.?0+$/, "") // Remove trailing zeros
    }

    // For normal numbers, format with commas
    const parts = value.split(".")

    // Format the integer part with commas
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")

    // Join back with decimal part if exists
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0]
  }

  // Handle Max button click
  const handleMaxButtonClick = async () => {
    if (!activeWallet?.address || !fromToken) {
      return
    }

    // If it's the native token, leave some for gas
    if (fromToken.isNative) {
      const balance = Number.parseFloat(fromTokenBalance)
      const reservedForGas = 0.01 // Reserve 0.01 for gas
      const availableBalance = balance > reservedForGas ? (balance - reservedForGas).toString() : "0"
      setSellAmount(availableBalance)
    } else {
      // For ERC20 tokens, use the full balance
      setSellAmount(fromTokenBalance)
    }
  }

  // Set percentage of balance
  const setPercentage = (percent: number) => {
    const balance = Number.parseFloat(fromTokenBalance)
    if (balance > 0) {
      const amount = (balance * percent).toString()
      setSellAmount(amount)
    }
  }

  // Set expiry time
  const handleExpiryChange = (expiryValue: string) => {
    setExpiry(expiryValue)
  }

  // Calculate expiry date based on selected expiry
  const calculateExpiryDate = (): Date => {
    const now = new Date()

    switch (expiry) {
      case "1h":
        return new Date(now.getTime() + 1 * 60 * 60 * 1000)
      case "4h":
        return new Date(now.getTime() + 4 * 60 * 60 * 1000)
      case "24h":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000)
      case "3d":
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
      case "7d":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000) // Default to 24 hours
    }
  }

  // Create Limit order
  const handleCreateLimitOrder = async () => {
    if (!activeWallet || !fromToken || !toToken) {
      setError("Please connect your wallet and select tokens")
      return
    }

    if (Number.parseFloat(sellAmount) <= 0) {
      setError("Please enter a valid amount to sell")
      return
    }

    if (Number.parseFloat(targetPrice) <= 0) {
      setError("Please enter a valid target price")
      return
    }

    setLoading(true)
    setError(null)
    setTxStatus("idle")

    try {
      // Get API base URL from environment variable
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""

      // Get token addresses
      const sourceTokenAddress = fromToken.address
      const targetTokenAddress = toToken.address

      // Parse amount to wei (using token decimals)
      const amountInWei = ethers.parseUnits(sellAmount, fromToken.decimals).toString()

      // Calculate expiry date
      const expiryDate = calculateExpiryDate().toISOString()

      // Use wallet address as user ID
      const userWalletAddress = activeWallet.address

      // Step 1: Create Limit order in the API
      const createOrderResponse = await fetch(`${apiBaseUrl}/api/limit/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userWalletAddress,
          sourceToken: sourceTokenAddress,
          targetToken: targetTokenAddress,
          amount: amountInWei,
          targetPrice: targetPrice,
          direction: direction,
          userWalletAddress,
          expiryDate,
        }),
      })

      if (!createOrderResponse.ok) {
        const errorData = await createOrderResponse.json()
        throw new Error(errorData.message || "Failed to create limit order")
      }

      const orderData = await createOrderResponse.json()
      console.log("Order data received:", orderData)

      // Check if order ID exists - update to use correct path
      if (!orderData?.order?._id) {
        throw new Error("Invalid order data returned from server - missing order ID")
      }

      setOrderId(orderData.order._id)

      // Step 2: Transfer tokens to master wallet
      setTxStatus("pending")

      // Get Ethereum provider and signer
      const ethereumProvider = await activeWallet.getEthereumProvider()
      const ethersProvider = new BrowserProvider(ethereumProvider)
      const signer = await ethersProvider.getSigner()

      let transaction

      // If it's a native token (like MON), send directly
      if (fromToken.isNative) {
        // Prepare transaction object without gasLimit initially
        const txParams = {
          to: MASTER_WALLET_ADDRESS,
          value: amountInWei,
          chainId: 10143, // Monad testnet
        }

        try {
          // Estimate the gas needed for this transaction
          const estimatedGas = await signer.estimateGas(txParams)

          // Add some buffer to the estimated gas (e.g., 20% more)
          const gasLimit = BigInt(Math.floor(Number(estimatedGas) * 1.2))

          // Create a new transaction object with the gas limit
          const txWithGas = {
            ...txParams,
            gasLimit: gasLimit,
          }

          // Send the transaction
          transaction = await signer.sendTransaction(txWithGas)
        } catch (error) {
          console.error("Error estimating gas:", error)
          throw error
        }
      }
      // If it's an ERC20 token, approve and transfer
      else {
        // Create contract instance with signer
        const tokenContract = new ethers.Contract(fromToken.address, ERC20_ABI, signer)

        // Approve the master wallet to spend tokens
        const approveTx = await tokenContract.approve(MASTER_WALLET_ADDRESS, amountInWei)
        await approveTx.wait()

        // Now transfer the tokens to the master wallet
        // Note: You may need a separate contract function for this depending on your setup
        transaction = approveTx // In this example we're just tracking the approve transaction
      }

      setTxHash(transaction.hash)

      // Wait for transaction confirmation
      await transaction.wait()

      // Step 3: Activate the limit order with the transaction hash
      const orderIdToUse = orderData.order._id ;
      console.log("Order ID to use:", orderIdToUse);
      if (!orderIdToUse) {
        throw new Error("Cannot activate order: missing order ID")
      }
      await new Promise(r => setTimeout(r, 2000));

      const activateResponse = await fetch(`${apiBaseUrl}/api/limit/activate/${orderIdToUse}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          depositTxHash: transaction.hash,
        }),
      })

      if (!activateResponse.ok) {
        const errorData = await activateResponse.json()
        throw new Error(errorData.message || "Failed to activate limit order")
      }

      setTxStatus("success")
      toast.success("Limit order placed successfully!")
      toast("Your order will execute when the target price is reached.", {
        duration: 6000,
      })
      // Refresh token balance
      fetchTokenBalance(fromToken, true)
    } catch (err: any) {
      console.error("Error creating limit order:", err)

      let errorMessage = "Failed to create limit order. Please try again."
      toast.error(errorMessage)

      if (err.message) {
        if (err.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected in your wallet."
        } else if (err.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for this order including gas fees."
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
      setTxStatus("error")
    } finally {
      setLoading(false)
    }
  }

  // Transaction status component
  const TransactionStatus = () => {
    if (txStatus === "idle") return null

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
                ? "Limit order created successfully!"
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
    )
  }

  // Add this function to fetch the current price from the 0x API
  const fetchCurrentPrice = async () => {
    if (!fromToken || !toToken) {
      toast.error("Please select both tokens")
      return
    }
    
    setIsLoadingPrice(true)
    
    try {
      // Fix parameter naming to match backend
      const response = await axios.get('/api/pricequote', {
        params: {
          sellAmount: ethers.parseUnits('1', toToken.decimals).toString(),
          sellToken: toToken.address,
          buyToken: fromToken.address,
          taker: activeWallet?.address 
        }
      })
      
      // Calculate and set the price
      console.log(response);
      if (response.data && response.data.buyAmount && response.data.sellAmount) {
        // Calculate price: sellAmount / buyAmount
        // Both amounts are in wei, so we convert them to ethers as BigInt first
        const sellAmountBigInt = BigInt(response.data.sellAmount);
        const buyAmountBigInt = BigInt(response.data.buyAmount);
        
        const formattedBuyAmount = ethers.formatUnits(buyAmountBigInt, 18);

        const calculatedPrice = formattedBuyAmount; // Store formatted buyAmount
        
        console.log("Calculated price:", calculatedPrice);
        setCurrentPrice(calculatedPrice);
        setTargetPrice(calculatedPrice); // Set as the default target price
      } else {
        throw new Error("Price data not available in API response")
      }
      
      toast.success("Price fetched successfully!")
    } catch (error) {
      console.error("Failed to fetch price:", error)
      toast.error("Failed to fetch current price. Please try again.")
    } finally {
      setIsLoadingPrice(false)
    }
  }
  
  // Add this function to calculate the buy amount based on sell amount and target price
  const calculateBuyAmount = () => {
    if (sellAmount && targetPrice && Number(targetPrice) > 0) {
      // If direction is "above", user will get fewer target tokens (higher price)
      // If direction is "below", user will get more target tokens (lower price)
      const calculatedAmount = Number(sellAmount) / Number(targetPrice)
      setBuyAmount(calculatedAmount.toString())
    } else {
      setBuyAmount("")
    }
  }
  
  // Call calculateBuyAmount when sellAmount or targetPrice changes
  useEffect(() => {
    calculateBuyAmount()
  }, [sellAmount, targetPrice])
  
  // Update the useEffect to automatically fetch price when tokens change
  useEffect(() => {
    if (fromToken && toToken && fromToken.address !== toToken.address) {
      // Automatically fetch price when tokens are selected
      fetchCurrentPrice()
    }
  }, [fromToken, toToken])

  return (
    <div className="w-full">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4">
        {/* Limit Order Card */}
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
              onClick={() => router.push("/dca")}
              className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
            >
              <Zap className="w-4 h-4" />
              <span>DCA</span>
            </button>
            <button className="flex items-center space-x-1 text-green-500 font-medium">
              <Timer className="w-4 h-4" />
              <span>Limit</span>
            </button>
            <div className="flex-grow"></div>
           
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

          {/* Price Input - Updated version with fetch button */}
          <div className="bg-[#1c2127] rounded-lg p-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-400">When 1 {toToken?.symbol} is worth </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setDirection("above")}
                  className={`text-xs px-2 py-1 rounded flex items-center ${direction === "above" ? "bg-green-600" : "bg-[#2a2f35]"}`}
                >
                  <ArrowUp size={12} className="mr-1" />
                  More than
                </button>
                <button
                  onClick={() => setDirection("below")}
                  className={`text-xs px-2 py-1 rounded flex items-center ${direction === "below" ? "bg-red-600" : "bg-[#2a2f35]"}`}
                >
                  <ArrowDown size={12} className="mr-1" />
                  Less than
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={targetPrice}
                onChange={handleTargetPriceChange}
                className="bg-transparent text-3xl outline-none w-full"
                placeholder="0"
              />
              <span className="text-lg text-gray-400">{fromToken?.symbol}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-gray-400">
                {currentPrice ? `Current market price: ${currentPrice} ${fromToken?.symbol}` : "Fetch price to see market rate"}
              </div>
              <button 
                onClick={fetchCurrentPrice} 
                className="text-xs px-3 py-1 rounded bg-[#3a3f45] text-green-400 hover:bg-[#4a4f55] transition-colors flex items-center"
                disabled={isLoadingPrice}
              >
                {isLoadingPrice ? (
                  <>
                    <Loader2 size={12} className="animate-spin mr-1" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Zap size={12} className="mr-1" />
                    Get Price
                  </>
                )}
              </button>
            </div>
          </div>

         

          {/* Trading Inputs */}
          <div className="flex items-center space-x-4 mt-4">
            <div className="flex-1 bg-[#1c2127] rounded-lg p-5">
              <div className="text-sm text-gray-400 mb-2">You Sell</div>
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={sellAmount}
                  onChange={handleSellAmountChange}
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
                          setFromToken(token)
                          setShowFromTokenList(false)
                        }}
                      >
                        <div className="text-white">{token.symbol}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-400 mt-2">
                Balance:{" "}
                {isLoadingFromBalance ? (
                  <Loader2 size={12} className="inline animate-spin ml-1" />
                ) : (
                  formatAmount(fromTokenBalance)
                )}
              </div>

              <div className="flex justify-end space-x-4 mt-2">
                <button className="text-green-500 text-sm" onClick={() => setPercentage(0.25)}>
                  25%
                </button>
                <button className="text-green-500 text-sm" onClick={() => setPercentage(0.5)}>
                  50%
                </button>
                <button className="text-green-500 text-sm" onClick={() => setPercentage(0.75)}>
                  75%
                </button>
                <button className="text-green-500 text-sm" onClick={handleMaxButtonClick}>
                  MAX
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="bg-[#2a2f35] p-2 rounded-full cursor-pointer" onClick={swapTokens}>
                <ArrowRightLeft className="w-5 h-5 text-green-500" />
              </div>
            </div>

            <div className="flex-1 bg-[#1c2127] rounded-lg p-5">
              <div className="text-sm text-gray-400 mb-2">You Get (estimate)</div>
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={buyAmount}
                  readOnly
                  className="bg-transparent text-3xl outline-none w-full"
                  placeholder="0"
                />
                <button
                  className="flex items-center space-x-2 px-3 py-1 rounded bg-[#2a2f35]"
                  onClick={() => setShowToTokenList(!showToTokenList)}
                >
                  <span>{toToken?.symbol || "Select"}</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>

                {showToTokenList && (
                  <div className="absolute mt-40 right-24 z-20 bg-[#2a2f35] rounded-xl p-2 shadow-lg border border-[#3a3f45] w-48">
                    {tokenlist.map((token) => (
                      <div
                        key={token.address}
                        className="flex items-center p-2 hover:bg-[#3a3f45] rounded-lg cursor-pointer transition-colors"
                        onClick={() => {
                          setToToken(token)
                          setShowToTokenList(false)
                        }}
                      >
                        <div className="text-white">{token.symbol}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-400 mt-2">
                Balance:{" "}
                {isLoadingToBalance ? (
                  <Loader2 size={12} className="inline animate-spin ml-1" />
                ) : (
                  formatAmount(toTokenBalance)
                )}
              </div>
              
              {buyAmount && sellAmount && targetPrice && (
                <div className="text-xs text-blue-400 mt-2">
                  <Info size={12} className="inline mr-1" />
                  This is what you'll receive if the order executes at your target price.
                </div>
              )}
            </div>
          </div>

          {/* Expiry Options */}
          <div className="bg-[#1c2127] rounded-lg p-5 mt-4">
            <div className="text-sm text-gray-400 mb-2">Expiry</div>
            <div className="flex space-x-4">
              <button
                className={`text-sm px-2 py-1 rounded ${expiry === "1h" ? "bg-green-600" : "text-green-500"}`}
                onClick={() => handleExpiryChange("1h")}
              >
                1 HOUR
              </button>
              <button
                className={`text-sm px-2 py-1 rounded ${expiry === "4h" ? "bg-green-600" : "text-green-500"}`}
                onClick={() => handleExpiryChange("4h")}
              >
                4 HOURS
              </button>
              <button
                className={`text-sm px-2 py-1 rounded ${expiry === "24h" ? "bg-green-600" : "text-green-500"}`}
                onClick={() => handleExpiryChange("24h")}
              >
                1 DAY
              </button>
              <button
                className={`text-sm px-2 py-1 rounded ${expiry === "3d" ? "bg-green-600" : "text-green-500"}`}
                onClick={() => handleExpiryChange("3d")}
              >
                3 DAYS
              </button>
              <button
                className={`text-sm px-2 py-1 rounded ${expiry === "7d" ? "bg-green-600" : "text-green-500"}`}
                onClick={() => handleExpiryChange("7d")}
              >
                7 DAYS
              </button>
            </div>
          </div>

          {/* Transaction Status */}
          <TransactionStatus />

          {/* Action Button */}
          <button
            className={`w-full ${
              !activeWallet || Number.parseFloat(sellAmount) <= 0 || Number.parseFloat(targetPrice) <= 0 || loading
                ? "bg-[#1c2127] text-gray-400"
                : "bg-green-500 text-white hover:bg-green-600 transition-colors"
            } rounded-lg py-5 mt-4 text-lg ${loading ? "cursor-not-allowed" : ""}`}
            disabled={
              !activeWallet || Number.parseFloat(sellAmount) <= 0 || Number.parseFloat(targetPrice) <= 0 || loading
            }
            onClick={handleCreateLimitOrder}
          >
            {loading
              ? "Processing..."
              : !activeWallet
                ? "Connect Wallet"
                : Number.parseFloat(sellAmount) <= 0
                  ? "Enter an amount"
                  : Number.parseFloat(targetPrice) <= 0
                    ? "Enter target price"
                    : "Create Limit Order"}
          </button>
        </div>
      </main>
    </div>
  )
}

export default Limit

