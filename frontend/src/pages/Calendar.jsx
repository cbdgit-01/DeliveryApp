import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { calendarAPI, tasksAPI, pickupsAPI } from '../services/api';
import './Calendar.css';

const Calendar = () => {
  const monthCalendarRef = useRef(null);
  const dayCalendarRef = useRef(null);
  const calendarPageRef = useRef(null);
  const navigate = useNavigate();
  const [unscheduledDeliveries, setUnscheduledDeliveries] = useState([]);
  const [unscheduledPickups, setUnscheduledPickups] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const deliveryDraggableRef = useRef(null);
  const pickupDraggableRef = useRef(null);
  
  // Touch/swipe tracking
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isSwiping = useRef(false);

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
          backgroundColor: '#9334ea',
          borderColor: '#9334ea'
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

  // Click event in day view shows modal
  const handleEventClick = (clickInfo) => {
    setSelectedEvent(clickInfo.event);
    setShowEventModal(true);
  };

  // Click on a day in month view opens day view
  const handleDateClick = (dateInfo) => {
    setSelectedDate(dateInfo.date);
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
        backgroundColor: isPickup ? '#9334ea' : '#ea4335',
        borderColor: isPickup ? '#9334ea' : '#ea4335',
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
    if (selectedDate) {
      setSelectedDate(new Date());
    } else if (monthCalendarRef.current) {
      monthCalendarRef.current.getApi().today();
    }
  };

  const closeDayView = () => {
    setSelectedDate(null);
  };

  // Navigate day view
  const navigateDay = (direction) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + direction);
      setSelectedDate(newDate);
    }
  };

  // Touch/swipe handlers for mobile navigation with continuous drag
  const handleTouchStart = useCallback((e) => {
    if (isAnimating) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, [isAnimating]);

  const handleTouchMove = useCallback((e) => {
    if (touchStartX.current === null || isAnimating) return;
    
    const touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;
    const deltaX = touchCurrentX - touchStartX.current;
    const deltaY = touchCurrentY - touchStartY.current;
    
    // Only track horizontal swipes
    if (!isSwiping.current && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isSwiping.current = true;
    }
    
    if (isSwiping.current) {
      // Limit the offset and add resistance at edges
      const maxOffset = 150;
      const resistance = 0.4;
      let offset = deltaX * resistance;
      offset = Math.max(-maxOffset, Math.min(maxOffset, offset));
      setSwipeOffset(offset);
    }
  }, [isAnimating]);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    
    // Animate back or navigate
    const minSwipeDistance = 50;
    if (isSwiping.current && Math.abs(deltaX) > minSwipeDistance) {
      const direction = deltaX > 0 ? -1 : 1; // Swipe left = next, swipe right = prev
      
      // Animate the transition
      setIsAnimating(true);
      setSwipeOffset(direction > 0 ? -300 : 300);
      
      setTimeout(() => {
        if (selectedDate) {
          navigateDay(direction);
        } else if (monthCalendarRef.current) {
          const api = monthCalendarRef.current.getApi();
          if (direction > 0) {
            api.next();
          } else {
            api.prev();
          }
        }
        setSwipeOffset(0);
        setIsAnimating(false);
      }, 200);
    } else {
      // Snap back
      setSwipeOffset(0);
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
    isSwiping.current = false;
  }, [selectedDate, isAnimating]);

  // Format selected date for display
  const formatSelectedDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get events for the selected day
  const getDayEvents = () => {
    if (!selectedDate) return [];
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    return calendarEvents.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= dayStart && eventStart <= dayEnd;
    });
  };

  return (
    <div 
      className="calendar-page" 
      ref={calendarPageRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="calendar-header">
        <div className="calendar-title">
          <h1>Calendar</h1>
          <span className="swipe-hint-header">Swipe to change month</span>
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

        <div className="calendar-main">
          {/* Month View */}
          {!selectedDate && (
            <div 
              className="calendar-wrapper month-view"
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: isAnimating ? 'transform 0.2s ease-out' : 'none'
              }}
            >
              <FullCalendar
                ref={monthCalendarRef}
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: '',
                  center: 'title',
                  right: '',
                }}
                titleFormat={{ year: 'numeric', month: 'long' }}
                height="calc(100vh - 160px)"
                events={calendarEvents}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                eventDrop={handleEventDrop}
                eventReceive={handleEventReceive}
                editable={true}
                droppable={true}
                dayMaxEventRows={3}
                weekends={true}
                dropAccept=".unscheduled-item"
                eventDisplay="block"
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
            <div 
              className="calendar-wrapper day-view"
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: isAnimating ? 'transform 0.2s ease-out' : 'none'
              }}
            >
              <div className="day-view-header">
                <button className="btn-back-day" onClick={closeDayView}>
                  ← Back to Month
                </button>
                <div className="day-view-title">
                  <h2>{formatSelectedDate(selectedDate)}</h2>
                  <span className="swipe-hint">Swipe to change day</span>
                </div>
              </div>
              <FullCalendar
                ref={dayCalendarRef}
                key={selectedDate.toISOString()} // Force re-render on date change
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
                    timeZone: 'America/New_York',
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
