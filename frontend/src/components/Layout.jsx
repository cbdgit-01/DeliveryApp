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
              </>
            )}
          </div>

          <div className="navbar-user">
            <button 
              className="theme-toggle" 
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? '☀' : '☽'}
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

