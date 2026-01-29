import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { pickupsAPI } from '../services/api';
import { useOffline } from '../context/OfflineContext';
import anime from 'animejs';
import './Dashboard.css';

const PickupDashboard = () => {
  const { isOnline, cachePickups, getCachedPickups } = useOffline();
  const [pickups, setPickups] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    scheduled: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [usingCache, setUsingCache] = useState(false);
  const containerRef = useRef(null);

  const fetchPickups = async () => {
    try {
      // CACHE-FIRST: Always try to show cached data immediately
      const cachedPickups = await getCachedPickups();
      if (cachedPickups.length > 0) {
        setUsingCache(true);
        setPickups(cachedPickups);
        setStats(calculateStatsFromPickups(cachedPickups));
        setLoading(false);
      }

      // Then fetch fresh data in background if online
      if (isOnline) {
        try {
          const [pickupsRes, statsRes] = await Promise.all([
            pickupsAPI.list(),
            pickupsAPI.getStats()
          ]);
          setPickups(pickupsRes.data);
          setStats(statsRes.data);
          setUsingCache(false);

          // Cache pickups for offline use
          await cachePickups(pickupsRes.data);
        } catch (error) {
          console.error('Background fetch failed:', error);
          // Keep showing cached data - already displayed above
        }
      }

      // If no cache and offline, show empty
      if (cachedPickups.length === 0 && !isOnline) {
        setPickups([]);
      }
    } catch (error) {
      console.error('Error fetching pickups:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatsFromPickups = (pickupList) => {
    return {
      pending: pickupList.filter(p => p.status !== 'completed' && !p.scheduled_start).length,
      scheduled: pickupList.filter(p => p.status !== 'completed' && p.scheduled_start).length,
      completed: pickupList.filter(p => p.status === 'completed').length,
    };
  };

  useEffect(() => {
    fetchPickups();
  }, [isOnline]);

  // Entrance animation for cards
  useEffect(() => {
    if (!containerRef.current || loading) return;

    const cards = containerRef.current.querySelectorAll('[data-pickup-card]');
    if (!cards.length) return;

    anime({
      targets: cards,
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 420,
      delay: (_el, i) => i * 70,
      easing: 'easeOutQuad',
    });
  }, [pickups, loading, filter, searchQuery]);

  const getFilteredPickups = () => {
    let filtered = pickups;

    // Apply status filter
    if (filter === 'active') {
      filtered = filtered.filter(p =>
        ['pending', 'scheduled'].includes(p.status)
      );
    } else if (filter !== 'all') {
      filtered = filtered.filter(p => p.status === filter);
    }

    // Apply search filter
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.customer_name.toLowerCase().includes(search) ||
        p.item_description.toLowerCase().includes(search) ||
        (p.customer_email && p.customer_email.toLowerCase().includes(search)) ||
        (p.customer_phone && p.customer_phone.includes(search))
      );
    }

    return filtered;
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'scheduled': return 'status-scheduled';
      case 'completed': return 'status-paid';
      default: return 'status-pending';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'scheduled': return 'Scheduled';
      case 'completed': return 'Completed';
      default: return status;
    }
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

  // For system timestamps (completed_at) - stored in UTC, convert to EST
  const formatSystemDate = (dateString) => {
    if (!dateString) return '';
    const utcString = dateString.endsWith('Z') || dateString.includes('+')
      ? dateString
      : dateString + 'Z';
    const date = new Date(utcString);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const filteredPickups = getFilteredPickups();

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div className="dashboard" ref={containerRef}>
      <div className="dashboard-header">
        <div>
          <h1>Pickup Dashboard</h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Review pickup requests, approve items, schedule pickups.
          </p>
        </div>
        <Link to="/pickups/new" className="btn btn-primary">
          + New Pickup
        </Link>
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
        <div className="stat-card paid">
          <div className="stat-number">{stats.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name, item, or email"
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
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>
      </div>

      <div className="tasks-list">
        {filteredPickups.length === 0 ? (
          <div className="empty-state">
            <h3>No pickup requests found</h3>
            <p>
              {searchQuery
                ? 'Try adjusting your search'
                : filter === 'active'
                ? 'No active pickup requests. Create one to get started!'
                : `No ${filter.replace('_', ' ')} pickup requests.`}
            </p>
          </div>
        ) : (
          filteredPickups.map(pickup => (
            <Link
              to={`/pickups/${pickup.id}`}
              key={pickup.id}
              className="task-card"
              data-pickup-card
            >
              <div className="task-card-header">
                <div className="task-info">
                  <h3>{pickup.customer_name}</h3>
                  <p className="task-item">{pickup.item_description.substring(0, 60)}{pickup.item_description.length > 60 ? '...' : ''}</p>
                </div>
              </div>

              <div className="task-card-body">
                <div className="task-detail">
                  <span className="task-detail-label">Items</span>
                  <span>{pickup.item_count} item{pickup.item_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="task-detail">
                  <span className="task-detail-label">Address</span>
                  <span>{pickup.pickup_city}, {pickup.pickup_state}</span>
                </div>
                {pickup.customer_phone && (
                  <div className="task-detail">
                    <span className="task-detail-label">Phone</span>
                    <span>{pickup.customer_phone}</span>
                  </div>
                )}
              </div>

              <div className="task-card-actions">
                <div className="task-scheduled">
                  <div className="task-detail">
                    <span className="task-detail-label">
                      {pickup.status === 'completed' ? 'Completed' : 'Scheduled'}
                    </span>
                    <span>
                      {pickup.status === 'completed'
                        ? formatSystemDate(pickup.completed_at)
                        : formatDate(pickup.scheduled_start)}
                    </span>
                  </div>
                </div>
                <span className={getStatusBadgeClass(pickup.status)}>
                  {getStatusLabel(pickup.status)}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default PickupDashboard;
