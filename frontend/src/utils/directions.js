/**
 * Google Maps Directions API wrapper for calculating ETA
 */

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * Get estimated travel time from current location to destination
 * @param {number} originLat - Origin latitude
 * @param {number} originLng - Origin longitude
 * @param {string} destination - Destination address
 * @returns {Promise<string>} - Human-readable ETA (e.g., "25 minutes")
 */
export const getETA = async (originLat, originLng, destination) => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured. Using fallback ETA.');
    return getFallbackETA();
  }

  try {
    // Use CORS proxy or backend endpoint since Directions API doesn't support browser CORS
    // For now, we'll use the Distance Matrix API which can work with JSONP
    const encodedDest = encodeURIComponent(destination);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${encodedDest}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();

    if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
      const duration = data.rows[0].elements[0].duration.text;
      return duration;
    }

    throw new Error('Could not calculate route');
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
