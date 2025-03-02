// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
}

contract DCAAgent is ReentrancyGuard {
    // Events
    event StrategyCreated(address indexed user, uint256 strategyId, address sourceToken, address targetToken);
    event TradeExecuted(address indexed user, uint256 strategyId, uint256 amountIn, uint256 amountOut);
    event StrategyTerminated(address indexed user, uint256 strategyId);
    event WithdrawnFunds(address indexed user, address token, uint256 amount);

    // Constants
    IWETH public immutable WETH;
    address public immutable owner;
    address public immutable allowanceHolder;
    address public immutable permit2;
    address public immutable USDT; // USDT address

    // DCA Strategy struct
    struct DCAStrategy {
        address sourceToken;      // Source token (typically USDT)
        address targetToken;      // Target token to buy
        uint256 totalAmount;      // Total amount allocated
        uint256 amountPerTrade;   // Amount per trade
        uint256 frequency;        // Time between trades in seconds
        uint256 startTime;        // Start timestamp
        uint256 endTime;          // End timestamp
        uint256 lastExecutionTime; // Last execution timestamp
        uint256 executionsCompleted; // Number of completed executions
        bool active;              // Whether strategy is active
    }
    
    // User strategy mappings
    mapping(address => mapping(uint256 => DCAStrategy)) public userStrategies;
    mapping(address => uint256) public userStrategyCount;
    
    // Gelato executor address
    address public gelatoExecutor;
    
    /**
     * @dev Initializes the contract with required addresses.
     * @param _weth Address of the WETH contract.
     * @param _allowanceHolder Address of the AllowanceHolder contract (for 0x API v2).
     * @param _permit2 Address of the Permit2 contract (for gasless approvals).
     * @param _usdt Address of the USDT contract.
     * @param _gelatoExecutor Address of the Gelato executor.
     */
    constructor(
        IWETH _weth, 
        address _allowanceHolder, 
        address _permit2, 
        address _usdt,
        address _gelatoExecutor
    ) {
        WETH = _weth;
        allowanceHolder = _allowanceHolder;
        permit2 = _permit2;
        USDT = _usdt;
        gelatoExecutor = _gelatoExecutor;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyGelatoExecutor() {
        require(msg.sender == gelatoExecutor, "ONLY_GELATO_EXECUTOR");
        _;
    }

    receive() external payable {}

    /**
     * @dev Creates a new DCA strategy for a user.
     * @param _targetToken Token to buy with USDT
     * @param _totalAmount Total USDT amount to use
     * @param _frequency Time between trades in seconds
     * @param _duration Total duration of the strategy in seconds
     */
    function createStrategy(
        address _targetToken,
        uint256 _totalAmount,
        uint256 _frequency,
        uint256 _duration
    ) external nonReentrant {
        require(_targetToken != address(0), "INVALID_TARGET_TOKEN");
        require(_targetToken != USDT, "TARGET_CANNOT_BE_SOURCE");
        require(_totalAmount > 0, "AMOUNT_MUST_BE_POSITIVE");
        require(_frequency > 0, "FREQUENCY_MUST_BE_POSITIVE");
        require(_duration > 0, "DURATION_MUST_BE_POSITIVE");
        
        // Calculate number of trades and amount per trade
        uint256 numberOfTrades = _duration / _frequency;
        require(numberOfTrades > 0, "DURATION_TOO_SHORT");
        uint256 amountPerTrade = _totalAmount / numberOfTrades;
        require(amountPerTrade > 0, "AMOUNT_PER_TRADE_TOO_SMALL");
        
        // Transfer USDT from user to contract
        IERC20(USDT).transferFrom(msg.sender, address(this), _totalAmount);
        
        // Create strategy
        uint256 strategyId = userStrategyCount[msg.sender];
        userStrategies[msg.sender][strategyId] = DCAStrategy({
            sourceToken: USDT,
            targetToken: _targetToken,
            totalAmount: _totalAmount,
            amountPerTrade: amountPerTrade,
            frequency: _frequency,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            lastExecutionTime: 0,
            executionsCompleted: 0,
            active: true
        });
        
        userStrategyCount[msg.sender]++;
        
        emit StrategyCreated(msg.sender, strategyId, USDT, _targetToken);
    }

    /**
     * @dev Executes a DCA trade for a specific strategy.
     * @param _user Address of the strategy owner
     * @param _strategyId ID of the strategy to execute
     * @param spender Address approved to spend the source token
     * @param swapTarget Address of the 0x API contract to execute the swap
     * @param swapCallData Encoded calldata for the swap (from 0x API quote)
     */
    function executeSwap(
        address _user,
        uint256 _strategyId,
        address spender,
        address payable swapTarget,
        bytes calldata swapCallData
    ) external onlyGelatoExecutor nonReentrant {
        require(
            swapTarget == allowanceHolder || swapTarget == permit2,
            "INVALID_SWAP_TARGET"
        );

        DCAStrategy storage strategy = userStrategies[_user][_strategyId];
        
        require(strategy.active, "STRATEGY_NOT_ACTIVE");
        require(block.timestamp <= strategy.endTime, "STRATEGY_ENDED");
        require(
            block.timestamp >= strategy.lastExecutionTime + strategy.frequency || 
            strategy.lastExecutionTime == 0, 
            "TOO_EARLY_FOR_EXECUTION"
        );
        
        // Get balances before swap
        IERC20 sourceToken = IERC20(strategy.sourceToken);
        IERC20 targetToken = IERC20(strategy.targetToken);
        uint256 targetBalanceBefore = targetToken.balanceOf(address(this));
        
        // Approve and execute swap
        require(
            sourceToken.approve(spender, strategy.amountPerTrade),
            "APPROVAL_FAILED"
        );
        
        (bool success, ) = swapTarget.call(swapCallData);
        require(success, "SWAP_CALL_FAILED");
        
        // Calculate amount received
        uint256 targetBalanceAfter = targetToken.balanceOf(address(this));
        uint256 amountReceived = targetBalanceAfter - targetBalanceBefore;
        
        // Update strategy state
        strategy.lastExecutionTime = block.timestamp;
        strategy.executionsCompleted++;
        
        // Check if strategy is completed
        if (
            strategy.lastExecutionTime + strategy.frequency > strategy.endTime || 
            strategy.executionsCompleted * strategy.amountPerTrade >= strategy.totalAmount
        ) {
            strategy.active = false;
            emit StrategyTerminated(_user, _strategyId);
        }
        
        emit TradeExecuted(_user, _strategyId, strategy.amountPerTrade, amountReceived);
    }

    /**
     * @dev Terminates a DCA strategy and returns remaining funds to the user.
     * @param _strategyId ID of the strategy to terminate
     */
    function terminateStrategy(uint256 _strategyId) external nonReentrant {
        DCAStrategy storage strategy = userStrategies[msg.sender][_strategyId];
        require(strategy.active, "STRATEGY_NOT_ACTIVE");
        
        // Calculate remaining amount
        uint256 executedAmount = strategy.executionsCompleted * strategy.amountPerTrade;
        uint256 remainingAmount = strategy.totalAmount - executedAmount;
        
        // Mark strategy as inactive
        strategy.active = false;
        
        // Return remaining funds to user
        if (remainingAmount > 0) {
            IERC20(strategy.sourceToken).transfer(msg.sender, remainingAmount);
        }
        
        emit StrategyTerminated(msg.sender, _strategyId);
        emit WithdrawnFunds(msg.sender, strategy.sourceToken, remainingAmount);
    }

    /**
     * @dev Withdraws accumulated target tokens from a strategy.
     * @param _strategyId ID of the strategy
     */
    function withdrawTargetTokens(uint256 _strategyId) external nonReentrant {
        DCAStrategy storage strategy = userStrategies[msg.sender][_strategyId];
        require(strategy.targetToken != address(0), "INVALID_STRATEGY");
        
        IERC20 targetToken = IERC20(strategy.targetToken);
        uint256 balance = targetToken.balanceOf(address(this));
        
        require(balance > 0, "NO_TOKENS_TO_WITHDRAW");
        require(targetToken.transfer(msg.sender, balance), "TRANSFER_FAILED");
        
        emit WithdrawnFunds(msg.sender, strategy.targetToken, balance);
    }

    /**
     * @dev Gets the token balances for a user's strategy.
     * @param _user Address of the user
     * @param _strategyId ID of the strategy
     * @return sourceBalance Balance of source token (USDT)
     * @return targetBalance Balance of target token
     */
    function getStrategyBalances(address _user, uint256 _strategyId) 
        external 
        view 
        returns (uint256 sourceBalance, uint256 targetBalance) 
    {
        DCAStrategy storage strategy = userStrategies[_user][_strategyId];
        
        // For simplicity, we're returning the contract's balance of these tokens
        // In a production system, you'd want to track per-strategy balances
        sourceBalance = IERC20(strategy.sourceToken).balanceOf(address(this));
        targetBalance = IERC20(strategy.targetToken).balanceOf(address(this));
        
        return (sourceBalance, targetBalance);
    }

    /**
     * @dev Updates the Gelato executor address.
     * @param _newExecutor New executor address
     */
    function updateGelatoExecutor(address _newExecutor) external onlyOwner {
        require(_newExecutor != address(0), "INVALID_ADDRESS");
        gelatoExecutor = _newExecutor;
    }

    /**
     * @dev Withdraws any ERC20 token from the contract (admin function).
     * @param token ERC20 token to withdraw
     * @param amount Amount to withdraw
     */
    function adminWithdrawToken(IERC20 token, uint256 amount) external onlyOwner {
        require(token.transfer(msg.sender, amount), "TOKEN_TRANSFER_FAILED");
    }

    /**
     * @dev Withdraws ETH from the contract (admin function).
     * @param amount Amount of ETH to withdraw
     */
    function adminWithdrawETH(uint256 amount) external onlyOwner {
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH_TRANSFER_FAILED");
    }
} 