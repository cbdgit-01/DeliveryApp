from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from database import get_db
from models import DeliveryInvite, DeliveryTask, TaskStatus, TaskSource
from schemas import ShopifyWebhookOrder, SMSWebhookIncoming
from utils import (
    verify_shopify_webhook,
    generate_random_token,
    extract_sku_from_shopify_item,
    is_deliverable_item,
    encode_liberty_item_id,
    normalize_phone
)
from notifications import send_delivery_invite_sms, notify_scheduler_customer_responded, notify_scheduler_new_task

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/shopify/orders")
async def shopify_order_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_shopify_hmac_sha256: Optional[str] = Header(None)
):
    """Receive Shopify order webhooks"""
    # Get raw body for HMAC verification
    body = await request.body()
    
    # Verify webhook (skip in development)
    # if x_shopify_hmac_sha256 and not verify_shopify_webhook(body, x_shopify_hmac_sha256):
    #     raise HTTPException(status_code=401, detail="Invalid webhook signature")
    
    # Parse order data
    order_data = await request.json()
    
    # Extract order information
    order_id = str(order_data.get('id'))
    order_number = str(order_data.get('order_number', order_data.get('name', '')))
    
    # Get customer info
    customer = order_data.get('customer', {})
    customer_phone = customer.get('phone') or order_data.get('phone')
    customer_email = customer.get('email') or order_data.get('email')
    
    if not customer_phone:
        return {"status": "skipped", "reason": "No customer phone number"}
    
    # Check line items for deliverable products
    line_items = order_data.get('line_items', [])
    deliverable_skus = []
    
    for item in line_items:
        sku = extract_sku_from_shopify_item(item)
        if sku and is_deliverable_item(sku):
            deliverable_skus.append(sku)
    
    if not deliverable_skus:
        return {"status": "skipped", "reason": "No deliverable items in order"}
    
    # Create delivery invite
    token = generate_random_token()
    invite = DeliveryInvite(
        shopify_order_id=order_id,
        shopify_order_number=order_number,
        customer_phone=normalize_phone(customer_phone),
        customer_email=customer_email,
        sku_list=deliverable_skus,
        token=token
    )
    
    db.add(invite)
    db.commit()
    db.refresh(invite)
    
    # Send SMS invitation
    invite.last_sms_at = datetime.utcnow()
    db.commit()
    send_delivery_invite_sms(invite)
    
    return {
        "status": "success",
        "invite_id": invite.id,
        "token": token
    }


@router.post("/sms/incoming")
async def sms_incoming_webhook(
    webhook_data: SMSWebhookIncoming,
    db: Session = Depends(get_db)
):
    """Handle incoming SMS messages"""
    from_phone = normalize_phone(webhook_data.From)
    body = webhook_data.Body.strip().upper()
    
    # Look up delivery invite by phone
    invite = db.query(DeliveryInvite).filter(
        DeliveryInvite.customer_phone == from_phone,
        DeliveryInvite.status == "sent"
    ).order_by(DeliveryInvite.created_at.desc()).first()
    
    if not invite:
        return {"status": "ignored", "reason": "No pending invite for this number"}
    
    # Check if customer said YES
    if "YES" in body or "Y" == body:
        # Update invite status
        invite.status = "responded_yes"
        db.commit()
        
        # Notify scheduler
        notify_scheduler_customer_responded(invite)
        
        return {
            "status": "success",
            "message": "Customer responded yes",
            "invite_id": invite.id
        }
    
    return {"status": "ignored", "reason": "Not a YES response"}





