import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PickupDashboard from './pages/PickupDashboard';
import Calendar from './pages/Calendar';
import TaskDetail from './pages/TaskDetail';
import CreateTask from './pages/CreateTask';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, isStaff, isAdmin } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // If route is admin-only and user is staff, redirect to new delivery
  if (adminOnly && isStaff()) {
    return <Navigate to="/tasks/new" replace />;
  }

  return children;
};

// Staff Route - redirects admins to dashboard
const StaffRoute = ({ children }) => {
  const { isAdmin } = useAuth();

  if (isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  const { isStaff } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Admin-only routes */}
        <Route 
          index 
          element={
            <ProtectedRoute adminOnly>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="pickups" 
          element={
            <ProtectedRoute adminOnly>
              <PickupDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="calendar" 
          element={
            <ProtectedRoute adminOnly>
              <Calendar />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="tasks/:id" 
          element={
            <ProtectedRoute adminOnly>
              <TaskDetail />
            </ProtectedRoute>
          } 
        />
        
        {/* Accessible to all authenticated users */}
        <Route path="tasks/new" element={<CreateTask />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

