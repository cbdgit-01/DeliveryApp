/**
 * ETA calculation using backend proxy to Google Maps Distance Matrix API
 */

import api from '../services/api';

/**
 * Get estimated travel time from current location to destination
 * @param {number} originLat - Origin latitude
 * @param {number} originLng - Origin longitude
 * @param {string} destination - Destination address
 * @returns {Promise<string>} - Human-readable ETA (e.g., "25 minutes")
 */
export const getETA = async (originLat, originLng, destination) => {
  try {
    const response = await api.get('/api/directions/eta', {
      params: {
        origin_lat: originLat,
        origin_lng: originLng,
        destination: destination,
      },
    });

    const { duration, status } = response.data;

    if (status === 'ok' || status === 'fallback') {
      return duration;
    }

    return getFallbackETA();
  } catch (error) {
    console.error('Error getting ETA:', error);
    return getFallbackETA();
  }
};

/**
 * Fallback ETA when API is unavailable
 * Returns a reasonable estimate for local deliveries
 */
const getFallbackETA = () => {
  return 'approximately 20-30 minutes';
};

/**
 * Format arrival time based on ETA duration
 * @param {string} etaDuration - Duration string (e.g., "25 mins")
 * @returns {string} - Formatted arrival time
 */
export const formatArrivalTime = (etaDuration) => {
  // Parse minutes from duration string
  const minutesMatch = etaDuration.match(/(\d+)\s*min/);
  const hoursMatch = etaDuration.match(/(\d+)\s*hour/);

  let totalMinutes = 0;
  if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);
  if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;

  if (totalMinutes === 0) {
    return etaDuration; // Return original if we can't parse
  }

  const now = new Date();
  now.setMinutes(now.getMinutes() + totalMinutes);

  return now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};
