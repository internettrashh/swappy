import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Check, Clock, Activity, X } from 'lucide-react';

// Order interface to match API response
interface Order {
  orderId: string;
  orderType: string;
  status: string;
  sourceToken: string;
  targetToken: string;
  amount?: string;
  totalAmount?: string;
  remainingAmount?: string;
  targetPrice?: number;
  direction?: string;
  createdAt?: string;
  expiryDate?: string;
  startDate?: string;
  progress?: {
    completedSwaps: number;
    totalSwaps: number;
    percentageComplete: number;
  };
  executedTrade?: any;
}

// Token interface
interface Token {
  name: string;
  decimals: number;
  symbol: string;
  address: string;
  isNative?: boolean;
}

interface OrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

// Token list from another file
const tokenlist: Token[] = [
  {
    name: "Monad",
    decimals: 18,
    symbol: "MON",
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // NATIVE_TOKEN_ADDRESS
    isNative: true,
  },
  {
    name: "Wrapped Monad",
    decimals: 18,
    symbol: "WMON",
    address: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
  },
  {
    name: "Tether USD",
    decimals: 18,
    symbol: "USDT",
    address: "0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D",
  },
  {
    name: "Wrapped Ethereum",
    decimals: 18,
    symbol: "WETH",
    address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
  },
  {
    name: "Wrapped Bitcoin",
    decimals: 18,
    symbol: "WBTC",
    address: "0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d",
  },
  {
    name: "USD Coin",
    decimals: 18,
    symbol: "USDC",
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
  },
  {
    name: "Molandak",
    decimals: 18,
    symbol: "DAK",
    address: "0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714",
  },
];

// Modal component
function Modal({ isOpen, onClose, title, children }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-md transition-all duration-300"
        onClick={onClose}
      />
      <div className="relative bg-[#2a2f35] rounded-lg w-full max-w-2xl mx-4 shadow-xl max-h-[80vh] overflow-hidden animate-fadeIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-200">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function OrderHistoryModal({ isOpen, onClose, walletAddress }: OrderHistoryModalProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch orders when the modal is opened
    useEffect(() => {
        if (isOpen && walletAddress) {
            fetchOrders();
        }
    }, [isOpen, walletAddress]);

    const fetchOrders = async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/wallet/${walletAddress}/orders`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch orders: ${response.status}`);
            }
            
            const data = await response.json();
            setOrders(data.orders || []);
        } catch (err) {
            console.error("Error fetching orders:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch orders");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOrderClick = (order: Order) => {
        setSelectedOrder(order);
        setIsOrderDetailOpen(true);
    };

    const closeOrderDetail = () => {
        setIsOrderDetailOpen(false);
        setSelectedOrder(null);
    };

    // Function to get token symbol from address
    const getTokenSymbol = (address: string): string => {
        const token = tokenlist.find(t => t.address.toLowerCase() === address.toLowerCase());
        return token ? token.symbol : 'Unknown';
    };

    const formatAmount = (amount: string | undefined): string => {
        if (!amount) return '0';
        // Convert from wei to ether (simple division by 10^18)
        return (Number(amount) / 1e18).toString();
    };

    const getStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
          case 'pending':
            return <Clock className="w-4 h-4 text-yellow-500" />;
          case 'active':
            return <Activity className="w-4 h-4 text-blue-500" />;
          case 'completed':
            return <Check className="w-4 h-4 text-green-500" />;
          case 'complete':
            return <Check className="w-4 h-4 text-green-500" />;
          default:
            return null;
        }
    };
    
    // Content for the main modal
    const modalContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-400">
                    <p>Error loading orders: {error}</p>
                </div>
            );
        }

        if (orders.length === 0) {
            return (
                <div className="text-center p-8 text-gray-400">
                    <p>No orders found for this wallet.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 text-sm text-gray-400 pb-2 border-b border-gray-700">
                    <div>Status</div>
                    <div>From</div>
                    <div>To</div>
                    <div className="text-right">ID</div>
                </div>
                <div className="space-y-2">
                    {orders.map((order) => (
                        <div 
                            key={order.orderId}
                            className="grid grid-cols-4 gap-4 p-3 rounded-lg hover:bg-[#1c2127] transition-colors cursor-pointer"
                            onClick={() => handleOrderClick(order)}
                        >
                            <div className="flex items-center space-x-2">
                                {getStatusIcon(order.status)}
                                <span className="text-sm capitalize">{order.status}</span>
                            </div>
                            <div className="text-sm">
                                 {getTokenSymbol(order.sourceToken)}
                            </div>
                            <div className="text-sm">
                                {getTokenSymbol(order.targetToken)}
                            </div>
                            <div className="text-right text-xs text-gray-400">
                                #{order.orderId.substring(0, 8)}...
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Order History">
                {modalContent()}
            </Modal>

            <Modal 
                isOpen={isOrderDetailOpen} 
                onClose={closeOrderDetail} 
                title={`Order Details #${selectedOrder?.orderId.substring(0, 8)}...`}
            >
                {selectedOrder && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-[#1c2127] rounded-lg">
                                <h3 className="text-sm text-gray-400 mb-1">Order ID</h3>
                                <p className="text-sm font-mono">{selectedOrder.orderId}</p>
                            </div>
                            <div className="p-3 bg-[#1c2127] rounded-lg">
                                <h3 className="text-sm text-gray-400 mb-1">Type</h3>
                                <p className="text-sm capitalize">{selectedOrder.orderType}</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-[#1c2127] rounded-lg">
                                <h3 className="text-sm text-gray-400 mb-1">Status</h3>
                                <div className="flex items-center space-x-2">
                                    {getStatusIcon(selectedOrder.status)}
                                    <span className="text-sm capitalize">{selectedOrder.status}</span>
                                </div>
                            </div>
                            {selectedOrder.direction && (
                                <div className="p-3 bg-[#1c2127] rounded-lg">
                                    <h3 className="text-sm text-gray-400 mb-1">Direction</h3>
                                    <p className="text-sm capitalize">{selectedOrder.direction}</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-[#1c2127] rounded-lg">
                                <h3 className="text-sm text-gray-400 mb-1">From</h3>
                                <div className="flex items-center space-x-2">
                                    <span>{formatAmount(selectedOrder.totalAmount || selectedOrder.amount)}</span>
                                    <span className="font-medium">{getTokenSymbol(selectedOrder.sourceToken)}</span>
                                </div>
                            </div>
                            <div className="p-3 bg-[#1c2127] rounded-lg">
                                <h3 className="text-sm text-gray-400 mb-1">To</h3>
                                <p className="font-medium">{getTokenSymbol(selectedOrder.targetToken)}</p>
                            </div>
                        </div>
                        
                        {selectedOrder.targetPrice && (
                            <div className="p-3 bg-[#1c2127] rounded-lg">
                                <h3 className="text-sm text-gray-400 mb-1">Target Price</h3>
                                <p>{selectedOrder.targetPrice} {getTokenSymbol(selectedOrder.sourceToken)}/{getTokenSymbol(selectedOrder.targetToken)}</p>
                            </div>
                        )}
                        
                        {selectedOrder.progress && (
                            <div className="p-3 bg-[#1c2127] rounded-lg">
                                <h3 className="text-sm text-gray-400 mb-1">Progress</h3>
                                <div className="space-y-1">
                                    <p>Completed: {selectedOrder.progress.completedSwaps}/{selectedOrder.progress.totalSwaps} swaps</p>
                                    <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-blue-500 h-full" 
                                            style={{ width: `${Math.min(100, selectedOrder.progress.percentageComplete)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-right">{Math.min(100, Math.round(selectedOrder.progress.percentageComplete))}% complete</p>
                                </div>
                            </div>
                        )}
                        
                        {(selectedOrder.createdAt || selectedOrder.startDate) && (
                            <div className="p-3 bg-[#1c2127] rounded-lg">
                                <h3 className="text-sm text-gray-400 mb-1">Dates</h3>
                                {selectedOrder.createdAt && (
                                    <p className="text-sm">Created: {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                                )}
                                {selectedOrder.startDate && (
                                    <p className="text-sm">Started: {new Date(selectedOrder.startDate).toLocaleString()}</p>
                                )}
                                {selectedOrder.expiryDate && (
                                    <p className="text-sm">Expires: {new Date(selectedOrder.expiryDate).toLocaleString()}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </>
    );
}

export default OrderHistoryModal;