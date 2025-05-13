import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const CustomerMarker = ({ map, customer, isActive, onClick }) => {
  const markerRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (!map || !customer || !customer.latitude || !customer.longitude) return;

    // Create or update marker
    if (!markerRef.current) {
      // Create marker element
      const el = document.createElement('div');
      el.className = 'customer-marker';
      el.style.width = '25px';
      el.style.height = '25px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isActive ? '#2563eb' : '#64748b';
      el.style.border = '2px solid white';
      el.style.cursor = 'pointer';
      
      // Create popup
      popupRef.current = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div>
            <h3 class="font-bold">${customer.name}</h3>
            <p>${customer.address}</p>
            <p>${customer.city}, ${customer.state} ${customer.zipCode}</p>
          </div>
        `);
      
      // Create marker
      markerRef.current = new mapboxgl.Marker(el)
        .setLngLat([customer.longitude, customer.latitude])
        .setPopup(popupRef.current)
        .addTo(map);
      
      // Add click handler
      el.addEventListener('click', () => {
        if (onClick) {
          onClick(customer.id);
        }
      });
    } else {
      // Update existing marker
      markerRef.current.setLngLat([customer.longitude, customer.latitude]);
      
      // Update marker color
      const el = markerRef.current.getElement();
      el.style.backgroundColor = isActive ? '#2563eb' : '#64748b';
      
      // Update popup content
      if (popupRef.current) {
        popupRef.current.setHTML(`
          <div>
            <h3 class="font-bold">${customer.name}</h3>
            <p>${customer.address}</p>
            <p>${customer.city}, ${customer.state} ${customer.zipCode}</p>
          </div>
        `);
      }
    }

    // Clean up on unmount
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
    };
  }, [map, customer, isActive, onClick]);

  // This component doesn't render anything directly
  return null;
};

export default CustomerMarker;