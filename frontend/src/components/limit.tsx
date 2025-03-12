"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Timer, TrendingDown, Zap, HelpCircle, Settings } from "lucide-react";

function Limit() {
  const [priceAmount, setPriceAmount] = useState("0");
  const [sellAmount, setSellAmount] = useState("0");
  const [buyAmount, setBuyAmount] = useState("0");

  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1a1d23]">
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4">
        {/* Limit Order Card */}
        <div className="bg-[#2a2f35] rounded-lg p-6">
          {/* Trading Options */}
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={() => router.push("/swap")}
              className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Swap</span>
            </button>

            <button className="text-green-500 font-medium flex items-center space-x-1">
              <Timer className="w-4 h-4" />
              <span>Limit</span>
            </button>

            <button
              onClick={() => router.push("/stop-loss")}
              className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
            >
              <TrendingDown className="w-4 h-4" />
              <span>Stop Loss</span>
            </button>

            <button
              onClick={() => router.push("/dca")}
              className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
            >
              <Zap className="w-4 h-4" />
              <span>DCA</span>
            </button>

            <div className="flex-grow"></div>
            <HelpCircle className="w-5 h-5 text-gray-400" />
            <Settings className="w-5 h-5 text-gray-400" />
          </div>

          {/* Price Input */}
          <div className="bg-[#1c2127] rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-400">When one AO is worth:</div>
              <button className="flex items-center space-x-2">
                <ArrowRightLeft className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
                className="bg-transparent text-3xl outline-none w-32"
                placeholder="0"
              />
              <button className="flex items-center space-x-2 px-3 py-1 rounded bg-[#2a2f35]">
                <span>ARIO</span>
              </button>
            </div>
          </div>

          {/* Trading Inputs */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 bg-[#1c2127] rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">You Sell</div>
              <div className="flex items-center">
                <button className="flex items-center space-x-2 px-3 py-1 rounded bg-[#2a2f35]">
                  <span>ARIO</span>
                </button>
                <input
                  type="text"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  className="flex-grow bg-transparent text-2xl text-right outline-none"
                  placeholder="0"
                />
              </div>
              <div className="text-sm text-gray-400 mt-2">Balance: 0</div>
              <div className="flex justify-end space-x-4 mt-2">
                <button className="text-green-500 text-sm">25%</button>
                <button className="text-green-500 text-sm">50%</button>
                <button className="text-green-500 text-sm">75%</button>
                <button className="text-green-500 text-sm">MAX</button>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="bg-[#2a2f35] p-2 rounded-full">
                <ArrowRightLeft className="w-5 h-5 text-green-500" />
              </div>
            </div>

            <div className="flex-1 bg-[#1c2127] rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">You Buy</div>
              <div className="flex items-center">
                <button className="flex items-center space-x-2 px-3 py-1 rounded bg-[#2a2f35]">
                  <span>AO</span>
                </button>
                <input
                  type="text"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="flex-grow bg-transparent text-2xl text-right outline-none"
                  placeholder="0"
                />
              </div>
              <div className="text-sm text-gray-400 mt-2">Balance: 0.00002537</div>
            </div>
          </div>

          {/* Expiry Options */}
          <div className="mt-4">
            <div className="text-sm text-gray-400 mb-2">Expiry</div>
            <div className="flex space-x-4">
              <button className="text-green-500 text-sm">1 HOUR</button>
              <button className="text-green-500 text-sm">4 HOURS</button>
              <button className="text-green-500 text-sm">1 DAY</button>
              <button className="text-green-500 text-sm">3 DAYS</button>
            </div>
          </div>

          {/* Action Button */}
          <button className="w-full bg-[#1c2127] text-gray-400 rounded-lg py-4 mt-4">
            Enter an amount
          </button>
        </div>
      </main>
    </div>
  );
}

export default Limit;
