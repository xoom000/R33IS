import React from 'react';

const CompletionTracker = ({ stops }) => {
  // Calculate statistics
  const totalStops = stops.length;
  const completedStops = stops.filter(stop => stop.completed).length;
  const percentageCompleted = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
  
  // Calculate estimated time to completion (in minutes)
  const remainingStops = stops.filter(stop => !stop.completed);
  const totalRemainingETA = remainingStops.reduce((total, stop) => total + (stop.eta || 0), 0);
  
  // Format time remaining
  const formatTimeRemaining = (minutes) => {
    if (!minutes) return 'Unknown';
    
    if (minutes < 60) {
      return `${Math.round(minutes)} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-bold text-gray-700 mb-4">Route Completion</h3>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-6 mb-3">
        <div 
          className="bg-blue-500 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white" 
          style={{ width: `${percentageCompleted}%` }}
        >
          {percentageCompleted > 10 ? `${percentageCompleted}%` : ''}
        </div>
      </div>
      
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Stops stats */}
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-sm text-gray-500">Stops</div>
          <div className="text-xl font-semibold">{completedStops} / {totalStops}</div>
          <div className="text-sm text-gray-500">
            {remainingStops.length} remaining
          </div>
        </div>
        
        {/* Time stats */}
        <div className="bg-gray-50 p-3 rounded">
          <div className="text-sm text-gray-500">Est. Time Remaining</div>
          <div className="text-xl font-semibold">
            {formatTimeRemaining(totalRemainingETA)}
          </div>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
      
      {/* Status message */}
      <div className={`text-center p-2 rounded-lg ${
        percentageCompleted === 100 
          ? 'bg-green-100 text-green-700' 
          : percentageCompleted >= 50
            ? 'bg-blue-100 text-blue-700'
            : 'bg-yellow-100 text-yellow-700'
      }`}>
        {percentageCompleted === 100 
          ? 'Route completed! Good job!' 
          : percentageCompleted >= 50
            ? `You're making good progress!`
            : 'Keep going, you're on track!'}
      </div>
    </div>
  );
};

export default CompletionTracker;