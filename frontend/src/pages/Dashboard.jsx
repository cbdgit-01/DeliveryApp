import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { tasksAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import anime from 'animejs';
import './Dashboard.css';

const Dashboard = () => {
  const { isAdmin } = useAuth();
  const { isOnline, isSyncing, cacheTasks, getCachedTasks } = useOffline();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [usingCache, setUsingCache] = useState(false);
  const containerRef = useRef(null);

  // Refetch when filter changes, when coming online, or when sync completes
  useEffect(() => {
    // Only fetch if not currently syncing (wait for sync to complete)
    if (!isSyncing) {
      fetchTasks();
    }
  }, [filter, isOnline, isSyncing]);

  const fetchTasks = async () => {
    try {
      // CACHE-FIRST: Always try to show cached data immediately
      const cachedTasks = await getCachedTasks();
      if (cachedTasks.length > 0) {
        setUsingCache(true);
        applyFilterAndSetTasks(cachedTasks);
        setLoading(false);
      }

      // Then fetch fresh data in background if online
      if (isOnline) {
        try {
          const response = await tasksAPI.list({});
          // Cache all tasks for offline use
          await cacheTasks(response.data);
          setUsingCache(false);
          applyFilterAndSetTasks(response.data);
        } catch (error) {
          console.error('Background fetch failed:', error);
          // Keep showing cached data - already displayed above
        }
      }

      // If no cache and offline, show empty
      if (cachedTasks.length === 0 && !isOnline) {
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilterAndSetTasks = (taskList) => {
    let filteredTasks = taskList;
    if (filter === 'active') {
      filteredTasks = taskList.filter(
        task => task.status !== 'paid' && task.status !== 'cancelled'
      );
    } else if (filter !== 'all') {
      filteredTasks = taskList.filter(task => task.status === filter);
    }

    // Sort completed (paid) items by most recent first
    if (filter === 'paid') {
      filteredTasks = [...filteredTasks].sort((a, b) => {
        const dateA = a.paid_at ? new Date(a.paid_at) : new Date(0);
        const dateB = b.paid_at ? new Date(b.paid_at) : new Date(0);
        return dateB - dateA;
      });
    }

    setTasks(filteredTasks);
    setAllTasks(taskList);
  };

  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      task.customer_name.toLowerCase().includes(search) ||
      task.item_title.toLowerCase().includes(search) ||
      task.sku.toLowerCase().includes(search) ||
      (task.shopify_order_number && task.shopify_order_number.toLowerCase().includes(search))
    );
  });

  const getStatusBadgeClass = (status) => {
    return `status-badge status-${status}`;
  };

  // For user-entered dates (scheduled times) - display as entered, no UTC conversion
  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const [allTasks, setAllTasks] = useState([]);

  // Entrance animation for cards
  useEffect(() => {
    if (!containerRef.current || loading) return;

    const cards = containerRef.current.querySelectorAll('[data-delivery-card]');
    if (!cards.length) return;

    anime({
      targets: cards,
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 420,
      delay: (_el, i) => i * 70,
      easing: 'easeOutQuad',
    });
  }, [filteredTasks, loading]);

  const getTaskStats = () => {
    return {
      pending: allTasks.filter(t => t.status === 'pending').length,
      scheduled: allTasks.filter(t => t.status === 'scheduled').length,
      delivered: allTasks.filter(t => t.status === 'delivered').length,  // Awaiting payment
      paid: allTasks.filter(t => t.status === 'paid').length,            // Payment received
      cancelled: allTasks.filter(t => t.status === 'cancelled').length,
    };
  };

  const stats = getTaskStats();

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div className="dashboard" ref={containerRef}>
      <div className="dashboard-header">
        <div>
          <h1>Delivery Dashboard</h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Manage deliveries, schedule routes, track payments.
          </p>
        </div>
        {isAdmin() && (
          <Link to="/deliveries/new" className="btn btn-primary">
            + New Delivery
          </Link>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card pending">
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card scheduled">
          <div className="stat-number">{stats.scheduled}</div>
          <div className="stat-label">Scheduled</div>
        </div>
        <div className="stat-card delivered">
          <div className="stat-number">{stats.delivered}</div>
          <div className="stat-label">Awaiting Payment</div>
        </div>
        <div className="stat-card paid">
          <div className="stat-number">{stats.paid}</div>
          <div className="stat-label">Completed</div>
        </div>
        {stats.cancelled > 0 && (
          <div className="stat-card cancelled">
            <div className="stat-number">{stats.cancelled}</div>
            <div className="stat-label">Cancelled</div>
          </div>
        )}
      </div>

      <div className="dashboard-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name, item, SKU, or order #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button
            className={`filter-btn ${filter === 'scheduled' ? 'active' : ''}`}
            onClick={() => setFilter('scheduled')}
          >
            Scheduled
          </button>
          <button
            className={`filter-btn ${filter === 'delivered' ? 'active' : ''}`}
            onClick={() => setFilter('delivered')}
          >
            Awaiting Payment
          </button>
          <button
            className={`filter-btn ${filter === 'paid' ? 'active' : ''}`}
            onClick={() => setFilter('paid')}
          >
            Completed
          </button>
          <button
            className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setFilter('cancelled')}
          >
            Cancelled
          </button>
        </div>
      </div>

      <div className="tasks-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <h3>No deliveries found</h3>
            <p>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Create your first delivery to get started'}
            </p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <Link to={`/tasks/${task.id}`} key={task.id} className="task-card" data-delivery-card>
              <div className="task-card-header">
                <div className="task-info">
                  <h3>{task.customer_name}</h3>
                  <p className="task-item">{task.item_title}</p>
                </div>
              </div>

              <div className="task-card-body">
                <div className="task-detail">
                  <span className="task-detail-label">SKU</span>
                  <span>{task.sku}</span>
                </div>
                <div className="task-detail">
                  <span className="task-detail-label">Address</span>
                  <span>{task.delivery_city}, {task.delivery_state}</span>
                </div>
                {task.shopify_order_number && (
                  <div className="task-detail">
                    <span className="task-detail-label">Order</span>
                    <span>#{task.shopify_order_number}</span>
                  </div>
                )}
              </div>

              <div className="task-card-actions">
                <div className="task-scheduled">
                  <div className="task-detail">
                    <span className="task-detail-label">Scheduled</span>
                    <span>{formatDate(task.scheduled_start)}</span>
                  </div>
                </div>
                <span className={getStatusBadgeClass(task.status)}>
                  {task.status}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;

