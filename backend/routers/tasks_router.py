from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import case, func
from typing import List, Optional
from datetime import datetime, date, timezone
from database import get_db
from models import User, DeliveryTask, TaskStatus
from schemas import DeliveryTaskCreate, DeliveryTaskResponse, DeliveryTaskUpdate
from auth import get_current_user, require_role
from notifications import notify_scheduler_new_task, notify_customer_delivery_scheduled

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("", response_model=DeliveryTaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    task_data: DeliveryTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["staff", "scheduler", "admin"]))
):
    """Create a new delivery task from staff form"""
    # Create task
    db_task = DeliveryTask(**task_data.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Notify scheduler
    notify_scheduler_new_task(db_task)
    
    return db_task


@router.get("", response_model=List[DeliveryTaskResponse])
def list_tasks(
    status: Optional[TaskStatus] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all delivery tasks with optional filters"""
    query = db.query(DeliveryTask)
    
    # Filter by status
    if status:
        query = query.filter(DeliveryTask.status == status)
    
    # Search by name, SKU, or order number
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (DeliveryTask.customer_name.ilike(search_filter)) |
            (DeliveryTask.sku.ilike(search_filter)) |
            (DeliveryTask.shopify_order_number.ilike(search_filter)) |
            (DeliveryTask.item_title.ilike(search_filter))
        )
    
    # Filter by date range
    if date_from:
        query = query.filter(DeliveryTask.created_at >= date_from)
    if date_to:
        query = query.filter(DeliveryTask.created_at <= date_to)
    
    # Order by: today's scheduled first, then future dates ascending, then past, then unscheduled
    today = date.today()
    query = query.order_by(
        case(
            (func.date(DeliveryTask.scheduled_start) == today, 0),  # Today first
            (DeliveryTask.scheduled_start > datetime.now(), 1),      # Future second
            (DeliveryTask.scheduled_start.is_(None), 3),             # Unscheduled last
            else_=2                                                   # Past third
        ),
        case(
            (DeliveryTask.scheduled_start > datetime.now(), DeliveryTask.scheduled_start),  # Future: ascending
            else_=DeliveryTask.scheduled_start.desc()  # Past: descending (most recent first)
        )
    )
    
    tasks = query.offset(skip).limit(limit).all()
    return tasks


@router.get("/{task_id}", response_model=DeliveryTaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get delivery task details"""
    task = db.query(DeliveryTask).filter(DeliveryTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=DeliveryTaskResponse)
def update_task(
    task_id: int,
    task_update: DeliveryTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["scheduler", "admin"]))
):
    """Update task (schedule, assign, mark delivered)"""
    task = db.query(DeliveryTask).filter(DeliveryTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Track if scheduling changed
    was_scheduled = task.scheduled_start is not None
    
    # Update fields
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
    
    # If scheduling changed and now has a scheduled time, update status
    if not was_scheduled and task.scheduled_start:
        task.status = TaskStatus.scheduled
        # Notify customer
        notify_customer_delivery_scheduled(task)
    
    # If marked as delivered, set delivered_at timestamp
    if task_update.status == TaskStatus.delivered and task.delivered_at is None:
        task.delivered_at = datetime.now(timezone.utc)

    # If marked as paid, set paid_at timestamp
    if task_update.status == TaskStatus.paid and task.paid_at is None:
        task.paid_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(task)
    
    return task


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["scheduler", "admin"]))
):
    """Delete delivery task"""
    task = db.query(DeliveryTask).filter(DeliveryTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    
    return {"success": True}





