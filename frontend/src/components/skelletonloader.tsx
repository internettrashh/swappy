import { ArrowDown} from 'lucide-react'

function SwapSkeletonLoader() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-[#131b29] rounded-3xl w-full max-w-md p-6 border border-[#1f2937] shadow-xl animate-pulse">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 bg-gray-700 rounded w-1/4"></div>
          <div className="bg-gray-700 rounded-full p-2"></div>
        </div>

        {/* From Section */}
        <div className="bg-[#0d141f] rounded-xl p-4 mb-2">
          <div className="flex justify-between items-center mb-2">
            <div className="h-4 bg-gray-700 rounded w-1/6"></div>
            <div className="h-6 bg-gray-700 rounded-full w-1/3"></div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-700 mr-2"></div>
              <div className="h-6 bg-gray-700 rounded w-1/2"></div>
            </div>
            <div className="h-10 bg-gray-700 rounded w-1/4"></div>
          </div>s
          <div className="flex justify-between items-center mt-2">
            <div className="h-6 bg-gray-700 rounded w-1/6"></div>
            <div className="h-4 bg-gray-700 rounded w-1/6"></div>
          </div>
        </div>

        {/* Swap Icon */}
        <div className="flex justify-center -my-3 relative z-10">
          <div className="bg-[#1a2232] p-3 rounded-full">
            <ArrowDown size={20} className="text-gray-700" />
          </div>
        </div>

        {/* To Section */}
        <div className="bg-[#0d141f] rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="h-4 bg-gray-700 rounded w-1/6"></div>
            <div className="h-6 bg-gray-700 rounded-full w-1/3"></div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-gray-700 mr-2"></div>
              <div className="h-6 bg-gray-700 rounded w-1/2"></div>
            </div>
            <div className="h-10 bg-gray-700 rounded w-1/4"></div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <div className="h-6 bg-gray-700 rounded w-1/6"></div>
            <div className="h-4 bg-gray-700 rounded w-1/6"></div>
          </div>
        </div>

        {/* Recipient Address */}
        <div className="bg-[#0d141f] rounded-xl p-4 mb-4">
          <div className="h-6 bg-gray-700 rounded w-full"></div>
        </div>

        {/* Exchange Rate */}
        <div className="flex justify-between items-center mb-4">
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
        </div>

        {/* Swap Button */}
        <div className="h-14 bg-gray-700 rounded-full w-full"></div>
      </div>
    </div>
  )
}

export default SwapSkeletonLoader