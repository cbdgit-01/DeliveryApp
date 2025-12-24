from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from database import get_db
from models import User, DeliveryTask, TaskStatus
from schemas import CalendarEvent
from auth import get_current_user

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def get_event_color(status: TaskStatus) -> tuple:
    """Get color for calendar event based on status"""
    colors = {
        TaskStatus.pending: ("#f97373", "#ef4444"),    # Red - unfulfilled
        TaskStatus.scheduled: ("#f97373", "#ef4444"),  # Red - unfulfilled
        TaskStatus.delivered: ("#facc15", "#eab308"),  # Yellow - delivered, awaiting payment
        TaskStatus.paid: ("#4ade80", "#22c55e"),       # Green - payment received
        TaskStatus.cancelled: ("#64748b", "#475569"),  # Grey - cancelled
    }
    return colors.get(status, ("#38bdf8", "#0ea5e9"))  # Blue default


@router.get("", response_model=List[CalendarEvent])
def get_calendar_events(
    start: datetime = Query(..., description="Start date for calendar range"),
    end: datetime = Query(..., description="End date for calendar range"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get calendar events in FullCalendar format"""
    # Query tasks within date range
    query = db.query(DeliveryTask).filter(
        (DeliveryTask.scheduled_start >= start) &
        (DeliveryTask.scheduled_start <= end)
    )
    
    tasks = query.all()
    
    # Convert to FullCalendar format
    events = []
    for task in tasks:
        if not task.scheduled_start:
            continue
        
        bg_color, border_color = get_event_color(task.status)
        
        # Format title
        title = f"{task.customer_name} – {task.item_title}"
        
        # Build extended props
        extended_props = {
            "task_id": task.id,
            "status": task.status.value,
            "customer_name": task.customer_name,
            "customer_phone": task.customer_phone,
            "item_title": task.item_title,
            "sku": task.sku,
            "address": f"{task.delivery_address_line1}, {task.delivery_city}, {task.delivery_state}",
            "notes": task.delivery_notes or "",
            "image_url": task.image_url if task.image_url else None
        }
        
        event = CalendarEvent(
            id=task.id,
            title=title,
            start=task.scheduled_start,
            end=task.scheduled_end or task.scheduled_start,
            backgroundColor=bg_color,
            borderColor=border_color,
            extendedProps=extended_props
        )
        
        events.append(event)
    
    return events


@router.get("/unscheduled", response_model=List[dict])
def get_unscheduled_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get tasks that need scheduling (for external events in calendar)"""
    tasks = db.query(DeliveryTask).filter(
        DeliveryTask.status == TaskStatus.pending,
        DeliveryTask.scheduled_start.is_(None)
    ).order_by(DeliveryTask.created_at.desc()).all()
    
    unscheduled = []
    for task in tasks:
        unscheduled.append({
            "id": task.id,
            "title": f"{task.customer_name} – {task.item_title}",
            "duration": "01:00",  # Default 1 hour duration
            "extendedProps": {
                "task_id": task.id,
                "customer_name": task.customer_name,
                "item_title": task.item_title,
                "sku": task.sku
            }
        })
    
    return unscheduled

