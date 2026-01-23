/**
 * Opens address in native maps app with fallback to web
 * iOS: Google Maps app -> web fallback
 * Android: geo: URI -> web fallback
 * Desktop: web
 */
export const openInMaps = (address) => {
  const encodedAddress = encodeURIComponent(address);

  // Detect platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  // Web fallback URL
  const webUrl = `https://maps.google.com/?q=${encodedAddress}`;

  if (isIOS) {
    // On iOS, try to open Google Maps app directly
    // Using comgooglemaps:// scheme
    const googleMapsUrl = `comgooglemaps://?q=${encodedAddress}`;

    // Create a hidden iframe to test if the app is installed
    const start = Date.now();
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Try to open the app
    window.location.href = googleMapsUrl;

    // If the app doesn't open within 1 second, fall back to web
    setTimeout(() => {
      document.body.removeChild(iframe);
      const elapsed = Date.now() - start;
      // If we're still here and less than 2 seconds passed, the app likely isn't installed
      if (elapsed < 2000) {
        window.open(webUrl, '_blank');
      }
    }, 1000);

  } else if (isAndroid) {
    // On Android, use geo: URI which opens in default maps app
    const geoUrl = `geo:0,0?q=${encodedAddress}`;

    // Try to open with geo: scheme
    window.location.href = geoUrl;

    // Fallback to web after short delay if geo: didn't work
    setTimeout(() => {
      window.open(webUrl, '_blank');
    }, 500);

  } else {
    // Desktop: Just open web version in new tab
    window.open(webUrl, '_blank');
  }
};
