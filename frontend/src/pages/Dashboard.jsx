import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { tasksAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import anime from 'animejs';
import './Dashboard.css';

const Dashboard = () => {
  const { isAdmin } = useAuth();
  const { isOnline, cacheTasks, getCachedTasks } = useOffline();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [usingCache, setUsingCache] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchTasks();
  }, [filter, isOnline]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setUsingCache(false);

      if (isOnline) {
        // Online: fetch from API and cache
        let params = {};

        if (filter === 'active') {
          params = {}; // We'll filter on the frontend
        } else if (filter !== 'all') {
          params = { status: filter };
        }

        const response = await tasksAPI.list(params);

        // Cache all tasks for offline use
        await cacheTasks(response.data);

        // Filter out paid and cancelled if in 'active' mode
        let filteredTasks = response.data;
        if (filter === 'active') {
          filteredTasks = response.data.filter(
            task => task.status !== 'paid' && task.status !== 'cancelled'
          );
        }

        setTasks(filteredTasks);
      } else {
        // Offline: use cached data
        setUsingCache(true);
        const cachedTasks = await getCachedTasks();

        // Apply same filtering logic
        let filteredTasks = cachedTasks;
        if (filter === 'active') {
          filteredTasks = cachedTasks.filter(
            task => task.status !== 'paid' && task.status !== 'cancelled'
          );
        } else if (filter !== 'all') {
          filteredTasks = cachedTasks.filter(task => task.status === filter);
        }

        setTasks(filteredTasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // If online fetch fails, try cache
      if (isOnline) {
        setUsingCache(true);
        const cachedTasks = await getCachedTasks();
        setTasks(cachedTasks);
      }
    } finally {
      setLoading(false);
    }
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

  // Fetch all tasks once for stats
  useEffect(() => {
    const fetchAllTasks = async () => {
      try {
        const response = await tasksAPI.list({});
        setAllTasks(response.data);
      } catch (error) {
        console.error('Error fetching all tasks:', error);
      }
    };
    fetchAllTasks();
  }, []);

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

