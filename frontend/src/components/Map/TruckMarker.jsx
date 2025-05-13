import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const TruckMarker = ({ map, position }) => {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || !position || !position.latitude || !position.longitude) return;

    // Create or update marker
    if (!markerRef.current) {
      // Create truck marker element
      const el = document.createElement('div');
      el.className = 'truck-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundImage = 'url(/truck-icon.png)';
      el.style.backgroundSize = 'cover';
      
      // Create marker
      markerRef.current = new mapboxgl.Marker({
        element: el,
        rotation: position.heading || 0
      })
        .setLngLat([position.longitude, position.latitude])
        .addTo(map);
    } else {
      // Update existing marker position
      markerRef.current.setLngLat([position.longitude, position.latitude]);
      
      // Update marker rotation if heading is available
      if (position.heading !== null && position.heading !== undefined) {
        markerRef.current.setRotation(position.heading);
      }
    }

    // Clean up on unmount
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
    };
  }, [map, position]);

  // This component doesn't render anything directly
  return null;
};

export default TruckMarker;