import { useEffect, useState, useCallback } from 'react';
import './UpdatePrompt.css';

const UpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

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
        
        console.log('Version check:', { serverVersion, storedVersion });
        setDebugInfo(`Server: ${serverVersion}, Stored: ${storedVersion || 'none'}`);
        
        if (!storedVersion) {
          // First visit - store the version
          localStorage.setItem('app_version', serverVersion);
          setCurrentVersion(serverVersion);
          console.log('First visit, stored version:', serverVersion);
        } else if (storedVersion !== serverVersion) {
          // Version mismatch - update available!
          console.log('Update available!', storedVersion, '->', serverVersion);
          setCurrentVersion(serverVersion);
          setShowPrompt(true);
        } else {
          console.log('Version match, no update needed');
        }
      } else {
        console.log('Version fetch failed:', response.status);
        setDebugInfo(`Fetch failed: ${response.status}`);
      }
    } catch (error) {
      console.log('Version check error:', error);
      setDebugInfo(`Error: ${error.message}`);
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

    // Check every 30 seconds for testing
    const interval = setInterval(checkForUpdates, 30 * 1000);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkForUpdates]);

  const handleRefresh = () => {
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

  // Always show a small refresh button in corner for manual refresh
  return (
    <>
      {/* Debug/Manual refresh button - always visible */}
      <button 
        onClick={handleRefresh}
        className="manual-refresh-btn"
        title={debugInfo}
      >
        ↻
      </button>

      {/* Update prompt when new version detected */}
      {showPrompt && (
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
      )}
    </>
  );
};

export default UpdatePrompt;
