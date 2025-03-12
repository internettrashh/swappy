import { Bell, ChevronDown, Moon } from 'lucide-react';
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
    <header className="flex justify-between items-center px-6 py-4 bg-[#1c2127] text-gray-200">
      {/* Logo */}
      <div className="text-2xl font-bold">
        <span className="text-white">Swappy</span>
        <span className="text-green-500">fi</span>
      </div>
      
      {/* Navigation Links */}
      <nav className="hidden sm:flex space-x-8">
        <a href="#" className="text-white">Swap</a>
        <a href="#" className="text-gray-400 hover:text-gray-200">DCA</a>
        <a href="#" className="text-gray-400 hover:text-gray-200">Limit</a>
      </nav>
      
      {/* Right Side */}
      <div className="flex items-center space-x-4">
        <Bell size={20} className="text-gray-400 hover:text-white" />
        <Moon size={20} className="text-gray-400 hover:text-white" />
        
        {authenticated ? (
          <div 
            onClick={logout}
            className="px-3 py-1 rounded border border-gray-600 cursor-pointer hover:bg-[#252a33]"
          >
            {activeWallet?.address.slice(0, 6)}...{activeWallet?.address.slice(-4)}
          </div>
        ) : (
          <button 
            onClick={login}
            className="px-3 py-1 rounded border border-gray-600 hover:bg-[#252a33]"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}

export default Nav;