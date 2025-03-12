import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import dotenv from "dotenv"

dotenv.config()

// Base URL for 0x API
const BASE_URL = "https://api.0x.org";
const API_KEY = process.env.ZERO_EX_API_KEY;

// Helper to validate addresses - basic check for 0x prefix and length
const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromAmount = searchParams.get("fromAmount");
    const fromToken = searchParams.get("fromToken");
    const toToken = searchParams.get("toToken");
    const taker = searchParams.get("taker");
    
    // Enhanced validation
    if (!fromAmount || !fromToken || !toToken) {
      return NextResponse.json({ error: "Missing required query params" }, { status: 400 });
    }
    
    // Validate token addresses
    if (!isValidAddress(fromToken)) {
      return NextResponse.json({ error: "Invalid fromToken address format" }, { status: 400 });
    }
    if (!isValidAddress(toToken)) {
      return NextResponse.json({ error: "Invalid toToken address format" }, { status: 400 });
    }
    
    // Validate taker address if provided
    if (taker && !isValidAddress(taker)) {
      return NextResponse.json({ error: "Invalid taker address format" }, { status: 400 });
    }
    
    // Create parameters for 0x API
    const params = new URLSearchParams({
      sellAmount: fromAmount, // Use the raw amount directly, already in wei
      sellToken: fromToken,
      buyToken: toToken,
      chainId: "10143",
    });
    
    // Only add taker if provided and valid
    if (taker) {
      params.append("taker", taker);
    }

    // Retry configuration following best practices
    const MAX_RETRIES = 3;
    const INITIAL_BACKOFF_MS = 500;
    
    let lastError;
    
    // Retry loop with exponential backoff
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Use proper headers as specified in the documentation
        const response = await axios.get(`${BASE_URL}/swap/permit2/quote?${params.toString()}`, {
          headers: {
            "Content-Type": "application/json",
            "0x-api-key": API_KEY,
            "0x-version": "v2",
          },
          timeout: 10000, // 10 second timeout
        });
        
        // Cache the response data
        const data = response.data;
        
        // Add cache control headers according to best practices
        return new NextResponse(JSON.stringify(data), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Cache-Control": "public, max-age=15", // Cache for 15 seconds
          },
        });
      } catch (error) {
        lastError = error;
        
        // Handle specific error types from 0x API
        if (axios.isAxiosError(error)) {
          // Handle rate limiting specifically
          if (error.response?.status === 429) {
            const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            console.warn(`Rate limited. Retrying in ${backoffTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }
          
          // Handle insufficient liquidity or validation errors
          if (error.response && error.response.status === 400) {
            const errorData = error.response.data;
            
            // Check for specific error types based on the response
            if (errorData.validationErrors || errorData.code === "ValidationError") {
              console.error("Validation error:", errorData);
              return NextResponse.json({ 
                error: "Invalid swap parameters", 
                details: errorData.validationErrors || errorData.message,
                code: 400
              }, { status: 400 });
            }
            
            // Check for insufficient liquidity
            if (errorData.code === "InsufficientLiquidity" || 
                (errorData.message && errorData.message.includes("liquidity"))) {
              console.error("Insufficient liquidity error:", errorData);
              return NextResponse.json({ 
                error: "Insufficient liquidity for this swap", 
                code: 400
              }, { status: 400 });
            }
            
            // General 400 error
            return NextResponse.json({ 
              error: `Quote request failed: ${errorData.reason || errorData.message || "Bad request"}`,
              code: 400
            }, { status: 400 });
          }
          
          // Don't retry on other 4xx client errors
          if (error.response && error.response.status < 500 && error.response.status !== 429) {
            console.error(`Client error (${error.response.status}):`, error.response.data);
            return NextResponse.json({ 
              error: `Quote request failed: ${error.response.data?.reason || error.message}`,
              code: error.response.status 
            }, { status: error.response.status });
          }
          
          // For 5xx errors or network issues, retry with backoff
          const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(`Attempt ${attempt + 1} failed. Retrying in ${backoffTime}ms...`, error.message);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        
        // For non-Axios errors, just break and handle in outer catch
        break;
      }
    }
    
    // If we get here, all retries failed
    console.error("All retry attempts failed:", lastError);
    return NextResponse.json({ 
      error: "Failed to fetch quote after multiple attempts. Please try again later.",
      code: 503
    }, { status: 503 });
  } catch (error) {
    console.error("Unexpected error fetching quote:", error);
    return NextResponse.json({ 
      error: "An unexpected error occurred. Please try again.",
      code: 500
    }, { status: 500 });
  }
}

// Handle CORS preflight requests
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}