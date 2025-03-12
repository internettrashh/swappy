import React, { useState } from 'react';
import { ArrowRightLeft, Timer, TrendingDown, Zap, HelpCircle, Settings } from 'lucide-react';

function Dca() {
  const [allocateAmount, setAllocateAmount] = useState('0');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');

  return (
    <div>
      {/* Main Content */}
      <main className="max-w-4xl mx-auto mt-12 px-4">
        {/* DCA Order Card */}
        <div className="bg-[#2a2f35] rounded-lg p-6">
          {/* Trading Options */}
          <div className="flex items-center space-x-4 mb-6">
            <button className="flex items-center space-x-1 text-gray-400 hover:text-gray-200">
              <ArrowRightLeft className="w-4 h-4" />
              <span>Swap</span>
            </button>
            <button className="flex items-center space-x-1 text-gray-400 hover:text-gray-200">
              <Timer className="w-4 h-4" />
              <span>Limit</span>
            </button>
            <button className="flex items-center space-x-1 text-gray-400 hover:text-gray-200">
              <TrendingDown className="w-4 h-4" />
              <span>Stop Loss</span>
            </button>
            <button className="text-green-500 font-medium">
              <span className="flex items-center space-x-1">
                <Zap className="w-4 h-4" />
                <span>DCA</span>
              </span>
            </button>
            <div className="flex-grow"></div>
            <HelpCircle className="w-5 h-5 text-gray-400" />
            <Settings className="w-5 h-5 text-gray-400" />
          </div>

          {/* Allocation Input */}
          <div className="bg-[#1c2127] rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-400">I want to allocate:</div>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={allocateAmount}
                onChange={(e) => setAllocateAmount(e.target.value)}
                className="bg-transparent text-3xl outline-none w-32"
                placeholder="0"
              />
              <button className="flex items-center space-x-2 px-3 py-1 rounded bg-[#2a2f35]">
                <span>ARIO</span>
              </button>
            </div>
          </div>

          {/* Buy Token Section */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 bg-[#1c2127] rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">To Buy</div>
              <div className="flex items-center">
                <button className="flex items-center space-x-2 px-3 py-1 rounded bg-[#2a2f35]">
                  <span>AO</span>
                </button>
              </div>
              <div className="text-sm text-gray-400 mt-2">Balance: 0.00002537</div>
            </div>
          </div>

          {/* Running Time Input */}
          <div className="bg-[#1c2127] rounded-lg p-4 mt-4">
            <div className="text-sm text-gray-400 mb-2">Running Time (5 min - 7 days)</div>
            <div className="flex items-center space-x-4 mb-4">
              <input
                type="text"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-16 bg-transparent text-2xl text-right outline-none"
                placeholder="0"
              />
              <span className="text-gray-400">Hour(s)</span>
              <input
                type="text"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-16 bg-transparent text-2xl text-right outline-none"
                placeholder="30"
              />
              <span className="text-gray-400">Minute(s)</span>
            </div>
            <div className="flex space-x-4">
              <button className="text-green-500 text-sm">10MIN</button>
              <button className="text-green-500 text-sm">1H</button>
              <button className="text-green-500 text-sm">4H</button>
              <button className="text-green-500 text-sm">1D</button>
              <button className="text-green-500 text-sm">3D</button>
              <button className="text-green-500 text-sm">7D</button>
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

export default Dca;
