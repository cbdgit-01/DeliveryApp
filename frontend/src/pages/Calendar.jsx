import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { calendarAPI, tasksAPI } from '../services/api';
import './Calendar.css';

const Calendar = () => {
  const calendarRef = useRef(null);
  const navigate = useNavigate();
  const [unscheduled, setUnscheduled] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const draggableInitialized = useRef(false);
  const isSchedulingRef = useRef(false);

  useEffect(() => {
    fetchUnscheduledTasks();
    fetchCalendarEvents();
  }, []);

  const fetchCalendarEvents = async () => {
    try {
      // Get a reasonable date range
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      const end = new Date();
      end.setMonth(end.getMonth() + 3);
      
      const response = await calendarAPI.getEvents(start, end);
      // Ensure all IDs are strings for consistency
      const eventsWithStringIds = response.data.map(event => ({
        ...event,
        id: String(event.id)
      }));
      setCalendarEvents(eventsWithStringIds);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    }
  };

  // Initialize draggable for external events
  useEffect(() => {
    const containerEl = document.getElementById('unscheduled-events');
    if (!containerEl) return;

    // Clean up old draggable if it exists
    if (draggableInitialized.current) {
      // Destroy is handled by creating new instance
    }

    const draggable = new Draggable(containerEl, {
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
    draggableInitialized.current = true;

    return () => {
      draggable.destroy();
      draggableInitialized.current = false;
    };
  }, [unscheduled]);

  const fetchUnscheduledTasks = async () => {
    try {
      const response = await calendarAPI.getUnscheduled();
      setUnscheduled(response.data);
    } catch (error) {
      console.error('Error fetching unscheduled tasks:', error);
    }
  };

  const handleEventClick = (clickInfo) => {
    setSelectedEvent(clickInfo.event);
    setShowEventModal(true);
  };

  const handleEventDrop = async (dropInfo) => {
    const taskId = dropInfo.event.id;
    const newStart = dropInfo.event.start;
    const newEnd = dropInfo.event.end || new Date(newStart.getTime() + 3600000);

    // Use local time strings
    const startStr = toLocalISOString(newStart);
    const endStr = toLocalISOString(newEnd);

    try {
      await tasksAPI.update(taskId, {
        scheduled_start: startStr,
        scheduled_end: endStr,
      });
      
      // Update the state to reflect the new position
      setCalendarEvents(prev => prev.map(event => 
        String(event.id) === String(taskId) 
          ? { ...event, start: startStr, end: endStr }
          : event
      ));
    } catch (error) {
      console.error('Error updating event:', error);
      dropInfo.revert();
      alert('Failed to update delivery time');
    }
  };

  const handleEventResize = async (resizeInfo) => {
    const taskId = resizeInfo.event.id;
    const newStart = resizeInfo.event.start;
    const newEnd = resizeInfo.event.end;

    // Use local time strings
    const startStr = toLocalISOString(newStart);
    const endStr = toLocalISOString(newEnd);

    try {
      await tasksAPI.update(taskId, {
        scheduled_start: startStr,
        scheduled_end: endStr,
      });
      
      // Update the state to reflect the new size
      setCalendarEvents(prev => prev.map(event => 
        String(event.id) === String(taskId) 
          ? { ...event, start: startStr, end: endStr }
          : event
      ));
    } catch (error) {
      console.error('Error resizing event:', error);
      resizeInfo.revert();
      alert('Failed to update delivery time');
    }
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

  const handleEventReceive = async (eventInfo) => {
    // When an unscheduled task is dropped onto the calendar
    const taskId = eventInfo.event.id;
    const start = eventInfo.event.start;
    const end = eventInfo.event.end || new Date(start.getTime() + 3600000);

    // Use local time strings to preserve the exact time the user selected
    const startStr = toLocalISOString(start);
    const endStr = toLocalISOString(end);

    try {
      // Update the backend first
      await tasksAPI.update(taskId, {
        scheduled_start: startStr,
        scheduled_end: endStr,
        status: 'scheduled',
      });

      // Remove the dropped event (we'll add it properly to state)
      eventInfo.event.remove();

      // Add to calendar events state with proper formatting
      const newEvent = {
        id: String(taskId),
        title: eventInfo.event.title,
        start: startStr,
        end: endStr,
        backgroundColor: '#f97373',
        borderColor: '#ef4444',
        extendedProps: eventInfo.event.extendedProps
      };
      setCalendarEvents(prev => [...prev, newEvent]);

      // Refresh unscheduled tasks to remove from sidebar
      await fetchUnscheduledTasks();
    } catch (error) {
      console.error('Error scheduling task:', error);
      eventInfo.event.remove();
      alert('Failed to schedule delivery');
      await fetchUnscheduledTasks();
    }
  };

  const closeModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
  };

  const goToTaskDetail = () => {
    if (selectedEvent) {
      navigate(`/tasks/${selectedEvent.id}`);
    }
  };

  const handleUnschedule = async () => {
    if (!selectedEvent) return;
    
    if (!confirm('Remove this delivery from the schedule? It will go back to pending status.')) {
      return;
    }

    const eventId = selectedEvent.id;

    try {
      await tasksAPI.update(eventId, {
        scheduled_start: null,
        scheduled_end: null,
        status: 'pending',
      });

      // Remove from calendar events state
      setCalendarEvents(prev => prev.filter(event => String(event.id) !== String(eventId)));
      
      // Refresh unscheduled list to show the item again
      await fetchUnscheduledTasks();
      
      closeModal();
    } catch (error) {
      console.error('Error unscheduling task:', error);
      alert('Failed to unschedule delivery');
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
        <h1>Delivery Calendar</h1>
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
          <h3>Unscheduled Deliveries</h3>
          <p className="sidebar-hint">Drag items onto the calendar to schedule</p>
          {unscheduled.length > 0 ? (
            <div id="unscheduled-events" className="unscheduled-list">
              {unscheduled.map((task) => (
                <div
                  key={task.id}
                  className="unscheduled-item fc-event"
                  data-event={JSON.stringify({
                    id: task.id,
                    title: task.title,
                    duration: task.duration,
                    extendedProps: task.extendedProps,
                  })}
                >
                  <div className="unscheduled-title">{task.title}</div>
                  <div className="unscheduled-sku">SKU: {task.extendedProps.sku}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-unscheduled">
              <p>All deliveries scheduled ✓</p>
            </div>
          )}
        </div>

        <div className="calendar-wrapper">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: '',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            views={{
              timeGridWeek: {
                titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
              },
              timeGridDay: {
                titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },
              },
            }}
            height="calc(100vh - 200px)"
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
              {/* Product Image */}
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
              <div className="modal-info">
                <label>Item</label>
                <div>{selectedEvent.extendedProps.item_title}</div>
              </div>
              <div className="modal-info">
                <label>SKU</label>
                <div>{selectedEvent.extendedProps.sku}</div>
              </div>
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
              <button className="btn btn-primary" onClick={goToTaskDetail}>
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

