import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import OrderHistoryModal from './orderhistory';

interface OrderHistoryNavIconProps {
  walletAddress: string;
}

const OrderHistoryNavIcon: React.FC<OrderHistoryNavIconProps> = ({ walletAddress }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  
  return (
    <>
      <button 
        onClick={openModal}
        className="p-2 rounded-full hover:bg-gray-800 transition-colors"
        title="Order History"
      >
        <Clock className="w-5 h-5" />
      </button>
      
      <OrderHistoryModal 
        isOpen={isModalOpen}
        onClose={closeModal}
        walletAddress={walletAddress}
      />
    </>
  );
};

export default OrderHistoryNavIcon;