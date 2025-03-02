import { Web3Function, Web3FunctionContext } from "@gelatonetwork/web3-functions-sdk";
import { Contract, ethers } from "ethers";
import axios from "axios";

// ABI for the DCA Agent contract (only include the functions we need)
const DCA_AGENT_ABI = [
  "function userStrategyCount(address user) view returns (uint256)",
  "function userStrategies(address user, uint256 strategyId) view returns (address sourceToken, address targetToken, uint256 totalAmount, uint256 amountPerTrade, uint256 frequency, uint256 startTime, uint256 endTime, uint256 lastExecutionTime, uint256 executionsCompleted, bool active)",
  "function executeSwap(address user, uint256 strategyId, address spender, address payable swapTarget, bytes calldata swapCallData) external",
];

// 0x API endpoints for different networks
const ZEROX_API_ENDPOINTS = {
  1: "https://api.0x.org",                  // Ethereum Mainnet
  137: "https://polygon.api.0x.org",        // Polygon
  56: "https://bsc.api.0x.org",             // BSC
  42161: "https://arbitrum.api.0x.org",     // Arbitrum
  10: "https://optimism.api.0x.org",        // Optimism
  43114: "https://avalanche.api.0x.org",    // Avalanche
};

Web3Function.onRun(async (context) => {
  const { userArgs, storage, secrets, provider } = context;
  
  // Get contract address and other parameters from user args
  const dcaAgentAddress = userArgs.dcaAgentAddress ;
  const allowanceTarget = userArgs.allowanceTarget ;
  const permit2Address = userArgs.permit2Address ;
  const chainId = Number(await provider.getNetwork().then(n => n.chainId));
  
  // Get 0x API endpoint for the current chain
  const zeroXApiUrl = ZEROX_API_ENDPOINTS[chainId];
  if (!zeroXApiUrl) {
    return { canExec: false, message: `Chain ID ${chainId} not supported by 0x API` };
  }
  
  // Create contract instance
  const dcaAgent = new Contract(dcaAgentAddress, DCA_AGENT_ABI, provider);
  
  // Get the last processed user and strategy ID from storage
  const lastProcessedData = await storage.get("lastProcessed");
  let lastProcessedUser = ethers.constants.AddressZero;
  let lastProcessedStrategyId = 0;
  
  if (lastProcessedData) {
    const parsed = JSON.parse(lastProcessedData);
    lastProcessedUser = parsed.user;
    lastProcessedStrategyId = parsed.strategyId;
  }
  
  // Get users to check (in a real implementation, you'd need a way to track all users)
  // For this example, we'll use a predefined list from user args
  const usersToCheck = (userArgs.users ) || [];
  
  // Find the next strategy to execute
  let nextUser = ethers.constants.AddressZero;
  let nextStrategyId = 0;
  let strategyToExecute = null;
  
  // Simple algorithm to find the next strategy to execute
  // In a production system, you'd want a more efficient way to track eligible strategies
  for (const user of usersToCheck) {
    const strategyCount = await dcaAgent.userStrategyCount(user);
    
    for (let i = 0; i < strategyCount; i++) {
      // Skip strategies we've already processed in this cycle
      if (
        user === lastProcessedUser && 
        i <= lastProcessedStrategyId
      ) {
        continue;
      }
      
      const strategy = await dcaAgent.userStrategies(user, i);
      
      // Check if strategy is eligible for execution
      const currentTime = Math.floor(Date.now() / 1000);
      if (
        strategy.active &&
        currentTime <= strategy.endTime &&
        (currentTime >= strategy.lastExecutionTime + strategy.frequency || strategy.lastExecutionTime === 0)
      ) {
        nextUser = user;
        nextStrategyId = i;
        strategyToExecute = strategy;
        break;
      }
    }
    
    if (strategyToExecute) {
      break;
    }
  }
  
  // If no strategy found, reset the last processed data and exit
  if (!strategyToExecute) {
    await storage.set("lastProcessed", JSON.stringify({ user: ethers.constants.AddressZero, strategyId: 0 }));
    return { canExec: false, message: "No strategies ready for execution" };
  }
  
  // Get swap quote from 0x API
  try {
    const response = await axios.get(`${zeroXApiUrl}/swap/v1/quote`, {
      params: {
        sellToken: strategyToExecute.sourceToken,
        buyToken: strategyToExecute.targetToken,
        sellAmount: strategyToExecute.amountPerTrade.toString(),
        slippagePercentage: 0.01, // 1% slippage
      },
    });
    
    const swapQuote = response.data;
    
    // Determine which address to use as the swap target
    const swapTarget = swapQuote.allowanceTarget === allowanceTarget 
      ? allowanceTarget 
      : permit2Address;
    
    // Store the last processed user and strategy ID
    await storage.set("lastProcessed", JSON.stringify({ 
      user: nextUser, 
      strategyId: nextStrategyId 
    }));
    
    // Return execution data
    return {
      canExec: true,
      callData: dcaAgent.interface.encodeFunctionData("executeSwap", [
        nextUser,
        nextStrategyId,
        swapQuote.allowanceTarget,
        swapTarget,
        swapQuote.data
      ]),
    };
  } catch (error) {
    console.error("Error getting swap quote:", error);
    return { canExec: false, message: `Error getting swap quote: ${error.message}` };
  }
}); 