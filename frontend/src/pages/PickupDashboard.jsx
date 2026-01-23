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
    pending_review: 0,
    approved: 0,
    scheduled: 0,
    completed: 0,
    declined: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [usingCache, setUsingCache] = useState(false);
  const containerRef = useRef(null);

  const fetchPickups = async () => {
    try {
      setUsingCache(false);

      if (isOnline) {
        const [pickupsRes, statsRes] = await Promise.all([
          pickupsAPI.list(),
          pickupsAPI.getStats()
        ]);
        setPickups(pickupsRes.data);
        setStats(statsRes.data);

        // Cache pickups for offline use
        await cachePickups(pickupsRes.data);
      } else {
        // Offline: use cached data
        setUsingCache(true);
        const cachedPickups = await getCachedPickups();
        setPickups(cachedPickups);

        // Calculate stats from cached data
        const cachedStats = {
          pending_review: cachedPickups.filter(p => p.status === 'pending_review').length,
          approved: cachedPickups.filter(p => p.status === 'approved').length,
          scheduled: cachedPickups.filter(p => p.status === 'scheduled').length,
          completed: cachedPickups.filter(p => p.status === 'completed').length,
          declined: cachedPickups.filter(p => p.status === 'declined').length,
        };
        setStats(cachedStats);
      }
    } catch (error) {
      console.error('Error fetching pickups:', error);
      // If online fetch fails, try cache
      if (isOnline) {
        setUsingCache(true);
        const cachedPickups = await getCachedPickups();
        setPickups(cachedPickups);
      }
    } finally {
      setLoading(false);
    }
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
        ['pending_review', 'approved', 'scheduled'].includes(p.status)
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
        p.customer_phone.includes(search)
      );
    }

    return filtered;
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending_review': return 'status-pending';
      case 'approved': return 'status-scheduled';
      case 'scheduled': return 'status-delivered';
      case 'completed': return 'status-paid';
      case 'declined': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending_review': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'scheduled': return 'Scheduled';
      case 'completed': return 'Completed';
      case 'declined': return 'Declined';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    // Ensure the date is treated as UTC by appending 'Z' if no timezone specified
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
          <div className="stat-number">{stats.pending_review}</div>
          <div className="stat-label">Pending Review</div>
        </div>
        <div className="stat-card scheduled">
          <div className="stat-number">{stats.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card delivered">
          <div className="stat-number">{stats.scheduled}</div>
          <div className="stat-label">Scheduled</div>
        </div>
        <div className="stat-card paid">
          <div className="stat-number">{stats.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
        {stats.declined > 0 && (
          <div className="stat-card cancelled">
            <div className="stat-number">{stats.declined}</div>
            <div className="stat-label">Declined</div>
          </div>
        )}
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
            className={`filter-btn ${filter === 'pending_review' ? 'active' : ''}`}
            onClick={() => setFilter('pending_review')}
          >
            Pending Review
          </button>
          <button
            className={`filter-btn ${filter === 'approved' ? 'active' : ''}`}
            onClick={() => setFilter('approved')}
          >
            Approved
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
          <button
            className={`filter-btn ${filter === 'declined' ? 'active' : ''}`}
            onClick={() => setFilter('declined')}
          >
            Declined
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
                <div className="task-detail">
                  <span className="task-detail-label">Phone</span>
                  <span>{pickup.customer_phone}</span>
                </div>
              </div>

              <div className="task-card-actions">
                <div className="task-scheduled">
                  <div className="task-detail">
                    <span className="task-detail-label">
                      {pickup.status === 'completed' ? 'Completed' : 'Scheduled'}
                    </span>
                    <span>
                      {pickup.status === 'completed'
                        ? formatDate(pickup.completed_at)
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
