import { useEffect, useState, useCallback } from 'react';
import './UpdatePrompt.css';

const UpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);

  const checkForUpdates = useCallback(async () => {
    try {
      // Fetch version.json with cache busting
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        const serverVersion = data.version;
        
        // Get stored version from localStorage
        const storedVersion = localStorage.getItem('app_version');
        
        if (!storedVersion) {
          // First visit - store the version
          localStorage.setItem('app_version', serverVersion);
          setCurrentVersion(serverVersion);
        } else if (storedVersion !== serverVersion) {
          // Version mismatch - update available!
          setCurrentVersion(serverVersion);
          setShowPrompt(true);
        }
      }
    } catch (error) {
      console.log('Version check failed:', error);
    }
  }, []);

  useEffect(() => {
    // Check immediately after a short delay
    const initialCheck = setTimeout(checkForUpdates, 2000);

    // Check when app becomes visible (user returns to app)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Check every minute
    const interval = setInterval(checkForUpdates, 60 * 1000);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdates]);

  const handleRefresh = () => {
    // Update stored version before refresh
    if (currentVersion) {
      localStorage.setItem('app_version', currentVersion);
    }
    
    // Clear all caches if possible
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Hard refresh
    window.location.reload(true);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="update-prompt">
      <div className="update-prompt-content">
        <span className="update-icon">↻</span>
        <span className="update-text">New version available</span>
        <button onClick={handleRefresh} className="update-btn">
          Refresh
        </button>
        <button onClick={handleDismiss} className="dismiss-btn">
          ✕
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
