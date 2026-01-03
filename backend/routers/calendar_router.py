from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from database import get_db
from models import User, DeliveryTask, TaskStatus, PickupRequest, PickupStatus
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


def get_pickup_event_color(status: PickupStatus) -> tuple:
    """Get color for pickup calendar event based on status"""
    colors = {
        PickupStatus.pending_review: ("#a78bfa", "#8b5cf6"),  # Purple - pending review
        PickupStatus.approved: ("#a78bfa", "#8b5cf6"),        # Purple - approved
        PickupStatus.scheduled: ("#a78bfa", "#8b5cf6"),       # Purple - scheduled
        PickupStatus.completed: ("#4ade80", "#22c55e"),       # Green - completed
        PickupStatus.declined: ("#64748b", "#475569"),        # Grey - declined
    }
    return colors.get(status, ("#a78bfa", "#8b5cf6"))  # Purple default


@router.get("", response_model=List[dict])
def get_calendar_events(
    start: datetime = Query(..., description="Start date for calendar range"),
    end: datetime = Query(..., description="End date for calendar range"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get calendar events in FullCalendar format (deliveries and pickups)"""
    events = []
    
    # Query delivery tasks within date range
    delivery_tasks = db.query(DeliveryTask).filter(
        (DeliveryTask.scheduled_start >= start) &
        (DeliveryTask.scheduled_start <= end)
    ).all()
    
    # Convert deliveries to FullCalendar format
    for task in delivery_tasks:
        if not task.scheduled_start:
            continue
        
        bg_color, border_color = get_event_color(task.status)
        
        # Format title with type indicator
        title = f"🚚 {task.customer_name} – {task.item_title}"
        
        # Build extended props
        extended_props = {
            "type": "delivery",
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
        
        events.append({
            "id": f"delivery-{task.id}",
            "title": title,
            "start": task.scheduled_start.isoformat(),
            "end": (task.scheduled_end or task.scheduled_start).isoformat(),
            "backgroundColor": bg_color,
            "borderColor": border_color,
            "extendedProps": extended_props
        })
    
    # Query pickup requests within date range
    pickup_requests = db.query(PickupRequest).filter(
        (PickupRequest.scheduled_start >= start) &
        (PickupRequest.scheduled_start <= end)
    ).all()
    
    # Convert pickups to FullCalendar format
    for pickup in pickup_requests:
        if not pickup.scheduled_start:
            continue
        
        bg_color, border_color = get_pickup_event_color(pickup.status)
        
        # Format title with type indicator
        title = f"📥 {pickup.customer_name} – Pickup"
        
        # Build extended props
        extended_props = {
            "type": "pickup",
            "pickup_id": pickup.id,
            "status": pickup.status.value,
            "customer_name": pickup.customer_name,
            "customer_phone": pickup.customer_phone,
            "item_description": pickup.item_description[:50] + "..." if len(pickup.item_description) > 50 else pickup.item_description,
            "item_count": pickup.item_count,
            "address": f"{pickup.pickup_address_line1}, {pickup.pickup_city}, {pickup.pickup_state}",
            "notes": pickup.pickup_notes or "",
        }
        
        events.append({
            "id": f"pickup-{pickup.id}",
            "title": title,
            "start": pickup.scheduled_start.isoformat(),
            "end": (pickup.scheduled_end or pickup.scheduled_start).isoformat(),
            "backgroundColor": bg_color,
            "borderColor": border_color,
            "extendedProps": extended_props
        })
    
    return events


@router.get("/unscheduled", response_model=List[dict])
def get_unscheduled_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get delivery tasks that need scheduling (for external events in calendar)"""
    tasks = db.query(DeliveryTask).filter(
        DeliveryTask.status == TaskStatus.pending,
        DeliveryTask.scheduled_start.is_(None)
    ).order_by(DeliveryTask.created_at.desc()).all()
    
    unscheduled = []
    for task in tasks:
        unscheduled.append({
            "id": f"delivery-{task.id}",
            "title": f"{task.customer_name} – {task.item_title}",
            "duration": "01:00",  # Default 1 hour duration
            "extendedProps": {
                "type": "delivery",
                "task_id": task.id,
                "customer_name": task.customer_name,
                "item_title": task.item_title,
                "sku": task.sku
            }
        })
    
    return unscheduled


@router.get("/unscheduled-pickups", response_model=List[dict])
def get_unscheduled_pickups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get pickup requests that need scheduling (approved but not yet scheduled)"""
    pickups = db.query(PickupRequest).filter(
        PickupRequest.status == PickupStatus.approved,
        PickupRequest.scheduled_start.is_(None)
    ).order_by(PickupRequest.created_at.desc()).all()
    
    unscheduled = []
    for pickup in pickups:
        unscheduled.append({
            "id": f"pickup-{pickup.id}",
            "title": f"{pickup.customer_name} – Pickup ({pickup.item_count} items)",
            "duration": "01:00",  # Default 1 hour duration
            "extendedProps": {
                "type": "pickup",
                "pickup_id": pickup.id,
                "customer_name": pickup.customer_name,
                "item_description": pickup.item_description[:30] + "..." if len(pickup.item_description) > 30 else pickup.item_description,
                "item_count": pickup.item_count
            }
        })
    
    return unscheduled

