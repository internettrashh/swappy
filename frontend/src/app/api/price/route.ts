import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromAmount = searchParams.get("fromAmount");
    const fromToken = searchParams.get("fromToken");
    const toToken = searchParams.get("toToken");
    const taker = searchParams.get("taker");
    if (!fromAmount || !fromToken || !toToken) {
      return NextResponse.json({ error: "Missing required query params" }, { status: 400 });
    }

    const params = new URLSearchParams({
      sellAmount: fromAmount, // Use the raw amount directly, already in wei
      taker: taker || "",
      chainId: "10143",
      sellToken: fromToken,
      buyToken: toToken,
    });

    const response = await axios.get(`https://api.0x.org/swap/permit2/quote?${params.toString()}`, {
      headers: {
        "0x-api-key": "3a91c837-7567-4778-92f0-a5e14d7f2313",
        "0x-version": "v2",
      },
    });
    const data = response.data;

    // Return response with CORS headers
    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Allow all origins
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json({ error: "Failed to fetch quote. Please try again." }, { status: 500 });
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