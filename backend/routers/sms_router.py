"""
SMS Router - Handles Twilio webhooks for automated SMS conversation flow

Flow:
1. Customer texts keyword (DELIVERY or PICKUP) to your Twilio number
2. System starts guided conversation to collect information
3. Once complete, creates a DeliveryTask or PickupRequest for admin review
4. Sends final message with scheduler's Google Voice number for follow-up
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Form, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from database import get_db
from models import (
    SMSConversation, SMSConversationStatus, SMSRequestType,
    DeliveryTask, TaskSource, TaskStatus,
    PickupRequest, PickupStatus,
    User
)
from schemas import SMSConversationResponse
from config import get_settings
from auth import require_role
import requests

router = APIRouter(prefix="/sms", tags=["sms"])
settings = get_settings()


def search_shopify_orders(search_term: str) -> Optional[dict]:
    """
    Search recent Shopify orders for an item matching the search term.
    Returns the matching item info or None if not found.
    """
    if not settings.shopify_shop_url or not settings.shopify_access_token:
        return None
    
    try:
        headers = {
            "X-Shopify-Access-Token": settings.shopify_access_token,
            "Content-Type": "application/json"
        }
        
        # Get recent orders
        orders_url = f"https://{settings.shopify_shop_url}/admin/api/2024-01/orders.json?limit=50&status=any"
        response = requests.get(orders_url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return None
        
        orders = response.json().get('orders', [])
        search_lower = search_term.lower()
        
        # Search through orders for matching items
        for order in orders:
            for item in order.get('line_items', []):
                title = item.get('title', '').lower()
                sku = item.get('sku', '')
                
                # Skip pickup-instore items
                if sku == 'pickup-instore':
                    continue
                
                # Check if search term matches title (fuzzy match)
                if search_lower in title or any(word in title for word in search_lower.split()):
                    # Found a match!
                    return {
                        'sku': sku,
                        'title': item.get('title', ''),
                        'price': item.get('price', '0'),
                        'order_number': order.get('order_number', ''),
                        'order_id': order.get('id', ''),
                        'order_date': order.get('created_at', '')[:10],
                        'image_url': None  # Could fetch product image if needed
                    }
        
        return None
        
    except Exception as e:
        print(f"Error searching Shopify: {e}")
        return None

# ============================================
# CONVERSATION PROMPTS
# ============================================

PROMPTS = {
    "welcome": "Welcome to Consigned By Design!\n\nReply with:\n- DELIVERY - for delivery of purchased items\n- PICKUP - for us to pick up items you're selling",
    
    "awaiting_name": "Great! Let's get your information.\n\nWhat is your full name?",
    
    "awaiting_phone": "Thanks, {name}!\n\nWhat phone number should we use to contact you about scheduling? (You can reply SAME if it's this number)",
    
    "awaiting_address": "Got it! What is your street address?\n\nExample: 123 Main Street",
    
    "awaiting_city_zip": "Thanks! Now what is your city and ZIP code?\n\nExample: Indianapolis, 46220",
    
    "awaiting_item_name": "What item did you purchase? Please describe it briefly.\n\nExample: Oak dresser, Vintage lamp, etc.",
    
    "item_found": "Found your order!\n\n{item_title}\nSKU: {sku}\nOrder #{order_number}\n\nDo you have stairs at your location?\n\nReply YES or NO",
    
    "item_not_found": "We couldn't find an exact match in recent orders, but no worries - we'll look it up!\n\nDo you have stairs at your location?\n\nReply YES or NO",
    
    "awaiting_stairs": "Last question! Do you have stairs at your location?\n\nReply YES or NO",
    
    "completed_delivery": "Your delivery request has been submitted!\n\nWe'll review it and get back to you soon.\n\nFor scheduling questions, text or call our scheduler:\n{scheduler_phone}\n\nThank you for choosing Consigned By Design!",
    
    "completed_pickup": "Your pickup request has been submitted!\n\nOur team will review it and contact you about scheduling.\n\nFor questions, text or call our scheduler:\n{scheduler_phone}\n\nThank you for choosing Consigned By Design!",
    
    "error": "Sorry, I didn't understand that. Please try again or call us at {scheduler_phone} for assistance.",
    
    "expired": "Your previous session has expired. Reply DELIVERY or PICKUP to start a new request.",
    
    "cancelled": "Your request has been cancelled. Reply DELIVERY or PICKUP to start a new request.",
}

def format_phone(phone: str) -> str:
    """Format phone number for display: (317) 661-1188"""
    digits = ''.join(filter(str.isdigit, phone))
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    return phone


def generate_twiml_response(message: str) -> Response:
    """Generate TwiML response for Twilio"""
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{message}</Message>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


def get_or_create_conversation(phone: str, db: Session) -> SMSConversation:
    """Get active conversation or create new one"""
    # Look for active conversation (not completed/cancelled, within last 24 hours)
    conversation = db.query(SMSConversation).filter(
        SMSConversation.phone_number == phone,
        SMSConversation.status.notin_([
            SMSConversationStatus.completed,
            SMSConversationStatus.cancelled
        ])
    ).order_by(SMSConversation.created_at.desc()).first()
    
    if conversation:
        # Check if conversation is stale (over 24 hours old)
        age = datetime.now(timezone.utc) - conversation.created_at.replace(tzinfo=timezone.utc)
        if age.total_seconds() > 86400:  # 24 hours
            conversation.status = SMSConversationStatus.cancelled
            db.commit()
            conversation = None
    
    if not conversation:
        conversation = SMSConversation(
            phone_number=phone,
            status=SMSConversationStatus.started
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    return conversation


def process_message(conversation: SMSConversation, message: str, media_urls: List[str], db: Session) -> str:
    """Process incoming message and return response"""
    message = message.strip()
    message_upper = message.upper()
    scheduler_phone = format_phone(settings.scheduler_phone) if settings.scheduler_phone else "317-661-1188"
    
    # Update last message timestamp
    conversation.last_message_at = datetime.now(timezone.utc)
    
    # Handle cancel at any point
    if message_upper in ["CANCEL", "STOP", "QUIT"]:
        conversation.status = SMSConversationStatus.cancelled
        db.commit()
        return PROMPTS["cancelled"]
    
    # Handle based on current status
    if conversation.status == SMSConversationStatus.started:
        # Expecting DELIVERY or PICKUP keyword
        if message_upper in ["DELIVERY", "DELIVER"]:
            conversation.request_type = SMSRequestType.delivery
            conversation.status = SMSConversationStatus.awaiting_name
            db.commit()
            return PROMPTS["awaiting_name"]
        elif message_upper in ["PICKUP", "PICK UP", "PICK-UP"]:
            conversation.request_type = SMSRequestType.pickup
            conversation.status = SMSConversationStatus.awaiting_name
            db.commit()
            return PROMPTS["awaiting_name"]
        else:
            return PROMPTS["welcome"]
    
    elif conversation.status == SMSConversationStatus.awaiting_name:
        if len(message) < 2:
            return "Please enter your full name (first and last)."
        conversation.customer_name = message.title()  # Capitalize properly
        conversation.status = SMSConversationStatus.awaiting_phone
        db.commit()
        return PROMPTS["awaiting_phone"].format(name=conversation.customer_name.split()[0])
    
    elif conversation.status == SMSConversationStatus.awaiting_phone:
        if message_upper == "SAME":
            conversation.callback_phone = conversation.phone_number
        else:
            # Extract digits from phone
            digits = ''.join(filter(str.isdigit, message))
            if len(digits) < 10:
                return "Please enter a valid 10-digit phone number, or reply SAME to use this number."
            conversation.callback_phone = digits[-10:]  # Take last 10 digits
        conversation.status = SMSConversationStatus.awaiting_address
        db.commit()
        return PROMPTS["awaiting_address"]
    
    elif conversation.status == SMSConversationStatus.awaiting_address:
        if len(message) < 5:
            return "Please enter your full street address."
        conversation.address_line1 = message
        conversation.status = SMSConversationStatus.awaiting_city_zip
        db.commit()
        return PROMPTS["awaiting_city_zip"]
    
    elif conversation.status == SMSConversationStatus.awaiting_city_zip:
        # Parse city and zip
        # Try to extract zip code (5 digits at end)
        import re
        zip_match = re.search(r'(\d{5})(?:-\d{4})?$', message)
        if zip_match:
            zip_code = zip_match.group(1)
            city = message[:zip_match.start()].strip().rstrip(',').strip()
        else:
            # Just take everything as city, ask for zip
            parts = message.split(',')
            if len(parts) >= 2:
                city = parts[0].strip()
                # Try to get zip from second part
                zip_code = ''.join(filter(str.isdigit, parts[-1]))[:5]
            else:
                return "Please enter your city and ZIP code (e.g., Indianapolis, 46220)"
        
        if not zip_code or len(zip_code) != 5:
            return "Please include a valid 5-digit ZIP code (e.g., Indianapolis, 46220)"
        
        conversation.city = city.title()
        conversation.zip_code = zip_code
        conversation.state = "IN"  # Default to Indiana
        
        # For delivery, ask what they bought; for pickup, go straight to stairs
        if conversation.request_type == SMSRequestType.delivery:
            conversation.status = SMSConversationStatus.awaiting_items
            db.commit()
            return PROMPTS["awaiting_item_name"]
        else:
            # Pickups don't need item lookup
            conversation.status = SMSConversationStatus.awaiting_notes
            db.commit()
            return PROMPTS["awaiting_stairs"]
    
    elif conversation.status == SMSConversationStatus.awaiting_items:
        # Customer told us what they bought - search Shopify
        if len(message) < 2:
            return "Please describe the item you purchased (e.g., oak dresser, vintage lamp)."
        
        # Search Shopify for the item
        found_item = search_shopify_orders(message)
        
        if found_item:
            # Store the found item info
            conversation.item_description = f"{found_item['title']} | SKU: {found_item['sku']} | Order #{found_item['order_number']}"
            conversation.status = SMSConversationStatus.awaiting_notes
            db.commit()
            return PROMPTS["item_found"].format(
                item_title=found_item['title'],
                sku=found_item['sku'],
                order_number=found_item['order_number']
            )
        else:
            # Couldn't find it - store what they typed and continue
            conversation.item_description = f"Customer described: {message} (not found in Shopify)"
            conversation.status = SMSConversationStatus.awaiting_notes
            db.commit()
            return PROMPTS["item_not_found"]
    
    elif conversation.status == SMSConversationStatus.awaiting_notes:
        # Handle stairs question (YES/NO)
        if message_upper in ["YES", "Y", "YEP", "YUP", "YEAH"]:
            conversation.notes = "Has stairs: YES"
        elif message_upper in ["NO", "N", "NOPE", "NAH"]:
            conversation.notes = "Has stairs: NO"
        else:
            return "Please reply YES or NO - do you have stairs at your location?"
        
        # Create the request
        if conversation.request_type == SMSRequestType.delivery:
            task = create_delivery_task(conversation, db)
            conversation.created_task_id = task.id
            conversation.status = SMSConversationStatus.completed
            db.commit()
            return PROMPTS["completed_delivery"].format(scheduler_phone=scheduler_phone)
        else:
            pickup = create_pickup_request(conversation, db)
            conversation.created_pickup_id = pickup.id
            conversation.status = SMSConversationStatus.completed
            db.commit()
            return PROMPTS["completed_pickup"].format(scheduler_phone=scheduler_phone)
    
    else:
        # Unknown state, restart
        conversation.status = SMSConversationStatus.started
        db.commit()
        return PROMPTS["welcome"]


def create_delivery_task(conversation: SMSConversation, db: Session) -> DeliveryTask:
    """Create a DeliveryTask from completed SMS conversation"""
    # Parse item info from conversation (could be from Shopify match or customer description)
    item_desc = conversation.item_description or ""
    
    # Try to extract SKU if we found it in Shopify
    sku = "SMS-REQUEST"
    item_title = f"SMS Request from {conversation.customer_name}"
    
    if "SKU:" in item_desc:
        # We found the item in Shopify
        parts = item_desc.split(" | ")
        if len(parts) >= 2:
            item_title = parts[0]  # The actual item title
            sku_part = parts[1] if len(parts) > 1 else ""
            if "SKU:" in sku_part:
                sku = sku_part.replace("SKU:", "").strip()
    
    task = DeliveryTask(
        source=TaskSource.in_store,
        status=TaskStatus.pending,
        sku=sku,
        liberty_item_id=sku if sku != "SMS-REQUEST" else f"SMS-{conversation.id}",
        item_title=item_title,
        item_description=item_desc,
        image_url=None,
        customer_name=conversation.customer_name,
        customer_phone=format_phone_for_storage(conversation.callback_phone or conversation.phone_number),
        delivery_address_line1=conversation.address_line1,
        delivery_city=conversation.city,
        delivery_state=conversation.state or "IN",
        delivery_zip=conversation.zip_code,
        delivery_notes=conversation.notes
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def create_pickup_request(conversation: SMSConversation, db: Session) -> PickupRequest:
    """Create a PickupRequest from completed SMS conversation"""
    pickup = PickupRequest(
        status=PickupStatus.pending_review,
        customer_name=conversation.customer_name,
        customer_phone=format_phone_for_storage(conversation.callback_phone or conversation.phone_number),
        pickup_address_line1=conversation.address_line1,
        pickup_city=conversation.city,
        pickup_state=conversation.state or "IN",
        pickup_zip=conversation.zip_code,
        item_description=f"SMS Pickup Request from {conversation.customer_name}",
        item_count=1,  # Default to 1
        item_photos=conversation.photo_urls,
        pickup_notes=conversation.notes
    )
    db.add(pickup)
    db.commit()
    db.refresh(pickup)
    return pickup


def format_phone_for_storage(phone: str) -> str:
    """Format phone number with dashes for storage: 317-661-1188"""
    digits = ''.join(filter(str.isdigit, phone))
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"{digits[1:4]}-{digits[4:7]}-{digits[7:]}"
    return phone


# ============================================
# WEBHOOK ENDPOINTS
# ============================================

@router.post("/webhook")
async def twilio_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Twilio webhook endpoint for incoming SMS/MMS
    
    Twilio sends data as form-encoded, not JSON
    """
    form_data = await request.form()
    
    # Extract key fields
    from_phone = form_data.get("From", "")
    body = form_data.get("Body", "")
    num_media = int(form_data.get("NumMedia", 0))
    
    # Collect media URLs if any
    media_urls = []
    for i in range(num_media):
        url = form_data.get(f"MediaUrl{i}")
        if url:
            media_urls.append(url)
    
    # Normalize phone number (remove +1 prefix if present)
    if from_phone.startswith("+1"):
        from_phone = from_phone[2:]
    elif from_phone.startswith("+"):
        from_phone = from_phone[1:]
    
    # Get or create conversation
    conversation = get_or_create_conversation(from_phone, db)
    
    # Process message and get response
    response_text = process_message(conversation, body, media_urls, db)
    
    # Return TwiML response
    return generate_twiml_response(response_text)


# ============================================
# ADMIN API ENDPOINTS
# ============================================

@router.get("/conversations", response_model=List[SMSConversationResponse])
def list_conversations(
    status: Optional[SMSConversationStatus] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    """Get all SMS conversations for admin review"""
    query = db.query(SMSConversation)
    if status:
        query = query.filter(SMSConversation.status == status)
    return query.order_by(SMSConversation.created_at.desc()).all()


@router.get("/conversations/{conversation_id}", response_model=SMSConversationResponse)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    """Get a specific SMS conversation"""
    conversation = db.query(SMSConversation).filter(SMSConversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    """Delete an SMS conversation"""
    conversation = db.query(SMSConversation).filter(SMSConversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conversation)
    db.commit()
    return {"message": "Conversation deleted"}


@router.get("/stats")
def get_sms_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin"]))
):
    """Get SMS conversation statistics"""
    total = db.query(SMSConversation).count()
    in_progress = db.query(SMSConversation).filter(
        SMSConversation.status.notin_([
            SMSConversationStatus.completed,
            SMSConversationStatus.cancelled
        ])
    ).count()
    completed = db.query(SMSConversation).filter(
        SMSConversation.status == SMSConversationStatus.completed
    ).count()
    
    return {
        "total": total,
        "in_progress": in_progress,
        "completed": completed
    }

