import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useLocation } from '../../contexts/LocationContext';

// Get mapbox token from environment or config
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || 'your_mapbox_token_here';

const MapView = ({ 
  customers = [], 
  activeCustomerId = null,
  onCustomerSelect,
  showDirections = false 
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const truckMarker = useRef(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [customerMarkers, setCustomerMarkers] = useState([]);
  
  const { currentPosition, isTracking, startTracking } = useLocation();

  // Initialize map when component mounts
  useEffect(() => {
    if (map.current) return; // Map already initialized
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.5, 40], // Default location (will be updated when we get user position)
      zoom: 12
    });

    // Add zoom and rotation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add geolocate control
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    
    map.current.addControl(geolocateControl, 'top-right');
    
    // Set up event listeners
    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Start location tracking when map is loaded
      if (!isTracking) {
        startTracking();
      }
    });

    // Clean up on unmount
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [isTracking, startTracking]);

  // Update map when current position changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !currentPosition) return;
    
    const { latitude, longitude, heading } = currentPosition;
    
    // Center map on current position if it's the first position we get
    if (!truckMarker.current) {
      map.current.jumpTo({
        center: [longitude, latitude],
        zoom: 15
      });
      
      // Create truck marker element
      const el = document.createElement('div');
      el.className = 'truck-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundImage = 'url(/truck-icon.png)';
      el.style.backgroundSize = 'cover';
      
      // Add truck marker to map
      truckMarker.current = new mapboxgl.Marker({
        element: el,
        rotation: heading || 0
      })
        .setLngLat([longitude, latitude])
        .addTo(map.current);
    } else {
      // Update existing truck marker
      truckMarker.current.setLngLat([longitude, latitude]);
      
      // Update marker rotation if we have heading data
      if (heading !== null) {
        truckMarker.current.setRotation(heading);
      }
    }
  }, [currentPosition, mapLoaded]);

  // Add customer markers when customers or map changes
  useEffect(() => {
    if (!map.current || !mapLoaded || customers.length === 0) return;
    
    // Remove existing markers
    customerMarkers.forEach(marker => marker.remove());
    
    // Create new markers
    const markers = customers.map(customer => {
      // Skip customers without coordinates
      if (!customer.latitude || !customer.longitude) return null;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'customer-marker';
      el.style.width = '25px';
      el.style.height = '25px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = customer.id === activeCustomerId ? '#2563eb' : '#64748b';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';
      
      // Create popup for customer info
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div>
            <h3 class="font-bold">${customer.name}</h3>
            <p>${customer.address}</p>
            <p>${customer.city}, ${customer.state} ${customer.zipCode}</p>
          </div>
        `);
      
      // Create and add the marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([customer.longitude, customer.latitude])
        .setPopup(popup)
        .addTo(map.current);
      
      // Add click handler
      el.addEventListener('click', () => {
        if (onCustomerSelect) {
          onCustomerSelect(customer.id);
        }
      });
      
      return marker;
    }).filter(Boolean); // Remove null markers (customers without coordinates)
    
    setCustomerMarkers(markers);
    
    // Fit map to include all markers if we have customers and a current position
    if (markers.length > 0 && currentPosition) {
      const bounds = new mapboxgl.LngLatBounds();
      
      // Add current position to bounds
      bounds.extend([currentPosition.longitude, currentPosition.latitude]);
      
      // Add all customer markers to bounds
      customers.forEach(customer => {
        if (customer.latitude && customer.longitude) {
          bounds.extend([customer.longitude, customer.latitude]);
        }
      });
      
      // Fit the map to the bounds
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }
    
    // Clean up markers on unmount
    return () => {
      markers.forEach(marker => marker.remove());
    };
  }, [customers, mapLoaded, activeCustomerId, currentPosition, onCustomerSelect, customerMarkers]);

  // Update directions when showDirections changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !currentPosition) return;
    
    // Find the active customer
    const activeCustomer = customers.find(c => c.id === activeCustomerId);
    
    if (showDirections && activeCustomer && activeCustomer.latitude && activeCustomer.longitude) {
      // Remove existing route layers if any
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route');
      }
      if (map.current.getSource('route')) {
        map.current.removeSource('route');
      }
      
      // Get directions using Mapbox Directions API
      const start = [currentPosition.longitude, currentPosition.latitude];
      const end = [activeCustomer.longitude, activeCustomer.latitude];
      
      fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`)
        .then(response => response.json())
        .then(data => {
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            
            // Add route to map
            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: route.geometry
              }
            });
            
            map.current.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#2563eb',
                'line-width': 6,
                'line-opacity': 0.8
              }
            });
            
            // Fit map to route
            const bounds = new mapboxgl.LngLatBounds();
            route.geometry.coordinates.forEach(coord => {
              bounds.extend(coord);
            });
            
            map.current.fitBounds(bounds, {
              padding: 60,
              maxZoom: 15
            });
          }
        })
        .catch(error => {
          console.error('Error fetching directions:', error);
        });
    } else {
      // Remove route if directions are disabled
      if (map.current.getLayer('route')) {
        map.current.removeLayer('route');
      }
      if (map.current.getSource('route')) {
        map.current.removeSource('route');
      }
    }
  }, [showDirections, activeCustomerId, customers, currentPosition, mapLoaded]);

  return (
    <div className="w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg shadow-md" />
    </div>
  );
};

export default MapView;