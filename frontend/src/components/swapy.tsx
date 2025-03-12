"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Settings, HelpCircle, ArrowRightLeft, Timer, Zap, Loader2, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { ethers } from "ethers"
import { BrowserProvider } from "ethers"

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

// ERC20 ABI for token balance fetching
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
]

// Token list
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

function Swapy() {
  const router = useRouter()
  const { ready } = usePrivy()
  const { wallets } = useWallets()
  const activeWallet = wallets[0]

  // Token amounts
  const [sellAmount, setSellAmount] = useState("0")
  const [buyAmount, setBuyAmount] = useState("0")

  // Selected tokens
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)

  // Token lists visibility
  const [showFromTokenList, setShowFromTokenList] = useState(false)
  const [showToTokenList, setShowToTokenList] = useState(false)

  // Quote data and loading state
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [quoteData, setQuoteData] = useState<any>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [gasFee, setGasFee] = useState<string | null>(null)
  const [route, setRoute] = useState<any>(null)

  // Transaction state
  const [isSwapping, setIsSwapping] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle")
  const [txError, setTxError] = useState<string | null>(null)

  // Slippage
  const [slippage, setSlippage] = useState("100") // Default 1%
  const [showSlippageSettings, setShowSlippageSettings] = useState(false)
  const [showQuoteSuccess, setShowQuoteSuccess] = useState(false)

  // State to track token balances
  const [fromTokenBalance, setFromTokenBalance] = useState("0")
  const [toTokenBalance, setToTokenBalance] = useState("0")

  // Loading states for balances
  const [isLoadingFromBalance, setIsLoadingFromBalance] = useState(false)
  const [isLoadingToBalance, setIsLoadingToBalance] = useState(false)

  // Initialize default tokens
  useEffect(() => {
    setFromToken(tokenlist.find((t) => t.symbol === "MON") || tokenlist[0])
    setToToken(tokenlist.find((t) => t.symbol === "DAK") || tokenlist[6])
  }, [])

  // Fetch quote when tokens or amounts change
  useEffect(() => {
    if (fromToken && toToken && sellAmount && Number.parseFloat(sellAmount) > 0) {
      fetchQuote()
    }
  }, [fromToken, toToken, sellAmount])

  // Fetch balances when tokens or wallet changes
  useEffect(() => {
    if (fromToken && activeWallet?.address) {
      fetchTokenBalance(fromToken, true)
    }
  }, [fromToken, activeWallet?.address])

  useEffect(() => {
    if (toToken && activeWallet?.address) {
      fetchTokenBalance(toToken, false)
    }
  }, [toToken, activeWallet?.address])

  // Function to fetch token balance from blockchain
  const fetchTokenBalance = async (token: Token, isFromToken: boolean) => {
    if (!activeWallet?.address) {
      if (isFromToken) {
        setFromTokenBalance("0")
      } else {
        setToTokenBalance("0")
      }
      return
    }

    try {
      if (isFromToken) {
        setIsLoadingFromBalance(true)
      } else {
        setIsLoadingToBalance(true)
      }

      const provider = new ethers.JsonRpcProvider("https://rpc.monad.xyz")

      // If it's a native token (MON)
      if (token.isNative) {
        const balanceWei = await provider.getBalance(activeWallet.address)
        const balanceFormatted = ethers.formatEther(balanceWei)

        if (isFromToken) {
          setFromTokenBalance(balanceFormatted)
        } else {
          setToTokenBalance(balanceFormatted)
        }
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

        if (isFromToken) {
          setFromTokenBalance(balanceFormatted)
        } else {
          setToTokenBalance(balanceFormatted)
        }
      }
    } catch (error) {
      console.error(`Error fetching ${token.symbol} balance:`, error)
      if (isFromToken) {
        setFromTokenBalance("0")
      } else {
        setToTokenBalance("0")
      }
    } finally {
      if (isFromToken) {
        setIsLoadingFromBalance(false)
      } else {
        setIsLoadingToBalance(false)
      }
    }
  }

  // Handle sell amount change
  const handleSellAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/,/g, "")
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setSellAmount(value)
    }
  }

  // Add blur handler for sell amount input
  const handleSellAmountBlur = () => {
    fetchQuote()
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

  // Handle Max functionality
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

  // Fetch quote from API with improved error handling
  const fetchQuote = async () => {
    if (!fromToken || !toToken || !sellAmount || Number.parseFloat(sellAmount) === 0) {
      setBuyAmount("")
      setGasFee(null)
      setRoute(null)
      return
    }

    setIsLoadingQuote(true)
    setQuoteError(null)

    try {
      // Convert sellAmount to wei (18 decimals)
      const fromAmountInWei = BigInt(Math.floor(Number.parseFloat(sellAmount) * 10 ** 18)).toString()

      // Use the connected wallet address as taker if available, otherwise use a fallback
      const takerAddress = activeWallet?.address || ""

      // Use the actual address for tokens, not the string "NATIVE"
      const fromTokenAddress = fromToken.isNative ? NATIVE_TOKEN_ADDRESS : fromToken.address

      const toTokenAddress = toToken.isNative ? NATIVE_TOKEN_ADDRESS : toToken.address

      // Add slippage parameter - default 1% (100 basis points)
      const slippageBps = "100"

      const response = await fetch(
        `/api/price?fromAmount=${fromAmountInWei}&fromToken=${fromTokenAddress}&toToken=${toTokenAddress}&taker=${takerAddress}&slippageBps=${slippageBps}`,
      )
      const data = await response.json()

      if (response.ok) {
        // Convert buyAmount from wei (18 decimals) back to decimal
        const buyAmountInWei = BigInt(data.buyAmount)
        const buyAmount = Number(buyAmountInWei) / 10 ** 18

        // Format the amount based on size
        let formattedAmount
        if (buyAmount < 0.000001) {
          // For very small numbers, show more decimals
          formattedAmount = buyAmount
            .toLocaleString("fullwide", {
              useGrouping: false,
              minimumFractionDigits: 0,
              maximumFractionDigits: 18,
            })
            .replace(/\.?0+$/, "") // Remove trailing zeros
        } else if (buyAmount < 1) {
          // For numbers less than 1, show 6 decimals
          formattedAmount = buyAmount.toFixed(6)
        } else {
          // For numbers >= 1, show 2 decimals
          formattedAmount = buyAmount.toFixed(2)
        }

        setBuyAmount(formattedAmount)
        setQuoteData({
          ...data,
          price: buyAmount,
        })

        // Use the pre-calculated gas fee from API if available
        if (data.estimatedGasCostInETH) {
          setGasFee(data.estimatedGasCostInETH + " ETH")
        } else if (data.transaction && data.transaction.gas && data.transaction.gasPrice) {
          const gasCost = BigInt(data.transaction.gas) * BigInt(data.transaction.gasPrice)
          const gasCostInETH = Number(gasCost) / 10 ** 18
          setGasFee(gasCostInETH.toFixed(6) + " ETH")
        } else if (data.totalNetworkFee) {
          const networkFeeInETH = Number(BigInt(data.totalNetworkFee)) / 10 ** 18
          setGasFee(networkFeeInETH.toFixed(6) + " ETH")
        } else {
          setGasFee(null)
        }

        // Set route information
        if (data.route) {
          setRoute(data.route)
        }

        // Trigger success animation
        setShowQuoteSuccess(true)
        setTimeout(() => setShowQuoteSuccess(false), 2000)
      } else {
        // Use the UI-friendly message if available
        setQuoteError(data.uiMessage || data.error || "Failed to fetch quote.")
        setBuyAmount("")
        setGasFee(null)
        setRoute(null)
      }
    } catch (error) {
      console.error("Error fetching quote:", error)
      setQuoteError("Failed to fetch quote. Please try again.")
      setBuyAmount("")
      setGasFee(null)
      setRoute(null)
    } finally {
      setIsLoadingQuote(false)
    }
  }

  // Route path display
  const getRoutePath = () => {
    if (!route || !route.tokens) return null

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
    )
  }

  // Swap tokens
  const handleSwapTokens = () => {
    const tempToken = fromToken
    setFromToken(toToken)
    setToToken(tempToken)

    // Also swap the balances
    const tempBalance = fromTokenBalance
    setFromTokenBalance(toTokenBalance)
    setToTokenBalance(tempBalance)

    // Reset amounts to trigger a new quote
    setSellAmount("0")
    setBuyAmount("0")
  }

  // Execute the swap
  const executeSwap = async () => {
    if (!activeWallet || !quoteData || !fromToken || !toToken) {
      setTxError("Wallet not connected or quote not available")
      return
    }

    setIsSwapping(true)
    setTxStatus("pending")
    setTxError(null)
    setTxHash(null)

    try {
      // Check for the transaction object and 'to' address location
      if (!quoteData.transaction || !quoteData.transaction.to || !quoteData.transaction.to.startsWith("0x")) {
        throw new Error("Invalid or missing 'to' address in quote data")
      }

      // Create transaction object
      const tx = {
        to: quoteData.transaction.to,
        data: quoteData.transaction.data,
        value: quoteData.transaction.value || "0",
        gasLimit: quoteData.transaction.gas
          ? BigInt(Math.floor(Number(quoteData.transaction.gas) * 1.2)).toString()
          : undefined,
      }

      // Get provider and signer
      const ethereumProvider = await activeWallet.getEthereumProvider()
      const ethersProvider = new BrowserProvider(ethereumProvider)
      const signer = await ethersProvider.getSigner()

      // Send the transaction with all necessary fields
      const transaction = await signer.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gasLimit: tx.gasLimit,
      })

      setTxHash(transaction.hash)

      // Wait for transaction confirmation
      const receipt = await transaction.wait()

      if (receipt && receipt.status === 1) {
        setTxStatus("success")
        setSellAmount("")
        setBuyAmount("")

        // Refresh balances after successful swap
        fetchTokenBalance(fromToken, true)
        fetchTokenBalance(toToken, false)

        setShowQuoteSuccess(true)
        setTimeout(() => setShowQuoteSuccess(false), 2000)
      } else {
        setTxStatus("error")
        setTxError("Transaction failed. Please check your wallet for details.")
      }
    } catch (error) {
      console.error("Error executing swap:", error)

      // Provide user-friendly error message
      let errorMessage = "Failed to execute swap. Please try again."

      if (error instanceof Error) {
        // Parse common errors
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected in your wallet."
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for this swap including gas fees."
        } else if (error.message.includes("gas required exceeds")) {
          errorMessage = "Transaction would fail - likely due to slippage or gas issues."
        } else if (error.message.includes("Invalid")) {
          errorMessage = error.message // Use the exact error for clarity
        }
      }

      setTxStatus("error")
      setTxError(errorMessage)
    } finally {
      setIsSwapping(false)
    }
  }

  // Error message component
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
                ? "Swap successful!"
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

        {txError && <div className="text-xs text-red-400 mt-1">{txError}</div>}
      </div>
    )
  }

  // Slippage selector component
  const SlippageSelector = () => (
    <div className="bg-[#1c2127] rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-400 text-sm">Slippage Tolerance</span>
        <button onClick={() => setShowSlippageSettings(false)} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      <div className="flex space-x-2 mb-2">
        {["0.5", "1.0", "2.0"].map((value) => (
          <button
            key={value}
            onClick={() => setSlippage((Number.parseFloat(value) * 100).toString())}
            className={`px-4 py-2 rounded-lg text-sm ${
              slippage === (Number.parseFloat(value) * 100).toString()
                ? "bg-green-500 text-black"
                : "bg-[#2a2f35] text-white"
            }`}
          >
            {value}%
          </button>
        ))}

        <div className="relative flex-1">
          <input
            type="text"
            value={(Number.parseInt(slippage) / 100).toFixed(1)}
            onChange={(e) => {
              const val = Number.parseFloat(e.target.value)
              if (!isNaN(val) && val > 0 && val <= 50) {
                setSlippage((val * 100).toString())
              }
            }}
            className="w-full px-4 py-2 bg-[#2a2f35] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <div className="absolute right-3 top-2 text-gray-400">%</div>
        </div>
      </div>

      <div className="text-xs text-gray-400">
        Your transaction will revert if the price changes unfavorably by more than this percentage.
      </div>
    </div>
  )

  // Fix the percentage buttons to use the actual balance
  const handlePercentageClick = (percentage: number) => {
    if (!fromTokenBalance || Number.parseFloat(fromTokenBalance) === 0) return

    const amount = Number.parseFloat(fromTokenBalance) * percentage

    // If it's the native token, leave some for gas
    if (fromToken?.isNative && amount > 0.01) {
      setSellAmount((amount - 0.01).toString())
    } else {
      setSellAmount(amount.toString())
    }
  }

  return (
    <div>
      {/* Main Content */}
      <main className="max-w-4xl mx-auto mt-12 px-4">
        {/* Swap Card */}
        <div className="bg-[#2a2f35] rounded-lg p-6">
          {/* Swap Options */}
          <div className="flex items-center space-x-4 mb-6">
            <button className="text-green-500 font-medium">Swap</button>
            <button
              onClick={() => router.push("/dca")}
              className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
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
            <button
              onClick={() => setShowSlippageSettings(!showSlippageSettings)}
              className="text-gray-400 hover:text-gray-200"
            >
              <Settings className="w-5 h-5" />
            </button>
            <HelpCircle className="w-5 h-5 text-gray-400" />
          </div>

          {/* Show Slippage Settings if enabled */}
          {showSlippageSettings && <SlippageSelector />}

          {/* Error Message */}
          <ErrorMessage error={quoteError} />

          {/* Swap Inputs */}
          <div className="flex items-center space-x-4">
            <div className="w-1/2 bg-[#1c2127] rounded-lg p-4 min-h-[172px] flex flex-col">
              <div className="text-sm text-gray-400 mb-2">You Sell</div>
              <div className="flex items-center mb-2">
                <button
                  className="flex items-center space-x-2 px-3 py-1 rounded bg-[#2a2f35]"
                  onClick={() => setShowFromTokenList(!showFromTokenList)}
                >
                  <span>{fromToken?.symbol || "Select"}</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>

                {showFromTokenList && (
                  <div className="absolute z-20 mt-1 bg-[#2a2f35] rounded-xl p-2 shadow-lg border border-[#3a3f45] w-48">
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

                <input
                  type="text"
                  value={sellAmount}
                  onChange={handleSellAmountChange}
                  onBlur={handleSellAmountBlur}
                  className="flex-grow bg-transparent text-2xl text-right outline-none w-full"
                  placeholder="0"
                />
              </div>
              <div className="text-sm text-gray-400 mt-auto flex items-center">
                <span>
                  Balance:{" "}
                  {isLoadingFromBalance ? (
                    <Loader2 size={12} className="inline animate-spin ml-1" />
                  ) : (
                    formatAmount(fromTokenBalance)
                  )}
                </span>
              </div>
              <div className="flex justify-end space-x-4 mt-2">
                <button className="text-green-500 text-sm" onClick={() => handlePercentageClick(0.25)}>
                  25%
                </button>
                <button className="text-green-500 text-sm" onClick={() => handlePercentageClick(0.5)}>
                  50%
                </button>
                <button className="text-green-500 text-sm" onClick={() => handlePercentageClick(0.75)}>
                  75%
                </button>
                <button className="text-green-500 text-sm" onClick={handleMaxButtonClick}>
                  MAX
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div
                className="bg-[#2a2f35] p-2 rounded-full cursor-pointer hover:bg-[#3a3f45]"
                onClick={handleSwapTokens}
              >
                <ArrowRightLeft className="w-5 h-5 text-green-500" />
              </div>
            </div>

            <div className="w-1/2 bg-[#1c2127] rounded-lg p-4 min-h-[172px] flex flex-col">
              <div className="text-sm text-gray-400 mb-2">You Buy</div>
              <div className="flex items-center mb-2">
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
                          setToToken(token)
                          setShowToTokenList(false)
                        }}
                      >
                        <div className="text-white">{token.symbol}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className={`flex-grow text-2xl text-right w-full ${isLoadingQuote ? "text-gray-400" : showQuoteSuccess ? "text-green-400" : "text-white"}`}
                >
                  {isLoadingQuote ? (
                    <div className="flex justify-end">
                      <Loader2 size={20} className="animate-spin text-gray-400" />
                    </div>
                  ) : (
                    buyAmount || "0"
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-400 mt-auto flex items-center">
                <span>
                  Balance:{" "}
                  {isLoadingToBalance ? (
                    <Loader2 size={12} className="inline animate-spin ml-1" />
                  ) : (
                    formatAmount(toTokenBalance)
                  )}
                </span>
              </div>
              <div className="mt-2 h-7 invisible">
                {/* This invisible div maintains the same height as the percentage buttons in the sell box */}
              </div>
            </div>
          </div>

          {/* Show gas fee and route information */}
          {(gasFee || route) && (
            <div className="mt-2 text-sm text-gray-400">
              {gasFee && <div>Estimated Gas: {gasFee}</div>}
              {route && getRoutePath()}
            </div>
          )}

          {/* Transaction Status */}
          <TransactionStatus />

          {/* Swap Button */}
          <button
            className={`w-full rounded-lg py-4 mt-4 ${
              !activeWallet || isLoadingQuote || isSwapping || !fromToken || !toToken || !sellAmount || !buyAmount
                ? "bg-[#1c2127] text-gray-400 cursor-not-allowed"
                : "bg-green-500 text-white hover:bg-green-600 transition-colors"
            }`}
            disabled={
              !activeWallet || isLoadingQuote || isSwapping || !fromToken || !toToken || !sellAmount || !buyAmount
            }
            onClick={executeSwap}
          >
            {isLoadingQuote
              ? "Loading Quote..."
              : isSwapping
                ? "Swapping..."
                : !activeWallet
                  ? "Connect Wallet to Swap"
                  : !sellAmount || Number.parseFloat(sellAmount) === 0
                    ? "Enter an amount"
                    : "Swap"}
          </button>
        </div>
      </main>
    </div>
  )
}

export default Swapy

