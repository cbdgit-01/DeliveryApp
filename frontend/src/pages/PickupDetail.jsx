import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { pickupsAPI } from '../services/api';
import { useOffline } from '../context/OfflineContext';
import { openInMaps } from '../utils/maps';
import { openSmsWithMessage } from '../utils/sms';
import { getETA, formatArrivalTime } from '../utils/directions';
import './TaskDetail.css'; // Reuse TaskDetail styles

const PickupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline, isSyncing, getCachedPickup, queueAction, updateCachedPickup } = useOffline();
  const [pickup, setPickup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [editData, setEditData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    pickup_address_line1: '',
    pickup_address_line2: '',
    pickup_city: '',
    pickup_state: '',
    pickup_zip: '',
    item_description: '',
    item_count: 1,
    pickup_notes: '',
  });

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
      // Initialize edit data
      setEditData({
        customer_name: pickupData.customer_name || '',
        customer_phone: pickupData.customer_phone || '',
        customer_email: pickupData.customer_email || '',
        pickup_address_line1: pickupData.pickup_address_line1 || '',
        pickup_address_line2: pickupData.pickup_address_line2 || '',
        pickup_city: pickupData.pickup_city || '',
        pickup_state: pickupData.pickup_state || '',
        pickup_zip: pickupData.pickup_zip || '',
        item_description: pickupData.item_description || '',
        item_count: pickupData.item_count || 1,
        pickup_notes: pickupData.pickup_notes || '',
      });
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

  // Refetch when id changes, when coming online, or when sync completes
  useEffect(() => {
    // Only fetch if not currently syncing (wait for sync to complete)
    if (!isSyncing) {
      fetchPickup();
    }
  }, [id, isOnline, isSyncing]);

  const handleComplete = async () => {
    if (!confirm('Mark this pickup as completed?')) return;
    setUpdating(true);
    try {
      if (isOnline) {
        await pickupsAPI.complete(id);
        await fetchPickup();
      } else {
        // Queue action for later sync
        await queueAction({
          type: 'COMPLETE_PICKUP',
          pickupId: parseInt(id),
        });

        // Update local cache optimistically
        await updateCachedPickup(parseInt(id), {
          status: 'completed',
          completed_at: new Date().toISOString(),
        });

        // Update local state
        setPickup(prev => ({
          ...prev,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }));

        alert('Pickup marked as completed. Will sync when back online.');
      }
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

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await pickupsAPI.update(id, editData);
      await fetchPickup();
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating pickup:', err);
      alert('Failed to update pickup');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditData({
      customer_name: pickup.customer_name || '',
      customer_phone: pickup.customer_phone || '',
      customer_email: pickup.customer_email || '',
      pickup_address_line1: pickup.pickup_address_line1 || '',
      pickup_address_line2: pickup.pickup_address_line2 || '',
      pickup_city: pickup.pickup_city || '',
      pickup_state: pickup.pickup_state || '',
      pickup_zip: pickup.pickup_zip || '',
      item_description: pickup.item_description || '',
      item_count: pickup.item_count || 1,
      pickup_notes: pickup.pickup_notes || '',
    });
    setIsEditing(false);
  };

  const handleStartingPickup = async () => {
    if (!pickup.customer_phone) {
      alert('No phone number available for this pickup.');
      return;
    }

    setGettingLocation(true);

    try {
      // Get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;
      const destination = `${pickup.pickup_address_line1}, ${pickup.pickup_city}, ${pickup.pickup_state} ${pickup.pickup_zip}`;

      // Get ETA from Google Maps
      const etaDuration = await getETA(latitude, longitude, destination);
      const arrivalTime = formatArrivalTime(etaDuration);

      // Format customer's first name
      const firstName = pickup.customer_name.split(' ')[0];

      // Create the SMS message
      const message = `Hi ${firstName}, this is Consigned By Design. We're on our way for the pickup! Our estimated arrival time is around ${arrivalTime}.`;

      // Open SMS app with pre-filled message
      openSmsWithMessage(pickup.customer_phone, message);

    } catch (error) {
      console.error('Error getting location:', error);

      // Fallback: send SMS without specific ETA
      const firstName = pickup.customer_name.split(' ')[0];
      const message = `Hi ${firstName}, this is Consigned By Design. We're on our way for the pickup!`;
      openSmsWithMessage(pickup.customer_phone, message);

    } finally {
      setGettingLocation(false);
    }
  };

  // For user-entered dates (scheduled times) - display as entered, no UTC conversion
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // For system timestamps (created_at, completed_at) - stored in UTC, convert to EST
  const formatSystemDate = (dateString) => {
    if (!dateString) return '';
    const utcString = dateString.endsWith('Z') || dateString.includes('+')
      ? dateString
      : dateString + 'Z';
    return new Date(utcString).toLocaleString('en-US', {
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
        <div className="header-actions">
          {!isEditing && pickup.status !== 'completed' && (
            <button
              className="btn btn-secondary btn-edit"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
          )}
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
      </div>

      {isEditing ? (
        /* Edit Mode */
        <form onSubmit={handleSaveEdit} className="edit-form">
          <div className="card">
            <div className="card-header-with-badge">
              <h2>Customer Information</h2>
              <span className={getStatusBadgeClass(pickup.status)}>
                {getStatusLabel(pickup.status)}
              </span>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="customer_name">Name</label>
                <input
                  id="customer_name"
                  type="text"
                  value={editData.customer_name}
                  onChange={(e) => setEditData({ ...editData, customer_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="customer_phone">Phone</label>
                <input
                  id="customer_phone"
                  type="tel"
                  value={editData.customer_phone}
                  onChange={(e) => setEditData({ ...editData, customer_phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="customer_email">Email</label>
                <input
                  id="customer_email"
                  type="email"
                  value={editData.customer_email}
                  onChange={(e) => setEditData({ ...editData, customer_email: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Pickup Address</h2>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="pickup_address_line1">Address Line 1</label>
                <input
                  id="pickup_address_line1"
                  type="text"
                  value={editData.pickup_address_line1}
                  onChange={(e) => setEditData({ ...editData, pickup_address_line1: e.target.value })}
                  required
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="pickup_address_line2">Address Line 2</label>
                <input
                  id="pickup_address_line2"
                  type="text"
                  value={editData.pickup_address_line2}
                  onChange={(e) => setEditData({ ...editData, pickup_address_line2: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pickup_city">City</label>
                <input
                  id="pickup_city"
                  type="text"
                  value={editData.pickup_city}
                  onChange={(e) => setEditData({ ...editData, pickup_city: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="pickup_state">State</label>
                <input
                  id="pickup_state"
                  type="text"
                  value={editData.pickup_state}
                  onChange={(e) => setEditData({ ...editData, pickup_state: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="pickup_zip">ZIP Code</label>
                <input
                  id="pickup_zip"
                  type="text"
                  value={editData.pickup_zip}
                  onChange={(e) => setEditData({ ...editData, pickup_zip: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Item Information</h2>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="item_description">Description</label>
                <textarea
                  id="item_description"
                  value={editData.item_description}
                  onChange={(e) => setEditData({ ...editData, item_description: e.target.value })}
                  rows={3}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="item_count">Estimated Items</label>
                <input
                  id="item_count"
                  type="number"
                  min="1"
                  value={editData.item_count}
                  onChange={(e) => setEditData({ ...editData, item_count: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Notes</h2>
            <div className="form-group">
              <textarea
                id="pickup_notes"
                value={editData.pickup_notes}
                onChange={(e) => setEditData({ ...editData, pickup_notes: e.target.value })}
                rows={4}
                placeholder="Add notes about the pickup..."
              />
            </div>
          </div>

          <div className="edit-actions">
            <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} disabled={updating}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={updating}>
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        /* View Mode */
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
                <div className="timeline-date">{formatSystemDate(pickup.created_at)}</div>
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
                  <div className="timeline-date">{formatSystemDate(pickup.completed_at)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {pickup.status !== 'completed' && (
          <div className="card">
            <h2>Actions</h2>
            <div className="action-buttons">
              {pickup.status === 'pending' && (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>
                  Schedule this pickup from the calendar to continue.
                </p>
              )}
              {pickup.status === 'scheduled' && (
                <>
                  <button
                    className="btn btn-info btn-full"
                    onClick={handleStartingPickup}
                    disabled={gettingLocation}
                  >
                    {gettingLocation ? 'Getting Location...' : 'Starting Pickup (Send SMS)'}
                  </button>
                  <button
                    className="btn btn-success btn-full"
                    onClick={handleComplete}
                    disabled={updating}
                  >
                    Mark as Completed
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Show info for completed pickups */}
        {pickup.status === 'completed' && (
          <div className="card">
            <h2>Actions</h2>
            <div className="action-buttons">
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>
                This pickup has been completed.
                <br />
                Use the menu (⋮) to delete if needed.
              </p>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
};

export default PickupDetail;

