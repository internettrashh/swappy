import { Bell, ChevronDown } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function Nav() {
  const { login, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];
  const [monBalance, setMonBalance] = useState("0");

  // Function to fetch MON balance
  const fetchMonBalance = async () => {
    if (!activeWallet?.address) return;

    try {
      const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
      const balanceWei = await provider.getBalance(activeWallet.address);
      const balanceMON = ethers.formatEther(balanceWei);
      const formattedBalance = parseFloat(balanceMON).toFixed(2);
      
      setMonBalance(formattedBalance);
    } catch (error) {
      console.error("Error fetching MON balance:", error);
      setMonBalance("0");
    }
  };

  useEffect(() => {
    if (activeWallet?.address) {
      fetchMonBalance();
      const interval = setInterval(fetchMonBalance, 15000);
      return () => clearInterval(interval);
    }
  }, [activeWallet?.address]);

  return (
    <div className="bg-[#1c2127] text-gray-200 shadow-md py-4 px-6 flex justify-between items-center">
      {/* Logo */}
      <div className="text-2xl font-bold">
        <span className="text-white">Swappy</span>
        <span className="text-[#5edfff]">fi</span>
      </div>
      
      {/* Navigation Links */}
      <div className="hidden sm:flex space-x-6">
        <button className="text-white bg-[#252a33] px-4 py-2 rounded-full">Swap</button>
        <button className="text-gray-400 hover:text-white px-4 py-2">DCA</button>
        <button className="text-gray-400 hover:text-white px-4 py-2">Limit</button>
      </div>
      
      {/* Right Side */}
      <div className="flex items-center space-x-4">
        <button className="text-gray-400 hover:text-white">
          <Bell size={20} />
        </button>
        {authenticated ? (
          <div className="flex items-center space-x-3">
            <div className="bg-[#252a33] p-1 rounded-full">
              {/* <img 
                src="https://images.unsplash.com/photo-1511367461989-f85a21fda167?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"
                alt="Profile" 
                className="w-8 h-8 rounded-full"
              /> */}
            </div>
            <div className="flex items-center bg-[#252a33] px-3 py-1 rounded-full text-sm">
              <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center mr-2">
                <span className="text-white text-xs">M</span>
              </div>
              <span>{monBalance} MON</span>
              <ChevronDown size={16} className="ml-1" />
            </div>
            <button 
              onClick={logout}
              className="bg-gradient-to-r from-[#5edfff] to-[#77b5fe] text-black font-medium px-4 py-2 rounded-full text-sm"
            >
              {activeWallet?.address.slice(0, 6)}...{activeWallet?.address.slice(-4)}
            </button>
          </div>
        ) : (
          <button 
            onClick={login}
            className="bg-gradient-to-r from-[#5edfff] to-[#77b5fe] text-black font-medium px-4 py-2 rounded-full text-sm"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  );
}

export default Nav;
