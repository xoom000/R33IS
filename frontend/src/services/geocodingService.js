import axios from 'axios';
import { getCachedGeocode, cacheGeocode } from './storageService';

// Mapbox access token would typically come from environment variables
const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

// In-memory cache to reduce API calls during the session
// This is in addition to the persistent IndexedDB cache
const geocodeCache = new Map();

/**
 * Geocode an address to latitude and longitude coordinates
 * 
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lng: number}>} - Geocoded coordinates
 */
export const geocodeAddress = async (address) => {
  if (!address) {
    throw new Error('Address is required for geocoding');
  }
  
  // First check in-memory cache
  if (geocodeCache.has(address)) {
    console.log('Geocode cache hit (memory):', address);
    return geocodeCache.get(address);
  }
  
  try {
    // Then check IndexedDB cache
    const cachedResult = await getCachedGeocode(address);
    if (cachedResult && cachedResult.coordinates) {
      console.log('Geocode cache hit (IndexedDB):', address);
      
      // Store in memory cache too
      geocodeCache.set(address, cachedResult.coordinates);
      return cachedResult.coordinates;
    }
    
    // If not cached, call Mapbox Geocoding API
    const response = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
      {
        params: {
          access_token: MAPBOX_ACCESS_TOKEN,
          limit: 1,
          types: 'address'
        }
      }
    );
    
    if (response.data.features && response.data.features.length > 0) {
      const [lng, lat] = response.data.features[0].center;
      const coordinates = { lat, lng };
      
      // Save to both caches
      geocodeCache.set(address, coordinates);
      await cacheGeocode(address, coordinates);
      
      return coordinates;
    } else {
      throw new Error('No results found for the address');
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error(`Failed to geocode address: ${error.message}`);
  }
};

/**
 * Batch geocode multiple addresses with rate limiting
 * 
 * @param {Array<string>} addresses - Array of addresses to geocode
 * @param {number} concurrency - Number of concurrent requests (default: 2)
 * @param {number} delayMs - Delay between batches in ms (default: 1000)
 * @returns {Promise<Array<{address: string, coordinates: {lat: number, lng: number}, error: string?}>>}
 */
export const batchGeocodeAddresses = async (addresses, concurrency = 2, delayMs = 1000) => {
  const results = [];
  
  // Process addresses in batches to avoid rate limits
  for (let i = 0; i < addresses.length; i += concurrency) {
    const batch = addresses.slice(i, i + concurrency);
    const batchPromises = batch.map(async (address) => {
      try {
        const coordinates = await geocodeAddress(address);
        return { address, coordinates };
      } catch (error) {
        return { address, error: error.message };
      }
    });
    
    // Wait for current batch to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches (except for the last batch)
    if (i + concurrency < addresses.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};

/**
 * Calculate distance between two points using the Haversine formula
 * 
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @param {string} unit - Unit of distance ('km' or 'mi', default: 'mi')
 * @returns {number} - Distance in specified unit
 */
export const calculateDistance = (lat1, lng1, lat2, lng2, unit = 'mi') => {
  if (lat1 === lat2 && lng1 === lng2) {
    return 0;
  }
  
  // Convert latitude and longitude to radians
  const radlat1 = (Math.PI * lat1) / 180;
  const radlat2 = (Math.PI * lat2) / 180;
  const theta = lng1 - lng2;
  const radtheta = (Math.PI * theta) / 180;
  
  // Haversine formula
  let dist = Math.sin(radlat1) * Math.sin(radlat2) + 
             Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
  
  dist = Math.acos(Math.min(dist, 1));
  dist = (dist * 180) / Math.PI;
  dist = dist * 60 * 1.1515; // Distance in miles
  
  // Convert to specified unit
  if (unit === 'km') {
    return dist * 1.609344;
  }
  
  return dist; // Distance in miles
};

/**
 * Clear geocoding cache
 * 
 * @returns {Promise<void>}
 */
export const clearGeocodingCache = async () => {
  // Clear in-memory cache
  geocodeCache.clear();
  
  // Clear IndexedDB cache will be handled by storageService
  // when calling clearStore('geocoding')
};

/**
 * Format coordinates for display
 * 
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} - Formatted coordinates string
 */
export const formatCoordinates = (lat, lng) => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

/**
 * Format an address into a single line
 * 
 * @param {Object} address - Address object with street, city, state, zipCode
 * @returns {string} - Formatted address string
 */
export const formatAddress = (address) => {
  if (!address) return '';
  
  const { street, city, state, zipCode } = address;
  return `${street || ''}, ${city || ''}, ${state || ''} ${zipCode || ''}`.trim();
};