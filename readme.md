# Swappi - DCA Trading Service

Swappi is an automated trading service built on Monad's accelerated EVM that enables users to execute Dollar Cost Averaging (DCA) strategies and limit orders for cryptocurrency trading. This service reduces the emotional impact of market volatility by automating trades at regular intervals over specified time periods.

## Project Overview

Swappi provides a reliable, efficient, and user-friendly platform for crypto traders to implement DCA strategies and execute limit orders with minimal manual intervention. By leveraging Monad's accelerated EVM, Swappi offers superior transaction throughput and reduced gas costs compared to traditional EVM-based solutions.

## Core Functionality

- **Dollar Cost Averaging (DCA)**: Automatically splits a large trade into smaller portions executed at regular intervals
- **Limit Orders**: Executes trades when specific price conditions are met
- **Balance Management**: Tracks user token balances and manages deposits/withdrawals
- **Automated Token Swaps**: Integrates with 0x API for optimal token swap execution
- **Price Monitoring**: Utilizes Pyth Network for reliable price feeds

## Architecture

### Backend Services

The application follows a service-oriented architecture with the following key components:

1. **DCAService**: Manages DCA order creation, execution, and cancellation
2. **LimitOrderService**: Handles limit order processing and execution
3. **SwapService**: Executes token swaps through 0x API integration
4. **BalanceService**: Manages user token balances
5. **PriceService**: Monitors token prices using Pyth Network
6. **WalletService**: Handles wallet interactions and transactions
7. **QueueService**: Manages scheduled trades using Bull queue

### API Layer

RESTful API endpoints exposed through Express.js for:
- Creating and managing DCA orders
- Setting up limit orders
- Monitoring portfolio and trade execution
- Checking token balances and prices

### Database

MongoDB is used for persistent storage of:
- User data
- Order information
- Balance records
- Trade history

### Job Scheduling

Bull queue implementation for reliable scheduling of:
- DCA trade executions
- Price monitoring
- Limit order checking

## Technologies Used

- **Backend**: TypeScript, Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Blockchain Interaction**: Viem, ethers.js
- **Price Feeds**: Pyth Network
- **Job Queue**: Bull with Redis
- **Scheduling**: node-cron
- **API Integration**: 0x API for token swaps
- **Containerization**: Docker

## Monad Integration

Swappi leverages Monad's accelerated EVM to provide significant advantages:

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
