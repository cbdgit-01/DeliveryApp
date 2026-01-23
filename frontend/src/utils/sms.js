/**
 * Opens native SMS app with pre-filled message
 * Handles different URL schemes for iOS and Android
 */
export const openSmsWithMessage = (phoneNumber, message) => {
  // Clean phone number (remove non-digits except +)
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');

  // iOS uses & for body separator, Android uses ?
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIOS ? '&' : '?';
  const encodedMessage = encodeURIComponent(message);

  // Open SMS app with pre-filled message
  window.location.href = `sms:${cleanPhone}${separator}body=${encodedMessage}`;
};
