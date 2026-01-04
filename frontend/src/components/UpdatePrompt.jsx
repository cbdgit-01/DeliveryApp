import { useEffect, useState, useCallback } from 'react';
import './UpdatePrompt.css';

const UpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);

  const checkForUpdates = useCallback(async () => {
    try {
      // Fetch version.json with cache busting
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
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
      console.log('Version check error:', error);
    }
  }, []);

  useEffect(() => {
    // Check immediately
    checkForUpdates();

    // Check when app becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Check every 60 seconds
    const interval = setInterval(checkForUpdates, 60 * 1000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdates]);

  const handleUpdate = () => {
    // Update stored version before refresh
    if (currentVersion) {
      localStorage.setItem('app_version', currentVersion);
    }
    
    // Clear all caches
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
        <div className="update-info">
          <span className="update-title">New Version Available</span>
          <span className="update-version">v{currentVersion}</span>
        </div>
        <div className="update-actions">
          <button onClick={handleUpdate} className="update-btn">
            Update
          </button>
          <button onClick={handleDismiss} className="dismiss-btn">
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
