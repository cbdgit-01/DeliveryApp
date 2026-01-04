import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { smsAPI } from '../services/api';
import anime from 'animejs/lib/anime.es.js';
import './Dashboard.css';

const SMSRequests = () => {
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    in_progress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  const fetchData = async () => {
    try {
      const [conversationsRes, statsRes] = await Promise.all([
        smsAPI.list(),
        smsAPI.getStats()
      ]);
      setConversations(conversationsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching SMS data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Animation
  useEffect(() => {
    if (!loading && containerRef.current) {
      anime({
        targets: containerRef.current.querySelectorAll('[data-sms-card]'),
        opacity: [0, 1],
        translateY: [20, 0],
        delay: anime.stagger(50),
        easing: 'easeOutQuad',
        duration: 300,
      });
    }
  }, [loading, conversations, filter]);

  const formatPhone = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      started: { label: 'Started', className: 'status-badge status-pending' },
      awaiting_type: { label: 'Choosing Type', className: 'status-badge status-pending' },
      awaiting_name: { label: 'Entering Name', className: 'status-badge status-pending' },
      awaiting_phone: { label: 'Entering Phone', className: 'status-badge status-pending' },
      awaiting_address: { label: 'Entering Address', className: 'status-badge status-pending' },
      awaiting_city_zip: { label: 'Entering City/Zip', className: 'status-badge status-pending' },
      awaiting_items: { label: 'Item Lookup', className: 'status-badge status-pending' },
      awaiting_photos: { label: 'Adding Photos', className: 'status-badge status-pending' },
      awaiting_notes: { label: 'Stairs Question', className: 'status-badge status-pending' },
      completed: { label: 'Completed', className: 'status-badge status-paid' },
      cancelled: { label: 'Cancelled', className: 'status-badge status-cancelled' },
    };
    const config = statusConfig[status] || { label: status, className: 'status-badge' };
    return <span className={config.className}>{config.label}</span>;
  };

  const getTypeLabel = (type) => {
    if (type === 'delivery') return 'Delivery';
    if (type === 'pickup') return 'Pickup';
    return 'SMS';
  };

  const filteredConversations = conversations.filter(conv => {
    // Apply filter
    if (filter === 'in_progress' && ['completed', 'cancelled'].includes(conv.status)) return false;
    if (filter === 'completed' && conv.status !== 'completed') return false;
    if (filter === 'cancelled' && conv.status !== 'cancelled') return false;
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        conv.customer_name?.toLowerCase().includes(query) ||
        conv.phone_number?.includes(query) ||
        conv.city?.toLowerCase().includes(query) ||
        conv.notes?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading SMS requests...</div>
      </div>
    );
  }

  return (
    <div className="dashboard" ref={containerRef}>
      <div className="dashboard-header">
        <div>
          <h1>SMS Requests</h1>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
            Track incoming text message requests from customers
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card pending">
          <div className="stat-number">{stats.in_progress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card paid">
          <div className="stat-number">{stats.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      {/* Controls */}
      <div className="dashboard-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setFilter('in_progress')}
          >
            In Progress
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
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

      {/* Conversation List */}
      <div className="tasks-list">
        {filteredConversations.length === 0 ? (
          <div className="empty-state">
            <h3>No SMS conversations found</h3>
            <p>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Customers can text your Twilio number to start a request'}
            </p>
          </div>
        ) : (
          filteredConversations.map(conv => (
            <div
              key={conv.id}
              className="task-card"
              data-sms-card
              style={{ cursor: 'default' }}
            >
              <div className="task-card-header">
                <div className="task-title">
                  {conv.customer_name || formatPhone(conv.phone_number)}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {conv.request_type && (
                    <span className="status-badge" style={{ 
                      background: 'var(--bg-card-hover)', 
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-default)'
                    }}>
                      {getTypeLabel(conv.request_type)}
                    </span>
                  )}
                  {getStatusBadge(conv.status)}
                </div>
              </div>

              <div className="task-card-details">
                <div className="task-detail">
                  <span className="detail-label">Phone</span>
                  <span className="detail-value">{formatPhone(conv.phone_number)}</span>
                </div>
                {conv.city && (
                  <div className="task-detail">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">{conv.city}, {conv.state}</span>
                  </div>
                )}
                <div className="task-detail">
                  <span className="detail-label">Started</span>
                  <span className="detail-value">{formatDate(conv.created_at)}</span>
                </div>
              </div>

              {conv.item_description && (
                <div className="task-card-notes">
                  <strong>Item:</strong> {conv.item_description}
                </div>
              )}

              {conv.notes && (
                <div className="task-card-notes" style={{ marginTop: '8px' }}>
                  <strong>Stairs:</strong> {conv.notes}
                </div>
              )}

              {conv.photo_urls && conv.photo_urls.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Photos ({conv.photo_urls.length})
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {conv.photo_urls.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Photo ${idx + 1}`}
                          style={{
                            width: '60px',
                            height: '60px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid var(--border-default)'
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to created task/pickup if completed */}
              {conv.status === 'completed' && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  {conv.created_task_id && (
                    <Link
                      to={`/tasks/${conv.created_task_id}`}
                      className="btn btn-secondary"
                      style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                    >
                      View Delivery →
                    </Link>
                  )}
                  {conv.created_pickup_id && (
                    <Link
                      to={`/pickups/${conv.created_pickup_id}`}
                      className="btn btn-secondary"
                      style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px' }}
                    >
                      View Pickup →
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SMSRequests;

