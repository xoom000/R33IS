import React, { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

const RouteDisplay = ({ map, origin, destination, routeColor = '#2563eb' }) => {
  useEffect(() => {
    if (!map || !origin || !destination) return;
    
    // Only proceed if we have valid coordinates
    if (!origin.longitude || !origin.latitude || !destination.longitude || !destination.latitude) {
      return;
    }

    // Remove existing route layers if any
    if (map.getLayer('route')) {
      map.removeLayer('route');
    }
    if (map.getSource('route')) {
      map.removeSource('route');
    }
    
    // Fetch route from Mapbox Directions API
    const start = [origin.longitude, origin.latitude];
    const end = [destination.longitude, destination.latitude];
    
    fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`)
      .then(response => response.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          
          // Add route to map
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            }
          });
          
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': routeColor,
              'line-width': 6,
              'line-opacity': 0.8
            }
          });
          
          // Fit map to route
          const bounds = new mapboxgl.LngLatBounds();
          route.geometry.coordinates.forEach(coord => {
            bounds.extend(coord);
          });
          
          map.fitBounds(bounds, {
            padding: 60,
            maxZoom: 15
          });
        }
      })
      .catch(error => {
        console.error('Error fetching directions:', error);
      });

    // Clean up on unmount or when props change
    return () => {
      if (map.getLayer('route')) {
        map.removeLayer('route');
      }
      if (map.getSource('route')) {
        map.removeSource('route');
      }
    };
  }, [map, origin, destination, routeColor]);

  // This component doesn't render anything directly
  return null;
};

export default RouteDisplay;