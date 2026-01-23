import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOffline } from '../context/OfflineContext';
import './Layout.css';

const Layout = () => {
  const { user, logout, isStaff, isAdmin } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { isOnline, pendingCount, isSyncing, syncPendingActions } = useOffline();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Redirect staff to /tasks/new if they're on root
  React.useEffect(() => {
    if (isStaff() && location.pathname === '/') {
      navigate('/tasks/new', { replace: true });
    }
  }, [location.pathname, isStaff, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-brand">
            <Link to="/" onClick={closeMenu}>
              <img src="/CBD.png" alt="CBD" className="brand-logo" />
            </Link>
          </div>

          <button className="menu-toggle" onClick={toggleMenu}>
            {menuOpen ? '✕' : '☰'}
          </button>

          <div className={`navbar-menu ${menuOpen ? 'active' : ''}`}>
            {/* Admin Navigation */}
            {isAdmin() && (
              <>
                <Link
                  to="/"
                  className={`nav-link ${isActive('/') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Deliveries
                </Link>
                <Link
                  to="/pickups"
                  className={`nav-link ${isActive('/pickups') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Pickups
                </Link>
                <Link
                  to="/calendar"
                  className={`nav-link ${isActive('/calendar') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  Calendar
                </Link>
                <Link
                  to="/sms"
                  className={`nav-link ${isActive('/sms') ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  SMS
                </Link>
              </>
            )}
          </div>

          <div className="navbar-user">
            {/* Offline Indicator */}
            {!isOnline && (
              <span className="offline-indicator" title="You are offline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 8.98C20.93 5.9 16.69 4 12 4c-.32 0-.65.01-.97.03L23.03 16c.03-.32.04-.65.04-.97 0-2.25-.56-4.37-1.57-6.23L24 8.98zM3.92 6.03C1.56 8.14 0 11.33 0 14.82c0 .32.01.64.04.96l11.93-11.97c-2.85.09-5.47 1.05-7.57 2.58l-.48-.36zm.71 16.89l17.03-17.03-1.41-1.41-2.52 2.52C15.68 5.37 13.93 4.82 12 4.82c-4.97 0-9 4.03-9 9 0 1.93.55 3.68 1.5 5.2l-1.41 1.41 1.41 1.41 1.13-1.13c1.89 1.35 4.14 2.11 6.57 2.11.67 0 1.33-.07 1.97-.2l1.41-1.41c-.93.21-1.89.31-2.88.31-3.97 0-7.23-2.74-8.14-6.38L4.63 22.92z"/>
                </svg>
                Offline
              </span>
            )}

            {/* Pending Sync Indicator */}
            {pendingCount > 0 && (
              <button
                className="sync-indicator"
                onClick={syncPendingActions}
                disabled={isSyncing || !isOnline}
                title={isOnline ? 'Click to sync' : 'Waiting for connection'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={isSyncing ? 'spinning' : ''}>
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                {pendingCount} pending
              </button>
            )}

            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                </svg>
              )}
            </button>
            <span className="user-role">{user?.role}</span>
            <span className="user-name">{user?.full_name || user?.username}</span>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

