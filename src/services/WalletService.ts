import { ethers } from 'ethers';
import { config } from '../config';

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
    const tokenContract = new ethers.Contract(
      sourceToken,
      ['function transfer(address, uint256) returns (bool)'],
      this.masterWallet
    );

    const tx = await tokenContract.transfer(userAddress, amount);
    return tx.hash;
  }
} 