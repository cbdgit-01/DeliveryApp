import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { calendarAPI, tasksAPI, pickupsAPI } from '../services/api';
import './Calendar.css';

const Calendar = () => {
  const calendarRef = useRef(null);
  const navigate = useNavigate();
  const [unscheduledDeliveries, setUnscheduledDeliveries] = useState([]);
  const [unscheduledPickups, setUnscheduledPickups] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
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
      start.setMonth(start.getMonth() - 1);
      const end = new Date();
      end.setMonth(end.getMonth() + 3);
      
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
          backgroundColor: '#f97373',
          borderColor: '#ef4444'
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
          backgroundColor: '#a78bfa',
          borderColor: '#8b5cf6'
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

    // Determine if this is a delivery or pickup
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
        backgroundColor: isPickup ? '#a78bfa' : '#f97373',
        borderColor: isPickup ? '#8b5cf6' : '#ef4444',
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
      ? 'Remove this pickup from the schedule? It will go back to approved status.'
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
          status: 'approved',
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

  const handleTodayClick = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().today();
    }
  };

  const handlePrevClick = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().prev();
    }
  };

  const handleNextClick = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().next();
    }
  };

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1>Calendar</h1>
        <div className="calendar-nav">
          <button className="btn btn-secondary" onClick={handlePrevClick}>
            ← Prev
          </button>
          <button className="btn btn-secondary" onClick={handleTodayClick}>
            Today
          </button>
          <button className="btn btn-secondary" onClick={handleNextClick}>
            Next →
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
                <p>No approved pickups to schedule</p>
              </div>
            )}
          </div>
        </div>

        <div className="calendar-wrapper">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: '',
              center: 'title',
              right: 'dayGridMonth,timeGridDay,listWeek',
            }}
            views={{
              dayGridMonth: {
                titleFormat: { year: 'numeric', month: 'long' },
                dayMaxEventRows: 4,
              },
              timeGridDay: {
                titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },
              },
            }}
            height="calc(100vh - 160px)"
            contentHeight="auto"
            events={calendarEvents}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventReceive={handleEventReceive}
            editable={true}
            droppable={true}
            dayMaxEvents={true}
            weekends={true}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            allDaySlot={false}
            eventDurationEditable={true}
            eventOverlap={true}
            dropAccept=".unscheduled-item"
            nowIndicator={true}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
            eventResizableFromStart={true}
            expandRows={true}
            handleWindowResize={true}
          />
        </div>
      </div>

      {showEventModal && selectedEvent && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent.title}</h2>
              <button className="modal-close" onClick={closeModal}>
                ✕
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
              <div className="modal-info">
                <label>Phone</label>
                <div>
                  <a href={`tel:${selectedEvent.extendedProps.customer_phone}`}>
                    {selectedEvent.extendedProps.customer_phone}
                  </a>
                </div>
              </div>
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
                style={{ marginBottom: '8px' }}
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
