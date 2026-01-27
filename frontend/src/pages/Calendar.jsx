import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { calendarAPI, tasksAPI, pickupsAPI } from '../services/api';
import './Calendar.css';

const Calendar = () => {
  const weekCalendarRef = useRef(null);
  const dayCalendarRef = useRef(null);
  const navigate = useNavigate();
  const [unscheduledDeliveries, setUnscheduledDeliveries] = useState([]);
  const [unscheduledPickups, setUnscheduledPickups] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentTitle, setCurrentTitle] = useState('');
  const deliveryDraggableRef = useRef(null);
  const pickupDraggableRef = useRef(null);

  useEffect(() => {
    fetchUnscheduledDeliveries();
    fetchUnscheduledPickups();
    fetchCalendarEvents();
  }, []);

  const fetchCalendarEvents = async () => {
    try {
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      const end = new Date();
      end.setMonth(end.getMonth() + 6);

      const response = await calendarAPI.getEvents(start, end);
      const eventsWithStringIds = response.data.map(event => ({
        ...event,
        id: String(event.id)
      }));
      setCalendarEvents(eventsWithStringIds);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    }
  };

  // Initialize draggable for delivery events
  useEffect(() => {
    const containerEl = document.getElementById('unscheduled-deliveries');
    if (!containerEl) return;

    if (deliveryDraggableRef.current) {
      deliveryDraggableRef.current.destroy();
    }

    deliveryDraggableRef.current = new Draggable(containerEl, {
      itemSelector: '.unscheduled-item',
      eventData: function(eventEl) {
        const data = JSON.parse(eventEl.getAttribute('data-event'));
        return {
          id: String(data.id),
          title: data.title,
          duration: '01:00:00',
          extendedProps: data.extendedProps,
          backgroundColor: '#ea4335',
          borderColor: '#ea4335'
        };
      }
    });

    return () => {
      if (deliveryDraggableRef.current) {
        deliveryDraggableRef.current.destroy();
      }
    };
  }, [unscheduledDeliveries]);

  // Initialize draggable for pickup events
  useEffect(() => {
    const containerEl = document.getElementById('unscheduled-pickups');
    if (!containerEl) return;

    if (pickupDraggableRef.current) {
      pickupDraggableRef.current.destroy();
    }

    pickupDraggableRef.current = new Draggable(containerEl, {
      itemSelector: '.unscheduled-item',
      eventData: function(eventEl) {
        const data = JSON.parse(eventEl.getAttribute('data-event'));
        return {
          id: String(data.id),
          title: data.title,
          duration: '01:00:00',
          extendedProps: data.extendedProps,
          backgroundColor: '#ea4335',
          borderColor: '#ea4335'
        };
      }
    });

    return () => {
      if (pickupDraggableRef.current) {
        pickupDraggableRef.current.destroy();
      }
    };
  }, [unscheduledPickups]);

  const fetchUnscheduledDeliveries = async () => {
    try {
      const response = await calendarAPI.getUnscheduled();
      setUnscheduledDeliveries(response.data);
    } catch (error) {
      console.error('Error fetching unscheduled deliveries:', error);
    }
  };

  const fetchUnscheduledPickups = async () => {
    try {
      const response = await calendarAPI.getUnscheduledPickups();
      setUnscheduledPickups(response.data);
    } catch (error) {
      console.error('Error fetching unscheduled pickups:', error);
    }
  };

  // Click event shows modal
  const handleEventClick = (clickInfo) => {
    setSelectedEvent(clickInfo.event);
    setShowEventModal(true);
  };

  const toLocalISOString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const handleEventDrop = async (dropInfo) => {
    const eventId = dropInfo.event.id;
    const newStart = dropInfo.event.start;
    const newEnd = dropInfo.event.end || new Date(newStart.getTime() + 3600000);
    const startStr = toLocalISOString(newStart);
    const endStr = toLocalISOString(newEnd);

    const isPickup = eventId.startsWith('pickup-');
    const actualId = isPickup ? eventId.replace('pickup-', '') : eventId.replace('delivery-', '');

    try {
      if (isPickup) {
        await pickupsAPI.update(actualId, {
          scheduled_start: startStr,
          scheduled_end: endStr,
        });
      } else {
        await tasksAPI.update(actualId, {
          scheduled_start: startStr,
          scheduled_end: endStr,
        });
      }

      setCalendarEvents(prev => prev.map(event =>
        String(event.id) === String(eventId)
          ? { ...event, start: startStr, end: endStr }
          : event
      ));
    } catch (error) {
      console.error('Error updating event:', error);
      dropInfo.revert();
      alert('Failed to update time');
    }
  };

  const handleEventResize = async (resizeInfo) => {
    const eventId = resizeInfo.event.id;
    const newStart = resizeInfo.event.start;
    const newEnd = resizeInfo.event.end;
    const startStr = toLocalISOString(newStart);
    const endStr = toLocalISOString(newEnd);

    const isPickup = eventId.startsWith('pickup-');
    const actualId = isPickup ? eventId.replace('pickup-', '') : eventId.replace('delivery-', '');

    try {
      if (isPickup) {
        await pickupsAPI.update(actualId, {
          scheduled_start: startStr,
          scheduled_end: endStr,
        });
      } else {
        await tasksAPI.update(actualId, {
          scheduled_start: startStr,
          scheduled_end: endStr,
        });
      }

      setCalendarEvents(prev => prev.map(event =>
        String(event.id) === String(eventId)
          ? { ...event, start: startStr, end: endStr }
          : event
      ));
    } catch (error) {
      console.error('Error resizing event:', error);
      resizeInfo.revert();
      alert('Failed to update time');
    }
  };

  const handleEventReceive = async (eventInfo) => {
    const eventId = eventInfo.event.id;
    const start = eventInfo.event.start;
    const end = eventInfo.event.end || new Date(start.getTime() + 3600000);
    const startStr = toLocalISOString(start);
    const endStr = toLocalISOString(end);

    const isPickup = eventId.startsWith('pickup-');
    const actualId = isPickup ? eventId.replace('pickup-', '') : eventId.replace('delivery-', '');

    try {
      if (isPickup) {
        await pickupsAPI.update(actualId, {
          scheduled_start: startStr,
          scheduled_end: endStr,
          status: 'scheduled',
        });
      } else {
        await tasksAPI.update(actualId, {
          scheduled_start: startStr,
          scheduled_end: endStr,
          status: 'scheduled',
        });
      }

      eventInfo.event.remove();

      const newEvent = {
        id: String(eventId),
        title: eventInfo.event.title,
        start: startStr,
        end: endStr,
        backgroundColor: '#ea4335',
        borderColor: '#ea4335',
        extendedProps: eventInfo.event.extendedProps
      };
      setCalendarEvents(prev => [...prev, newEvent]);

      if (isPickup) {
        await fetchUnscheduledPickups();
      } else {
        await fetchUnscheduledDeliveries();
      }
    } catch (error) {
      console.error('Error scheduling:', error);
      eventInfo.event.remove();
      alert('Failed to schedule');
      if (isPickup) {
        await fetchUnscheduledPickups();
      } else {
        await fetchUnscheduledDeliveries();
      }
    }
  };

  const closeModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
  };

  const goToDetail = () => {
    if (selectedEvent) {
      const isPickup = selectedEvent.extendedProps?.type === 'pickup';
      if (isPickup) {
        navigate(`/pickups/${selectedEvent.extendedProps.pickup_id}`);
      } else {
        const taskId = selectedEvent.extendedProps?.task_id || selectedEvent.id.replace('delivery-', '');
        navigate(`/tasks/${taskId}`);
      }
    }
  };

  const handleUnschedule = async () => {
    if (!selectedEvent) return;

    const isPickup = selectedEvent.extendedProps?.type === 'pickup';
    const confirmMsg = isPickup
      ? 'Remove this pickup from the schedule? It will go back to pending status.'
      : 'Remove this delivery from the schedule? It will go back to pending status.';

    if (!confirm(confirmMsg)) return;

    const eventId = selectedEvent.id;
    const actualId = isPickup
      ? selectedEvent.extendedProps.pickup_id
      : (selectedEvent.extendedProps?.task_id || eventId.replace('delivery-', ''));

    try {
      if (isPickup) {
        await pickupsAPI.update(actualId, {
          scheduled_start: null,
          scheduled_end: null,
          status: 'pending',
        });
        await fetchUnscheduledPickups();
      } else {
        await tasksAPI.update(actualId, {
          scheduled_start: null,
          scheduled_end: null,
          status: 'pending',
        });
        await fetchUnscheduledDeliveries();
      }

      setCalendarEvents(prev => prev.filter(event => String(event.id) !== String(eventId)));
      closeModal();
    } catch (error) {
      console.error('Error unscheduling:', error);
      alert('Failed to unschedule');
    }
  };

  // Navigation functions
  const navigatePrev = () => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() - 1);
      setSelectedDate(newDate);
    } else if (weekCalendarRef.current) {
      weekCalendarRef.current.getApi().prev();
      updateTitle();
    }
  };

  const navigateNext = () => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 1);
      setSelectedDate(newDate);
    } else if (weekCalendarRef.current) {
      weekCalendarRef.current.getApi().next();
      updateTitle();
    }
  };

  const navigateToday = () => {
    if (selectedDate) {
      setSelectedDate(new Date());
    } else if (weekCalendarRef.current) {
      weekCalendarRef.current.getApi().today();
      updateTitle();
    }
  };

  const updateTitle = () => {
    if (weekCalendarRef.current) {
      const api = weekCalendarRef.current.getApi();
      setCurrentTitle(api.view.title);
    }
  };

  const closeDayView = () => {
    setSelectedDate(null);
  };

  // Handle clicking on column header to open day view
  const handleDayHeaderClick = (date) => {
    setSelectedDate(date);
  };

  // Custom day header content with clickable dates
  const renderDayHeaderContent = (arg) => {
    const dayName = arg.date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = arg.date.getDate();
    const isToday = arg.isToday;

    return (
      <button
        className={`day-header-btn ${isToday ? 'today' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          handleDayHeaderClick(arg.date);
        }}
      >
        <span className="day-name">{dayName}</span>
        <span className="day-num">{dayNum}</span>
      </button>
    );
  };

  // Format selected date for display
  const formatSelectedDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Update title when calendar loads
  const handleDatesSet = () => {
    updateTitle();
  };

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div className="calendar-title">
          <h1>Calendar</h1>
        </div>
        <div className="calendar-nav">
          <button className="nav-btn" onClick={navigatePrev}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>
          <button className="nav-btn today-btn" onClick={navigateToday}>
            Today
          </button>
          <button className="nav-btn" onClick={navigateNext}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="calendar-container">
        <div className="unscheduled-sidebar">
          {/* Unscheduled Deliveries */}
          <div className="sidebar-section">
            <h3>Unscheduled Deliveries</h3>
            <p className="sidebar-hint">Drag onto calendar to schedule</p>
            {unscheduledDeliveries.length > 0 ? (
              <div id="unscheduled-deliveries" className="unscheduled-list">
                {unscheduledDeliveries.map((task) => (
                  <div
                    key={task.id}
                    className="unscheduled-item fc-event delivery-item"
                    data-event={JSON.stringify({
                      id: task.id,
                      title: task.title,
                      duration: task.duration,
                      extendedProps: task.extendedProps,
                    })}
                  >
                    <div className="unscheduled-title">{task.title}</div>
                    <div className="unscheduled-sku">{task.extendedProps.customer_name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-unscheduled">
                <p>All deliveries scheduled</p>
              </div>
            )}
          </div>

          {/* Unscheduled Pickups */}
          <div className="sidebar-section">
            <h3>Unscheduled Pickups</h3>
            <p className="sidebar-hint">Drag onto calendar to schedule</p>
            {unscheduledPickups.length > 0 ? (
              <div id="unscheduled-pickups" className="unscheduled-list">
                {unscheduledPickups.map((pickup) => (
                  <div
                    key={pickup.id}
                    className="unscheduled-item fc-event pickup-item"
                    data-event={JSON.stringify({
                      id: pickup.id,
                      title: pickup.title,
                      duration: pickup.duration,
                      extendedProps: pickup.extendedProps,
                    })}
                  >
                    <div className="unscheduled-title">{pickup.title}</div>
                    <div className="unscheduled-sku">{pickup.extendedProps.item_count} item(s)</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-unscheduled">
                <p>No pending pickups to schedule</p>
              </div>
            )}
          </div>
        </div>

        <div className="calendar-main">
          {/* Week View */}
          {!selectedDate && (
            <div className="calendar-wrapper week-view">
              <FullCalendar
                ref={weekCalendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                  left: '',
                  center: 'title',
                  right: '',
                }}
                titleFormat={{ year: 'numeric', month: 'long' }}
                height="calc(100vh - 160px)"
                events={calendarEvents}
                eventClick={handleEventClick}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventReceive={handleEventReceive}
                datesSet={handleDatesSet}
                dayHeaderContent={renderDayHeaderContent}
                editable={true}
                droppable={true}
                weekends={true}
                dropAccept=".unscheduled-item"
                eventDisplay="block"
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                slotDuration="00:30:00"
                snapDuration="00:15:00"
                allDaySlot={false}
                eventDurationEditable={true}
                eventOverlap={true}
                nowIndicator={true}
                longPressDelay={150}
                eventTimeFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  meridiem: 'short',
                }}
              />
            </div>
          )}

          {/* Day View */}
          {selectedDate && (
            <div className="calendar-wrapper day-view">
              <div className="day-view-header">
                <button className="btn-back-day" onClick={closeDayView}>
                  ← Back to Week
                </button>
                <div className="day-view-title">
                  <h2>{formatSelectedDate(selectedDate)}</h2>
                </div>
              </div>
              <FullCalendar
                ref={dayCalendarRef}
                key={selectedDate.toISOString()}
                plugins={[timeGridPlugin, interactionPlugin]}
                initialView="timeGridDay"
                initialDate={selectedDate}
                headerToolbar={false}
                height="calc(100vh - 220px)"
                events={calendarEvents}
                eventClick={handleEventClick}
                eventDrop={handleEventDrop}
                eventResize={handleEventResize}
                eventReceive={handleEventReceive}
                editable={true}
                droppable={true}
                slotMinTime="06:00:00"
                slotMaxTime="22:00:00"
                slotDuration="00:30:00"
                snapDuration="00:15:00"
                allDaySlot={false}
                eventDurationEditable={true}
                eventOverlap={true}
                dropAccept=".unscheduled-item"
                nowIndicator={true}
                longPressDelay={150}
                eventTimeFormat={{
                  hour: 'numeric',
                  minute: '2-digit',
                  meridiem: 'short',
                }}
                eventResizableFromStart={true}
                expandRows={true}
              />
            </div>
          )}
        </div>
      </div>

      {showEventModal && selectedEvent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent.title}</h2>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {selectedEvent.extendedProps.image_url && (
                <div className="modal-image">
                  <img
                    src={selectedEvent.extendedProps.image_url}
                    alt={selectedEvent.extendedProps.item_title}
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}

              <div className="modal-info">
                <label>Type</label>
                <div>{selectedEvent.extendedProps.type === 'pickup' ? 'Pickup' : 'Delivery'}</div>
              </div>
              <div className="modal-info">
                <label>Customer</label>
                <div>{selectedEvent.extendedProps.customer_name}</div>
              </div>
              {selectedEvent.extendedProps.customer_phone && (
                <div className="modal-info">
                  <label>Phone</label>
                  <div>
                    <a href={`tel:${selectedEvent.extendedProps.customer_phone}`}>
                      {selectedEvent.extendedProps.customer_phone}
                    </a>
                  </div>
                </div>
              )}
              {selectedEvent.extendedProps.type === 'delivery' && (
                <div className="modal-info">
                  <label>Item</label>
                  <div>{selectedEvent.extendedProps.item_title}</div>
                </div>
              )}
              {selectedEvent.extendedProps.type === 'pickup' && (
                <>
                  <div className="modal-info">
                    <label>Items</label>
                    <div>{selectedEvent.extendedProps.item_count} item(s)</div>
                  </div>
                  <div className="modal-info">
                    <label>Description</label>
                    <div>{selectedEvent.extendedProps.item_description}</div>
                  </div>
                </>
              )}
              <div className="modal-info">
                <label>Address</label>
                <div>{selectedEvent.extendedProps.address}</div>
              </div>
              {selectedEvent.extendedProps.notes && (
                <div className="modal-info">
                  <label>Notes</label>
                  <div>{selectedEvent.extendedProps.notes}</div>
                </div>
              )}
              <div className="modal-info">
                <label>Time</label>
                <div>
                  {selectedEvent.start.toLocaleString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleUnschedule}
              >
                Remove from Schedule
              </button>
              <button className="btn btn-primary" onClick={goToDetail}>
                View Full Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
