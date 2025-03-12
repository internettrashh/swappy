import { ethers } from 'ethers';
import { config } from '../config/index';

export class WalletService {
  private provider: ethers.Provider;
  private masterWallet: ethers.Wallet;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.masterWallet = new ethers.Wallet(config.MASTER_WALLET_PRIVATE_KEY, this.provider);
  }

  async verifyDeposit(
    txHash: string, 
    expectedAmount: number, 
    sourceToken: string,
    userAddress: string
  ): Promise<boolean> {
    try {
      // Wait for transaction to be mined
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return false;
      
      await tx.wait();

      // Get ERC20 contract
      const tokenContract = new ethers.Contract(
        sourceToken,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider
      );

      // Verify the transaction details
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) return false;

      // Verify it was sent to master wallet
      if (receipt.to?.toLowerCase() !== this.masterWallet.address.toLowerCase()) {
        return false;
      }

      // Verify amount received
      const balance = await tokenContract.balanceOf(this.masterWallet.address);
      return balance >= expectedAmount;
    } catch (error) {
      console.error('Deposit verification failed:', error);
      return false;
    }
  }

  async refundRemainingTokens(
    userAddress: string,
    sourceToken: string,
    amount: number
  ): Promise<string> {
    try {
      // Convert the amount to a string or BigInt to avoid overflow
      const amountString = amount.toString();
      
      // Check if we're dealing with the native token (MON)
      if (sourceToken.toLowerCase() === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase()) {
        // Send native token
        const tx = await this.masterWallet.sendTransaction({
          to: userAddress,
          value: amountString, // Use string representation
          gasLimit: 100000
        });
        await tx.wait();
        return tx.hash;
      } else {
        // Send ERC20 token
        const tokenContract = new ethers.Contract(
          sourceToken,
          ['function transfer(address, uint256) returns (bool)'],
          this.masterWallet
        );

        // Use string representation for the amount
        const tx = await tokenContract.transfer(userAddress, amountString);
        await tx.wait();
        return tx.hash;
      }
    } catch (error) {
      console.error(`Error refunding tokens to ${userAddress}:`, error);
      throw error;
    }
  }

  async transferTokensToUser(
    userAddress: string,
    tokenAddress: string,
    amount: number
  ): Promise<string> {
    try {
      // Convert the amount to a string to avoid overflow
      const amountString = amount.toString();
      
      // Check if we're dealing with the native token (MON)
      if (tokenAddress.toLowerCase() === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase()) {
        // Send native token
        const tx = await this.masterWallet.sendTransaction({
          to: userAddress,
          value: amountString, // Use string representation
          gasLimit: 100000
        });
        await tx.wait();
        return tx.hash;
      } else {
        // Send ERC20 token
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ['function transfer(address, uint256) returns (bool)'],
          this.masterWallet
        );

        // Use string representation for the amount
        const tx = await tokenContract.transfer(userAddress, amountString);
        await tx.wait();
        return tx.hash;
      }
    } catch (error) {
      console.error(`Error transferring tokens to user ${userAddress}:`, error);
      throw error;
    }
  }
} 