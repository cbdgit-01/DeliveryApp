import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { pickupsAPI } from '../services/api';
import { useOffline } from '../context/OfflineContext';
import { openInMaps } from '../utils/maps';
import './TaskDetail.css'; // Reuse TaskDetail styles

const PickupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline, getCachedPickup } = useOffline();
  const [pickup, setPickup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const fetchPickup = async () => {
    try {
      let pickupData;

      if (isOnline) {
        const response = await pickupsAPI.get(id);
        pickupData = response.data;
      } else {
        // Offline: load from cache
        pickupData = await getCachedPickup(id);
      }

      if (!pickupData) {
        setError('Pickup request not found');
        return;
      }

      setPickup(pickupData);
    } catch (err) {
      console.error('Error fetching pickup:', err);
      // If API call fails, try cache as fallback
      if (isOnline) {
        const cachedPickup = await getCachedPickup(id);
        if (cachedPickup) {
          setPickup(cachedPickup);
          return;
        }
      }
      setError('Pickup request not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPickup();
  }, [id, isOnline]);

  const handleApprove = async () => {
    if (!confirm('Approve this pickup request?')) return;
    setUpdating(true);
    try {
      await pickupsAPI.approve(id);
      await fetchPickup();
    } catch (err) {
      console.error('Error approving pickup:', err);
      alert('Failed to approve pickup');
    } finally {
      setUpdating(false);
    }
  };

  const handleDecline = async () => {
    const reason = prompt('Enter reason for declining:');
    if (!reason) return;
    setUpdating(true);
    try {
      await pickupsAPI.decline(id, reason);
      await fetchPickup();
    } catch (err) {
      console.error('Error declining pickup:', err);
      alert('Failed to decline pickup');
    } finally {
      setUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Mark this pickup as completed?')) return;
    setUpdating(true);
    try {
      await pickupsAPI.complete(id);
      await fetchPickup();
    } catch (err) {
      console.error('Error completing pickup:', err);
      alert('Failed to complete pickup');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this pickup request? This cannot be undone.')) return;
    setUpdating(true);
    try {
      await pickupsAPI.delete(id);
      navigate('/pickups');
    } catch (err) {
      console.error('Error deleting pickup:', err);
      alert('Failed to delete pickup');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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

  if (loading) {
    return <div className="spinner"></div>;
  }

  if (error || !pickup) {
    return (
      <div className="task-detail">
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">❌</div>
            <h3>{error || 'Pickup not found'}</h3>
            <Link to="/pickups" className="btn btn-primary" style={{ marginTop: '16px' }}>
              Back to Pickups
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="task-detail">
      <div className="detail-header">
        <Link to="/pickups" className="back-link">
          ← Back to Pickups
        </Link>
        <h1>Pickup Details</h1>
        <span className={getStatusBadgeClass(pickup.status)}>
          {getStatusLabel(pickup.status)}
        </span>
        <div className="header-menu">
          <button 
            className="menu-trigger" 
            onClick={() => setShowMenu(!showMenu)}
            aria-label="More options"
          >
            ⋮
          </button>
          {showMenu && (
            <div className="menu-dropdown">
              <button 
                className="menu-item menu-item-danger"
                onClick={() => {
                  setShowMenu(false);
                  handleDelete();
                }}
              >
                Delete from System
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="task-detail-grid">
        {/* Customer Information */}
        <div className="card">
          <h2>Customer</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Name</span>
              <span className="info-value">{pickup.customer_name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Phone</span>
              <span className="info-value">
                <a href={`tel:${pickup.customer_phone}`}>{pickup.customer_phone}</a>
              </span>
            </div>
            {pickup.customer_email && (
              <div className="info-item">
                <span className="info-label">Email</span>
                <span className="info-value">
                  <a href={`mailto:${pickup.customer_email}`}>{pickup.customer_email}</a>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Item Information */}
        <div className="card">
          <h2>Item Details</h2>
          <div className="info-grid">
            <div className="info-item full-width">
              <span className="info-label">Description</span>
              <span className="info-value">{pickup.item_description}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Estimated Items</span>
              <span className="info-value">{pickup.item_count} item{pickup.item_count !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Pickup Address */}
        <div className="card">
          <h2>Pickup Address</h2>
          <div className="address-block">
            <p>{pickup.pickup_address_line1}</p>
            {pickup.pickup_address_line2 && <p>{pickup.pickup_address_line2}</p>}
            <p>{pickup.pickup_city}, {pickup.pickup_state} {pickup.pickup_zip}</p>
          </div>
          <button
            onClick={() => openInMaps(
              `${pickup.pickup_address_line1}, ${pickup.pickup_city}, ${pickup.pickup_state} ${pickup.pickup_zip}`
            )}
            className="btn btn-secondary"
            style={{ marginTop: '12px' }}
          >
            Open in Maps
          </button>
        </div>

        {/* Notes */}
        {(pickup.pickup_notes || pickup.staff_notes || pickup.decline_reason) && (
          <div className="card">
            <h2>Notes</h2>
            {pickup.pickup_notes && (
              <div className="info-item" style={{ marginBottom: '12px' }}>
                <span className="info-label">Customer Notes</span>
                <span className="info-value">{pickup.pickup_notes}</span>
              </div>
            )}
            {pickup.staff_notes && (
              <div className="info-item" style={{ marginBottom: '12px' }}>
                <span className="info-label">Staff Notes</span>
                <span className="info-value">{pickup.staff_notes}</span>
              </div>
            )}
            {pickup.decline_reason && (
              <div className="info-item">
                <span className="info-label">Decline Reason</span>
                <span className="info-value" style={{ color: 'var(--status-cancelled)' }}>
                  {pickup.decline_reason}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="card">
          <h2>Timeline</h2>
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-dot pending"></div>
              <div className="timeline-content">
                <div className="timeline-label">Created</div>
                <div className="timeline-date">{formatDate(pickup.created_at)}</div>
              </div>
            </div>
            {pickup.scheduled_start && (
              <div className="timeline-item">
                <div className="timeline-dot scheduled"></div>
                <div className="timeline-content">
                  <div className="timeline-label">Scheduled</div>
                  <div className="timeline-date">{formatDate(pickup.scheduled_start)}</div>
                </div>
              </div>
            )}
            {pickup.completed_at && (
              <div className="timeline-item">
                <div className="timeline-dot paid"></div>
                <div className="timeline-content">
                  <div className="timeline-label">Completed</div>
                  <div className="timeline-date">{formatDate(pickup.completed_at)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {pickup.status !== 'completed' && pickup.status !== 'declined' && (
          <div className="card">
            <h2>Actions</h2>
            <div className="action-buttons">
              {pickup.status === 'pending_review' && (
                <>
                  <button
                    className="btn btn-success btn-full"
                    onClick={handleApprove}
                    disabled={updating}
                  >
                    ✓ Approve Request
                  </button>
                  <button
                    className="btn btn-danger btn-full"
                    onClick={handleDecline}
                    disabled={updating}
                  >
                    ✕ Decline Request
                  </button>
                </>
              )}
              {pickup.status === 'scheduled' && (
                <button
                  className="btn btn-success btn-full"
                  onClick={handleComplete}
                  disabled={updating}
                >
                  ✓ Mark as Completed
                </button>
              )}
              {pickup.status === 'approved' && (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>
                  Schedule this pickup from the calendar to continue.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Show info for completed/declined pickups */}
        {(pickup.status === 'completed' || pickup.status === 'declined') && (
          <div className="card">
            <h2>Actions</h2>
            <div className="action-buttons">
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>
                {pickup.status === 'completed' 
                  ? 'This pickup has been completed.'
                  : 'This pickup was declined.'
                }
                <br />
                Use the menu (⋮) to delete if needed.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PickupDetail;

