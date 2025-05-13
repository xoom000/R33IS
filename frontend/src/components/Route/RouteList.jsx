import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import StopItem from './StopItem';
import { customerService } from '../../services/api';
import { calculateDistance } from '../../services/geocodingService';

const RouteList = ({ 
  currentPosition,
  onSelectCustomer,
  activeCustomerId,
  onReorderRoute
}) => {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  
  // Calculate route progress
  useEffect(() => {
    if (stops.length > 0) {
      const completedStops = stops.filter(stop => stop.completed).length;
      setProgress({
        completed: completedStops,
        total: stops.length,
        percentage: Math.round((completedStops / stops.length) * 100)
      });
    }
  }, [stops]);
  
  // Load route stops from API
  useEffect(() => {
    const loadRouteStops = async () => {
      try {
        setLoading(true);
        
        // In a real implementation, this would be filtered by route or date
        const response = await customerService.getAll({ limit: 100 });
        
        // Add calculated fields to each stop
        const stopsWithData = response.data.map(customer => ({
          ...customer,
          completed: false, // Track completion state
          distance: null, // Will be updated when we have currentPosition
          eta: null // Estimated time of arrival
        }));
        
        setStops(stopsWithData);
        setError(null);
      } catch (err) {
        console.error('Failed to load route stops:', err);
        setError('Failed to load route data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadRouteStops();
  }, []);
  
  // Update distances when currentPosition changes
  useEffect(() => {
    if (!currentPosition || stops.length === 0) return;
    
    // Calculate distance from current position to each stop
    const updatedStops = stops.map(stop => {
      if (!stop.latitude || !stop.longitude) return stop;
      
      const distance = calculateDistance(
        currentPosition.latitude,
        currentPosition.longitude,
        stop.latitude,
        stop.longitude
      );
      
      // Rough estimate: 1 meter = 1 second at 3.6 km/h
      const eta = Math.round(distance / 1000 * 12); // minutes, assuming 5 km/h
      
      return { ...stop, distance, eta };
    });
    
    // Sort by distance if not manually sorted
    const sortedStops = [...updatedStops].sort((a, b) => {
      // If one has no distance, put it at the end
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      
      // Put completed stops at the end
      if (a.completed && !b.completed) return 1;
      if (!a.completed && b.completed) return -1;
      
      // Sort by distance
      return a.distance - b.distance;
    });
    
    setStops(sortedStops);
  }, [currentPosition, stops.length]);
  
  // Handle drag and drop reordering
  const handleDragEnd = (result) => {
    // Dropped outside the list
    if (!result.destination) return;
    
    const reorderedStops = Array.from(stops);
    const [removed] = reorderedStops.splice(result.source.index, 1);
    reorderedStops.splice(result.destination.index, 0, removed);
    
    setStops(reorderedStops);
    
    // Notify parent about the reordered route
    if (onReorderRoute) {
      onReorderRoute(reorderedStops);
    }
  };
  
  // Toggle stop completion status
  const toggleStopCompletion = (stopId) => {
    const updatedStops = stops.map(stop => 
      stop.id === stopId ? { ...stop, completed: !stop.completed } : stop
    );
    
    setStops(updatedStops);
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading route...</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow divide-y">
      {/* Route progress */}
      <div className="p-4">
        <h3 className="font-bold text-gray-700 mb-2">Route Progress</h3>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div 
            className="bg-blue-500 h-4 rounded-full" 
            style={{ width: `${progress.percentage || 0}%` }}
          ></div>
        </div>
        <div className="text-sm text-gray-500 flex justify-between">
          <span>{progress.completed} of {progress.total} stops completed</span>
          <span>{progress.percentage || 0}%</span>
        </div>
      </div>
      
      {/* Route stops list */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-700">Today's Stops</h3>
          <button 
            className="text-sm text-blue-500 hover:text-blue-700 focus:outline-none"
            onClick={() => setStops(stops => stops.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity)))}
          >
            Sort by Distance
          </button>
        </div>
        
        {stops.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            No stops scheduled for today
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="route-stops">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {stops.map((stop, index) => (
                    <Draggable key={stop.id} draggableId={stop.id.toString()} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <StopItem
                            stop={stop}
                            isActive={activeCustomerId === stop.id}
                            onSelect={() => onSelectCustomer(stop.id)}
                            onToggleComplete={() => toggleStopCompletion(stop.id)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
};

export default RouteList;