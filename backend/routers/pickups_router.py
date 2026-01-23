from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import case, func
from typing import List, Optional
from datetime import datetime, date, timezone

from database import get_db
from models import PickupRequest, PickupStatus, User
from schemas import PickupRequestCreate, PickupRequestUpdate, PickupRequestResponse
from auth import get_current_user, require_role

router = APIRouter(prefix="/api/pickups", tags=["pickups"])


@router.get("", response_model=List[PickupRequestResponse])
def get_pickups(
    status: Optional[PickupStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all pickup requests, optionally filtered by status"""
    query = db.query(PickupRequest)
    
    if status:
        query = query.filter(PickupRequest.status == status)
    
    # Order by: today's scheduled first, then future dates ascending, then past, then unscheduled
    today = date.today()
    query = query.order_by(
        case(
            (func.date(PickupRequest.scheduled_start) == today, 0),  # Today first
            (PickupRequest.scheduled_start > datetime.now(), 1),      # Future second
            (PickupRequest.scheduled_start.is_(None), 3),             # Unscheduled last
            else_=2                                                    # Past third
        ),
        case(
            (PickupRequest.scheduled_start > datetime.now(), PickupRequest.scheduled_start),  # Future: ascending
            else_=PickupRequest.scheduled_start.desc()  # Past: descending (most recent first)
        )
    )
    
    return query.offset(skip).limit(limit).all()


@router.get("/stats")
def get_pickup_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get pickup statistics by status"""
    stats = {}
    for status in PickupStatus:
        count = db.query(PickupRequest).filter(PickupRequest.status == status).count()
        stats[status.value] = count
    return stats


@router.get("/{pickup_id}", response_model=PickupRequestResponse)
def get_pickup(
    pickup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific pickup request by ID"""
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    return pickup


@router.post("", response_model=PickupRequestResponse)
def create_pickup(
    pickup_data: PickupRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new pickup request"""
    pickup = PickupRequest(**pickup_data.dict())
    db.add(pickup)
    db.commit()
    db.refresh(pickup)
    return pickup


@router.patch("/{pickup_id}", response_model=PickupRequestResponse)
def update_pickup(
    pickup_id: int,
    pickup_update: PickupRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["scheduler", "admin"]))
):
    """Update a pickup request (admin/scheduler only)"""
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    
    # Store old status to detect changes
    old_status = pickup.status
    
    # Update fields
    update_data = pickup_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(pickup, field, value)
    
    # If status changed to completed, set completed_at timestamp
    if old_status != PickupStatus.completed and pickup.status == PickupStatus.completed:
        pickup.completed_at = datetime.now(timezone.utc)
    
    # If scheduling info added and status is approved, update to scheduled
    if pickup.scheduled_start and pickup.status == PickupStatus.approved:
        pickup.status = PickupStatus.scheduled
    
    db.commit()
    db.refresh(pickup)
    return pickup


@router.delete("/{pickup_id}")
def delete_pickup(
    pickup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    """Delete a pickup request (admin only)"""
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    
    db.delete(pickup)
    db.commit()
    return {"message": "Pickup request deleted"}


@router.post("/{pickup_id}/approve", response_model=PickupRequestResponse)
def approve_pickup(
    pickup_id: int,
    staff_notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["scheduler", "admin"]))
):
    """Approve a pickup request"""
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    
    if pickup.status != PickupStatus.pending_review:
        raise HTTPException(status_code=400, detail="Can only approve pending requests")
    
    pickup.status = PickupStatus.approved
    if staff_notes:
        pickup.staff_notes = staff_notes
    
    db.commit()
    db.refresh(pickup)
    return pickup


@router.post("/{pickup_id}/decline", response_model=PickupRequestResponse)
def decline_pickup(
    pickup_id: int,
    reason: str = Query(..., description="Reason for declining"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["scheduler", "admin"]))
):
    """Decline a pickup request"""
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    
    if pickup.status not in [PickupStatus.pending_review, PickupStatus.approved]:
        raise HTTPException(status_code=400, detail="Cannot decline this request")
    
    pickup.status = PickupStatus.declined
    pickup.decline_reason = reason
    
    db.commit()
    db.refresh(pickup)
    return pickup


@router.post("/{pickup_id}/complete", response_model=PickupRequestResponse)
def complete_pickup(
    pickup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["scheduler", "admin"]))
):
    """Mark a pickup as completed"""
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail="Pickup request not found")
    
    if pickup.status != PickupStatus.scheduled:
        raise HTTPException(status_code=400, detail="Can only complete scheduled pickups")
    
    pickup.status = PickupStatus.completed
    pickup.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(pickup)
    return pickup

