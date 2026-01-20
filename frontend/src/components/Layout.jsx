import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Layout.css';

const Layout = () => {
  const { user, logout, isStaff, isAdmin } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
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

