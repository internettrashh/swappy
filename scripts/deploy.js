// scripts/deploy-sepolia.js
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
  
    // Contract addresses for Sepolia
    const wethAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Sepolia WETH
    const allowanceHolderAddress = "0xf740b67da229f2f10bcbd38a7979992fcc71b8eb"; // 0x AllowanceHolder on Sepolia
    const permit2Address = "0x000000000022d473030f116ddee9f6b43ac78ba3"; // Permit2 on Sepolia
    
    // Deploy mock USDT (since Sepolia might not have a standard test USDT)
    const MockUSDT = await ethers.getContractFactory("MockERC20");
    const usdt = await MockUSDT.deploy("Test USDT", "USDT");
    await usdt.deployed();
    console.log("Mock USDT deployed to:", usdt.address);
    
    // For testing, you can use your own address as the Gelato executor
    const gelatoExecutor = deployer.address;
    
    // Deploy DCAAgent
    const DCAAgent = await ethers.getContractFactory("DCAAgent");
    const dcaAgent = await DCAAgent.deploy(
      wethAddress,
      allowanceHolderAddress,
      permit2Address,
      usdt.address,
      gelatoExecutor
    );
    await dcaAgent.deployed();
    console.log("DCAAgent deployed to:", dcaAgent.address);
    
    // Mint some test USDT to your address
    await usdt.mint(deployer.address, ethers.utils.parseUnits("10000", 6));
    console.log("Minted 10,000 USDT to:", deployer.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });