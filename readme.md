# Swappi - DCA Trading Service

SwappyFi is an automated trading service built for  Monad's accelerated EVM that enables users to execute Dollar Cost Averaging (DCA) strategies and limit orders for cryptocurrency trading. This service reduces the emotional impact of market volatility by automating trades at regular intervals over specified time periods.

## Project Overview

SwappyFi is a reliable, efficient, and user-friendly platform that enables crypto traders to automate DCA strategies and execute limit orders with minimal manual effort. Built on Monad’s accelerated EVM, SwappyFi delivers higher transaction throughput and lower gas fees compared to traditional EVM-based solutions, ensuring a seamless and cost-effective trading experience.

## Core Functionality

- **Dollar Cost Averaging (DCA)**: Automatically splits a large trade into smaller portions executed at regular intervals
- **Limit Orders**: Executes trades when specific price conditions are met
- **Balance Management**: Tracks user token balances and manages deposits/withdrawals
- **Automated Token Swaps**: Integrates with 0x API for optimal token swap execution


## Architecture

### Backend Services

The application follows a service-oriented architecture with the following key components:

1. **DCAService**: Manages DCA order creation, execution, and cancellation
2. **LimitOrderService**: Handles limit order processing and execution
3. **SwapService**: Executes token swaps through 0x API integration
4. **BalanceService**: Manages user token balances
5. **PriceService**: Monitors token exchange rates using 0x api
6. **WalletService**: Handles wallet interactions and transactions
7. **QueueService**: Manages scheduled trades using Bull queue




## Technologies Used

- **Backend**: TypeScript, Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Blockchain Interaction**: Viem, ethers.js
- **Price Feeds**: Pyth Network
- **Wallet Infrastructure**: Privy for seamless wallet creation and management
- **DEX Integration**: 0X API for reliable and efficient token swaps
- **Job Queue**: Bull with Redis
- **Scheduling**: node-cron
- **Containerization**: Docker




SwappyFi leverages Monad's accelerated EVM to provide significant advantages:

1. **High Throughput**: Monad's parallel execution engine enables faster transaction processing, allowing Swappi to handle a higher volume of trades simultaneously.

2. **Lower Gas Costs**: Monad's optimized execution environment reduces gas costs for transactions, making DCA strategies more economical, especially for smaller trade amounts.

3. **Reduced Slippage**: Faster transaction confirmation times minimize slippage during trade execution, resulting in better pricing for users.

4. **Enhanced Reliability**: Monad's improved network stability ensures more consistent trade execution, crucial for automated trading strategies.

5. **Future Scalability**: As Monad continues to evolve, Swappi will benefit from ongoing improvements to the underlying infrastructure without major architectural changes.

## Getting Started

### Prerequisites

- Node.js (v16+)
- Docker and Docker Compose
- MongoDB
- Redis

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/swappi.git
   cd swappi
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Configure environment variables
   ```
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Build and run with Docker
   ```
   docker-compose up -d
   ```

5. Or run locally
   ```
   npm run dev
   ```

### Configuration

The `.env` file must include:
- MongoDB connection string
- 0x API key
- Blockchain RPC endpoints
- Private keys for service wallets (in development only)
- Redis connection details

## License

[Include your license information here]

## Contributors

[List of project contributors]
