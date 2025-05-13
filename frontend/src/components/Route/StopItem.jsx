import React from 'react';

const StopItem = ({ 
  stop, 
  isActive, 
  onSelect, 
  onToggleComplete 
}) => {
  // Format distance for display
  const formatDistance = (meters) => {
    if (meters === null || meters === undefined) return 'N/A';
    
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  };
  
  // Format ETA for display
  const formatETA = (minutes) => {
    if (minutes === null || minutes === undefined) return 'N/A';
    
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}m`;
    }
  };
  
  return (
    <div 
      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
        stop.completed 
          ? 'bg-gray-100 border-gray-300' 
          : isActive
            ? 'bg-blue-50 border-blue-300'
            : 'bg-white border-gray-200 hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {/* Completion checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete();
            }}
            className={`mt-1 w-5 h-5 flex-shrink-0 rounded-full border ${
              stop.completed 
                ? 'bg-green-500 border-green-500 text-white flex items-center justify-center' 
                : 'border-gray-300'
            }`}
            aria-label={stop.completed ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {stop.completed && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
              </svg>
            )}
          </button>
          
          {/* Stop information */}
          <div className={stop.completed ? 'text-gray-500' : ''}>
            <h4 className="font-medium">{stop.name}</h4>
            <p className="text-sm">{stop.address}</p>
            <p className="text-xs text-gray-500">{stop.city}, {stop.state} {stop.zipCode}</p>
          </div>
        </div>
        
        {/* Distance and ETA */}
        <div className="text-right text-sm">
          <div className="font-medium">
            {formatDistance(stop.distance)}
          </div>
          {stop.eta && (
            <div className="text-xs text-gray-500">
              ETA: {formatETA(stop.eta)}
            </div>
          )}
        </div>
      </div>
      
      {/* Additional information or quick actions */}
      <div className="mt-2 flex justify-between items-center">
        <div className="flex gap-1">
          {stop.specialInstructions && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
              Special Instructions
            </span>
          )}
          {stop.notes_count > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {stop.notes_count} Notes
            </span>
          )}
        </div>
        
        {/* Drag handle indicator */}
        <div className="text-gray-400 flex-shrink-0">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" clipRule="evenodd"></path>
            <path fillRule="evenodd" d="M15 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" clipRule="evenodd"></path>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default StopItem;