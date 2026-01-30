import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tasksAPI, calendarAPI, uploadsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { openInMaps } from '../utils/maps';
import { openSmsWithMessage } from '../utils/sms';
import { getETA, formatArrivalTime } from '../utils/directions';
import SignatureCanvas from '../components/SignatureCanvas';
import './TaskDetail.css';

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline, isSyncing, queueAction, updateCachedTask, getCachedTask, savePendingSignature, getPendingSignature } = useOffline();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    scheduled_start: '',
    scheduled_end: '',
  });
  const [editData, setEditData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    delivery_address_line1: '',
    delivery_address_line2: '',
    delivery_city: '',
    delivery_state: '',
    delivery_zip: '',
    item_title: '',
    item_description: '',
    delivery_notes: '',
  });

  // Refetch when id changes, when coming online, or when sync completes
  useEffect(() => {
    // Only fetch if not currently syncing (wait for sync to complete)
    if (!isSyncing) {
      fetchTask();
      if (isOnline) {
        fetchUpcomingEvents();
      }
    }
  }, [id, isOnline, isSyncing]);

  const fetchTask = async () => {
    try {
      let taskData;

      if (isOnline) {
        const response = await tasksAPI.get(id);
        taskData = response.data;
      } else {
        // Offline: load from cache
        taskData = await getCachedTask(id);

        // Also check for pending signature
        if (taskData) {
          const pendingSignature = await getPendingSignature(parseInt(id));
          if (pendingSignature && pendingSignature.signatureBase64) {
            taskData = {
              ...taskData,
              local_signature: pendingSignature.signatureBase64,
              pending_signature: true,
            };
          }
        }
      }

      if (!taskData) {
        setTask(null);
        return;
      }

      setTask(taskData);

      if (taskData.scheduled_start) {
        setScheduleData({
          scheduled_start: formatDateTimeLocal(taskData.scheduled_start),
          scheduled_end: formatDateTimeLocal(taskData.scheduled_end),
        });
      }

      // Initialize edit data
      setEditData({
        customer_name: taskData.customer_name || '',
        customer_phone: taskData.customer_phone || '',
        customer_email: taskData.customer_email || '',
        delivery_address_line1: taskData.delivery_address_line1 || '',
        delivery_address_line2: taskData.delivery_address_line2 || '',
        delivery_city: taskData.delivery_city || '',
        delivery_state: taskData.delivery_state || '',
        delivery_zip: taskData.delivery_zip || '',
        item_title: taskData.item_title || '',
        item_description: taskData.item_description || '',
        delivery_notes: taskData.delivery_notes || '',
      });
    } catch (error) {
      console.error('Error fetching task:', error);
      // If API call fails, try cache as fallback
      if (isOnline) {
        const cachedTask = await getCachedTask(id);
        if (cachedTask) {
          setTask(cachedTask);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 14); // Next 2 weeks
      
      const response = await calendarAPI.getEvents(start, end);
      setUpcomingEvents(response.data);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    }
  };

  const formatDateTimeLocal = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper to format date as local ISO string (without timezone conversion)
  const toLocalISOString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setUpdating(true);

    // Validate date range
    const startDate = new Date(scheduleData.scheduled_start);
    const endDate = new Date(scheduleData.scheduled_end);

    if (endDate <= startDate) {
      alert('End time must be after start time. Please check your dates and times.');
      setUpdating(false);
      return;
    }

    try {
      const updatePayload = {
        scheduled_start: toLocalISOString(startDate),
        scheduled_end: toLocalISOString(endDate),
        status: 'scheduled',
      };

      await tasksAPI.update(id, updatePayload);
      await fetchTask();
      setShowScheduleForm(false);
    } catch (error) {
      console.error('Error scheduling task:', error);
      alert('Failed to schedule delivery');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkDelivered = () => {
    // Show signature canvas instead of immediately marking as delivered
    setShowSignature(true);
  };

  const handleSignatureSave = async (signatureFile) => {
    setSavingSignature(true);

    try {
      if (!isOnline) {
        // OFFLINE: Convert signature to base64 and store locally
        const reader = new FileReader();
        reader.onloadend = async () => {
          const signatureBase64 = reader.result;

          try {
            // Save signature to IndexedDB for later upload
            await savePendingSignature(parseInt(id), signatureBase64);

            // Queue the status update
            await queueAction({
              type: 'UPDATE_TASK_WITH_SIGNATURE',
              taskId: parseInt(id),
              data: { status: 'delivered' },
            });

            // Update local cache with delivered status and local signature
            await updateCachedTask(parseInt(id), {
              status: 'delivered',
              delivered_at: new Date().toISOString(),
              pending_signature: true,
            });

            setTask(prev => ({
              ...prev,
              status: 'delivered',
              delivered_at: new Date().toISOString(),
              pending_signature: true,
              local_signature: signatureBase64,
            }));

            setShowSignature(false);
            alert('Signature saved! It will upload automatically when you reconnect.');
          } catch (error) {
            console.error('Error saving signature offline:', error);
            alert('Failed to save signature locally.');
          } finally {
            setSavingSignature(false);
          }
        };
        reader.readAsDataURL(signatureFile);
        return;
      }

      // ONLINE: Upload signature image directly
      const uploadResponse = await uploadsAPI.uploadImages([signatureFile]);
      const signatureUrl = uploadResponse.data.urls[0];

      // Update task with delivered status and signature URL
      await tasksAPI.update(id, {
        status: 'delivered',
        signature_url: signatureUrl,
      });

      await fetchTask();
      setShowSignature(false);
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Failed to save signature. Please try again.');
    } finally {
      setSavingSignature(false);
    }
  };

  const handleSignatureCancel = () => {
    setShowSignature(false);
  };

  const handlePaymentReceived = async () => {
    if (!confirm('Confirm payment has been received?')) return;

    setUpdating(true);
    try {
      if (isOnline) {
        await tasksAPI.update(id, { status: 'paid' });
        await fetchTask();
      } else {
        // Queue action for later sync
        await queueAction({
          type: 'UPDATE_TASK',
          taskId: parseInt(id),
          data: { status: 'paid' },
        });

        // Update local cache optimistically
        await updateCachedTask(parseInt(id), {
          status: 'paid',
          paid_at: new Date().toISOString(),
        });

        // Update local state
        setTask(prev => ({
          ...prev,
          status: 'paid',
          paid_at: new Date().toISOString(),
        }));

        alert('Payment recorded. Will sync when back online.');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelTask = async () => {
    if (!confirm('Cancel this delivery?')) return;

    setUpdating(true);
    try {
      await tasksAPI.update(id, { status: 'cancelled' });
      await fetchTask();
    } catch (error) {
      console.error('Error canceling task:', error);
      alert('Failed to cancel task');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!confirm('Delete this delivery from the system? This cannot be undone.')) return;

    setUpdating(true);
    try {
      await tasksAPI.delete(id);
      navigate('/');
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    } finally {
      setUpdating(false);
    }
  };

  const handleUnschedule = async () => {
    if (!confirm('Remove from schedule? This will set the delivery back to pending status.')) return;

    setUpdating(true);
    try {
      await tasksAPI.update(id, {
        scheduled_start: null,
        scheduled_end: null,
        status: 'pending',
      });
      await fetchTask();
    } catch (error) {
      console.error('Error unscheduling task:', error);
      alert('Failed to unschedule task');
    } finally {
      setUpdating(false);
    }
  };

  const handleStartingDelivery = async () => {
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
      const destination = `${task.delivery_address_line1}, ${task.delivery_city}, ${task.delivery_state} ${task.delivery_zip}`;

      // Get ETA from Google Maps
      const etaDuration = await getETA(latitude, longitude, destination);
      const arrivalTime = formatArrivalTime(etaDuration);

      // Format customer's first name
      const firstName = task.customer_name.split(' ')[0];

      // Create the SMS message
      const message = `Hi ${firstName}, this is Consigned By Design. We're on our way with your delivery! Our estimated arrival time is around ${arrivalTime}.`;

      // Open SMS app with pre-filled message
      openSmsWithMessage(task.customer_phone, message);

    } catch (error) {
      console.error('Error getting location:', error);

      // Fallback: send SMS without specific ETA
      const firstName = task.customer_name.split(' ')[0];
      const message = `Hi ${firstName}, this is Consigned By Design. We're on our way with your delivery!`;
      openSmsWithMessage(task.customer_phone, message);

    } finally {
      setGettingLocation(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await tasksAPI.update(id, editData);
      await fetchTask();
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset edit data to current task values
    setEditData({
      customer_name: task.customer_name || '',
      customer_phone: task.customer_phone || '',
      customer_email: task.customer_email || '',
      delivery_address_line1: task.delivery_address_line1 || '',
      delivery_address_line2: task.delivery_address_line2 || '',
      delivery_city: task.delivery_city || '',
      delivery_state: task.delivery_state || '',
      delivery_zip: task.delivery_zip || '',
      item_title: task.item_title || '',
      item_description: task.item_description || '',
      delivery_notes: task.delivery_notes || '',
    });
    setIsEditing(false);
  };

  // For user-entered dates (scheduled times) - display as entered, no UTC conversion
  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // For system timestamps (delivered_at, paid_at, created_at) - stored in UTC, convert to EST
  const formatSystemDate = (dateString) => {
    if (!dateString) return '';
    // Append 'Z' to treat as UTC if no timezone specified
    const utcString = dateString.endsWith('Z') || dateString.includes('+')
      ? dateString
      : dateString + 'Z';
    const date = new Date(utcString);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClass = (status) => {
    return `status-badge status-${status}`;
  };

  const canSchedule = user && (user.role === 'scheduler' || user.role === 'admin');
  const canMarkDelivered = user && (user.role === 'scheduler' || user.role === 'admin');

  if (loading) {
    return <div className="spinner"></div>;
  }

  if (!task) {
    return (
      <div className="task-detail">
        <div className="alert alert-error">Task not found</div>
      </div>
    );
  }

  return (
    <div className="task-detail">
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Delivery Details</h1>
        <div className="header-actions">
          {!isEditing && canSchedule && task.status !== 'delivered' && task.status !== 'paid' && (
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
                    handleDeleteTask();
                  }}
                >
                  Delete from System
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          {isEditing ? (
            /* Edit Mode */
            <form onSubmit={handleSaveEdit} className="edit-form">
              <div className="card">
                <div className="card-header-with-badge">
                  <h2>Customer Information</h2>
                  <span className={getStatusBadgeClass(task.status)}>
                    {task.status}
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
                      required
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
                <h2>Delivery Address</h2>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="delivery_address_line1">Address Line 1</label>
                    <input
                      id="delivery_address_line1"
                      type="text"
                      value={editData.delivery_address_line1}
                      onChange={(e) => setEditData({ ...editData, delivery_address_line1: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="delivery_address_line2">Address Line 2</label>
                    <input
                      id="delivery_address_line2"
                      type="text"
                      value={editData.delivery_address_line2}
                      onChange={(e) => setEditData({ ...editData, delivery_address_line2: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="delivery_city">City</label>
                    <input
                      id="delivery_city"
                      type="text"
                      value={editData.delivery_city}
                      onChange={(e) => setEditData({ ...editData, delivery_city: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="delivery_state">State</label>
                    <input
                      id="delivery_state"
                      type="text"
                      value={editData.delivery_state}
                      onChange={(e) => setEditData({ ...editData, delivery_state: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="delivery_zip">ZIP Code</label>
                    <input
                      id="delivery_zip"
                      type="text"
                      value={editData.delivery_zip}
                      onChange={(e) => setEditData({ ...editData, delivery_zip: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>Item Information</h2>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="item_title">Item Title</label>
                    <input
                      id="item_title"
                      type="text"
                      value={editData.item_title}
                      onChange={(e) => setEditData({ ...editData, item_title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="item_description">Item Description</label>
                    <textarea
                      id="item_description"
                      value={editData.item_description}
                      onChange={(e) => setEditData({ ...editData, item_description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>Delivery Notes</h2>
                <div className="form-group">
                  <textarea
                    id="delivery_notes"
                    value={editData.delivery_notes}
                    onChange={(e) => setEditData({ ...editData, delivery_notes: e.target.value })}
                    rows={4}
                    placeholder="Add notes about the delivery..."
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
            <>
              <div className="card">
                <div className="card-header-with-badge">
                  <h2>Customer Information</h2>
                  <span className={getStatusBadgeClass(task.status)}>
                    {task.status}
                  </span>
                </div>

                <div className="info-grid">
                  <div className="info-item">
                    <label>Name</label>
                    <div className="info-value">{task.customer_name}</div>
                  </div>

                  <div className="info-item">
                    <label>Phone</label>
                    <div className="info-value">
                      <a href={`tel:${task.customer_phone}`}>{task.customer_phone}</a>
                    </div>
                  </div>

                  {task.customer_email && (
                    <div className="info-item">
                      <label>Email</label>
                      <div className="info-value">
                        <a href={`mailto:${task.customer_email}`}>{task.customer_email}</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <h2>Delivery Address</h2>
                <div className="address-block">
                  <p>{task.delivery_address_line1}</p>
                  {task.delivery_address_line2 && <p>{task.delivery_address_line2}</p>}
                  <p>{task.delivery_city}, {task.delivery_state} {task.delivery_zip}</p>
                </div>
                <button
                  onClick={() => openInMaps(
                    `${task.delivery_address_line1}, ${task.delivery_city}, ${task.delivery_state} ${task.delivery_zip}`
                  )}
                  className="btn btn-secondary"
                >
                  Open in Maps
                </button>
              </div>

              <div className="card">
                <h2>Item Information {task.items && task.items.length > 1 ? `(${task.items.length} items)` : ''}</h2>
                
                {/* Multiple items display */}
                {task.items && task.items.length > 0 ? (
                  <div className="multi-items-list">
                    {task.items.map((item, index) => (
                      <div key={index} className="multi-item-card">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.title} className="multi-item-image" />
                        )}
                        <div className="multi-item-info">
                          <h4>{item.title}</h4>
                          {item.description && (
                            <p className="multi-item-desc">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Single item display (backwards compatible) */
                  <>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Item</label>
                        <div className="info-value">{task.item_title}</div>
                      </div>

                      {task.liberty_item_id && (
                        <div className="info-item">
                          <label>Liberty ID</label>
                          <div className="info-value">{task.liberty_item_id}</div>
                        </div>
                      )}

                      {task.shopify_order_number && (
                        <div className="info-item">
                          <label>Order Number</label>
                          <div className="info-value">#{task.shopify_order_number}</div>
                        </div>
                      )}
                    </div>

                    {task.item_description && (
                      <div className="info-item" style={{ marginTop: '12px' }}>
                        <label>Description</label>
                        <div className="info-value">{task.item_description}</div>
                      </div>
                    )}

                    {task.image_url && (
                      <div className="item-image">
                        <img src={task.image_url} alt={task.item_title} />
                      </div>
                    )}
                  </>
                )}
              </div>

              {task.delivery_notes && (
                <div className="card">
                  <h2>Delivery Notes</h2>
                  <p className="notes-text">{task.delivery_notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="detail-sidebar">
          {/* Completion Timeline - Show when delivered or paid */}
          {(task.delivered_at || task.paid_at) && (
            <div className="card completion-card">
              <h2>Completion Timeline</h2>
              <div className="timeline">
                {task.delivered_at && (
                  <div className="timeline-item delivered">
                    <div className="timeline-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                      </svg>
                    </div>
                    <div className="timeline-content">
                      <label>Delivered</label>
                      <div className="info-value">{formatSystemDate(task.delivered_at)}</div>
                    </div>
                  </div>
                )}
                {task.paid_at && (
                  <div className="timeline-item paid">
                    <div className="timeline-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                      </svg>
                    </div>
                    <div className="timeline-content">
                      <label>Payment Received</label>
                      <div className="info-value">{formatSystemDate(task.paid_at)}</div>
                    </div>
                  </div>
                )}
                {(task.signature_url || task.local_signature) && (
                  <div className="timeline-item signature">
                    <div className="timeline-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    </div>
                    <div className="timeline-content">
                      <label>
                        Customer Signature
                        {task.pending_signature && !task.signature_url && (
                          <span className="pending-badge"> (pending upload)</span>
                        )}
                      </label>
                      <img
                        src={task.signature_url || task.local_signature}
                        alt="Customer signature"
                        className="signature-image"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <h2>Schedule</h2>
            
            {!showScheduleForm ? (
              <>
                <div className="schedule-info">
                  <div className="info-item">
                    <label>Scheduled Window</label>
                    <div className="info-value">{formatDate(task.scheduled_start)}</div>
                  </div>
                  {task.scheduled_end && (
                    <div className="info-item">
                      <label>To</label>
                      <div className="info-value">{formatDate(task.scheduled_end)}</div>
                    </div>
                  )}
                </div>

                {canSchedule && task.status !== 'delivered' && task.status !== 'paid' && (
                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => setShowScheduleForm(true)}
                    disabled={updating}
                  >
                    {task.scheduled_start ? 'Reschedule' : 'Schedule Delivery'}
                  </button>
                )}
              </>
            ) : (
              <form onSubmit={handleSchedule} className="schedule-form">
                <div className="form-group">
                  <label htmlFor="scheduled_start">Start Time</label>
                  <input
                    id="scheduled_start"
                    type="datetime-local"
                    value={scheduleData.scheduled_start}
                    onChange={(e) =>
                      setScheduleData({ ...scheduleData, scheduled_start: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="scheduled_end">End Time</label>
                  <input
                    id="scheduled_end"
                    type="datetime-local"
                    value={scheduleData.scheduled_end}
                    onChange={(e) =>
                      setScheduleData({ ...scheduleData, scheduled_end: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Upcoming Events Preview */}
                <div className="upcoming-events">
                  <div className="upcoming-header">
                    <span>Upcoming Deliveries (Next 2 Weeks)</span>
                    <Link to="/calendar" className="view-calendar-link">
                      View Full Calendar →
                    </Link>
                  </div>
                  <div className="events-list">
                    {upcomingEvents.length === 0 ? (
                      <p className="no-events">No scheduled deliveries</p>
                    ) : (
                      upcomingEvents.slice(0, 5).map((event) => (
                        <div key={event.id} className="event-item">
                          <div className="event-time">
                            {new Date(event.start).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            <span className="time">
                              {new Date(event.start).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="event-title">{event.title}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowScheduleForm(false)}
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={updating}>
                    {updating ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Actions card - only show for statuses that have actions beyond scheduling */}
          {canMarkDelivered && (task.status === 'scheduled' || task.status === 'delivered') && (
            <div className="card">
              <h2>Actions</h2>
              <div className="action-buttons">
                {task.status === 'scheduled' && (
                  <>
                    <button
                      className="btn btn-info btn-full"
                      onClick={handleStartingDelivery}
                      disabled={gettingLocation}
                    >
                      {gettingLocation ? 'Getting Location...' : 'Starting Delivery (Send SMS)'}
                    </button>
                    <button
                      className="btn btn-warning btn-full"
                      onClick={handleMarkDelivered}
                      disabled={updating}
                    >
                      Mark as Delivered
                    </button>
                    <button
                      className="btn btn-secondary btn-full"
                      onClick={handleUnschedule}
                      disabled={updating}
                    >
                      Remove from Schedule
                    </button>
                  </>
                )}
                {task.status === 'delivered' && (
                  <button
                    className="btn btn-success btn-full"
                    onClick={handlePaymentReceived}
                    disabled={updating}
                  >
                    Payment Received
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      {showSignature && (
        <SignatureCanvas
          onSave={handleSignatureSave}
          onCancel={handleSignatureCancel}
          saving={savingSignature}
        />
      )}
    </div>
  );
};

export default TaskDetail;

