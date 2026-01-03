import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './UpdatePrompt.css';

const UpdatePrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Check for updates every 30 minutes
      if (r) {
        setInterval(() => {
          r.update();
        }, 30 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="update-prompt">
      <div className="update-prompt-content">
        <span className="update-icon">↻</span>
        <span className="update-text">Update available</span>
        <button onClick={handleUpdate} className="update-btn">
          Update
        </button>
        <button onClick={handleDismiss} className="dismiss-btn">
          ✕
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;

