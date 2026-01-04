import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tasksAPI, calendarAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './TaskDetail.css';

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [scheduleData, setScheduleData] = useState({
    scheduled_start: '',
    scheduled_end: '',
  });

  useEffect(() => {
    fetchTask();
    fetchUpcomingEvents();
  }, [id]);

  const fetchTask = async () => {
    try {
      const response = await tasksAPI.get(id);
      setTask(response.data);
      
      if (response.data.scheduled_start) {
        setScheduleData({
          scheduled_start: formatDateTimeLocal(response.data.scheduled_start),
          scheduled_end: formatDateTimeLocal(response.data.scheduled_end),
        });
      }
    } catch (error) {
      console.error('Error fetching task:', error);
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

  const handleMarkDelivered = async () => {
    if (!confirm('Mark this delivery as delivered? (Status will be "Awaiting Payment")')) return;

    setUpdating(true);
    try {
      await tasksAPI.update(id, { status: 'delivered' });
      await fetchTask();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentReceived = async () => {
    if (!confirm('Confirm payment has been received?')) return;

    setUpdating(true);
    try {
      await tasksAPI.update(id, { status: 'paid' });
      await fetchTask();
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
      </div>

      <div className="detail-grid">
        <div className="detail-main">
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
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(
                `${task.delivery_address_line1}, ${task.delivery_city}, ${task.delivery_state} ${task.delivery_zip}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              📍 Open in Maps
            </a>
          </div>

          <div className="card">
            <h2>Item Information</h2>
            <div className="info-grid">
              <div className="info-item">
                <label>Item</label>
                <div className="info-value">{task.item_title}</div>
              </div>

              <div className="info-item">
                <label>SKU</label>
                <div className="info-value">{task.sku}</div>
              </div>

              <div className="info-item">
                <label>Liberty ID</label>
                <div className="info-value">{task.liberty_item_id}</div>
              </div>

              {task.shopify_order_number && (
                <div className="info-item">
                  <label>Order Number</label>
                  <div className="info-value">#{task.shopify_order_number}</div>
                </div>
              )}
            </div>

            {task.item_description && (
              <div className="info-item">
                <label>Description</label>
                <div className="info-value">{task.item_description}</div>
              </div>
            )}

            {task.image_url && (
              <div className="item-image">
                <img src={task.image_url} alt={task.item_title} />
              </div>
            )}
          </div>

          {task.delivery_notes && (
            <div className="card">
              <h2>Delivery Notes</h2>
              <p className="notes-text">{task.delivery_notes}</p>
            </div>
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
                    <div className="timeline-icon">🚚</div>
                    <div className="timeline-content">
                      <label>Delivered</label>
                      <div className="info-value">{formatDate(task.delivered_at)}</div>
                    </div>
                  </div>
                )}
                {task.paid_at && (
                  <div className="timeline-item paid">
                    <div className="timeline-icon">💰</div>
                    <div className="timeline-content">
                      <label>Payment Received</label>
                      <div className="info-value">{formatDate(task.paid_at)}</div>
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

          {canMarkDelivered && (
            <div className="card">
              <h2>Actions</h2>
              <div className="action-buttons">
                {task.status === 'scheduled' && (
                  <>
                    <button
                      className="btn btn-warning btn-full"
                      onClick={handleMarkDelivered}
                      disabled={updating}
                    >
                      🚚 Mark as Delivered
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
                    💰 Payment Received
                  </button>
                )}
                {task.status !== 'delivered' && task.status !== 'paid' && task.status !== 'cancelled' && (
                  <button
                    className="btn btn-secondary btn-full"
                    onClick={handleCancelTask}
                    disabled={updating}
                  >
                    Cancel Delivery
                  </button>
                )}
                {/* Delete from system */}
                <button
                  className="btn btn-danger btn-full"
                  onClick={handleDeleteTask}
                  disabled={updating}
                  style={{ marginTop: '16px' }}
                >
                  Delete from System
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;

