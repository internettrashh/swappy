"use client";

import React, { useState } from "react";
import { Moon, Settings, HelpCircle, ArrowRightLeft, Timer, TrendingDown, Zap } from "lucide-react";
import { useRouter } from "next/router";
function Swapy() {
  const router = useRouter();

  const [priceAmount, setPriceAmount] = useState("0");
  const [sellAmount, setSellAmount] = useState("0");
  const [buyAmount, setBuyAmount] = useState("0");

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
  onClick={() => router.push("/limit")}
  className="flex items-center space-x-1 text-gray-400 hover:text-gray-200"
>
  <Timer className="w-4 h-4" />
  <span>Limit</span>
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

          {/* Swap Inputs */}
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

          {/* Swap Button */}
          <button className="w-full bg-[#1c2127] text-gray-400 rounded-lg py-4 mt-4">
            Enter an amount
          </button>
        </div>
      </main>
    </div>
  );
}

export default Swapy;
