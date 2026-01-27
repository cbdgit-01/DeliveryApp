from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, JSON
from sqlalchemy.sql import func
from database import Base
import enum


class TaskSource(str, enum.Enum):
    shopify_online = "shopify_online"
    in_store = "in_store"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    scheduled = "scheduled"
    delivered = "delivered"          # Delivered but awaiting payment (yellow)
    paid = "paid"                    # Payment received (green)
    cancelled = "cancelled"


class PickupStatus(str, enum.Enum):
    pending = "pending"                 # New pickup, not yet scheduled
    scheduled = "scheduled"             # Pickup scheduled
    completed = "completed"             # Pickup completed


class InviteStatus(str, enum.Enum):
    sent = "sent"
    responded_yes = "responded_yes"
    expired = "expired"


class SMSConversationStatus(str, enum.Enum):
    started = "started"                 # Just sent keyword
    awaiting_type = "awaiting_type"     # Waiting for DELIVERY or PICKUP
    awaiting_name = "awaiting_name"     # Waiting for customer name
    awaiting_phone = "awaiting_phone"   # Waiting for callback phone
    awaiting_address = "awaiting_address"  # Waiting for address
    awaiting_city_zip = "awaiting_city_zip"  # Waiting for city and zip
    awaiting_items = "awaiting_items"   # Waiting for item description
    awaiting_photos = "awaiting_photos" # Waiting for photos (optional)
    awaiting_notes = "awaiting_notes"   # Waiting for additional notes
    completed = "completed"             # All info collected, request created
    cancelled = "cancelled"             # Customer cancelled


class SMSRequestType(str, enum.Enum):
    delivery = "delivery"
    pickup = "pickup"


class DeliveryTask(Base):
    __tablename__ = "delivery_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    source = Column(Enum(TaskSource), nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.pending, nullable=False)
    
    # Shopify fields
    shopify_order_id = Column(String, nullable=True, index=True)
    shopify_order_number = Column(String, nullable=True)
    
    # Product information (primary item for backwards compatibility)
    sku = Column(String, nullable=False, index=True)
    liberty_item_id = Column(String, nullable=False)
    item_title = Column(String, nullable=False)
    item_description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    
    # Multiple items support - JSON array of {sku, item_id, title, description, image_url}
    items = Column(JSON, nullable=True)
    
    # Customer information
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False, index=True)
    customer_email = Column(String, nullable=True)
    
    # Delivery address
    delivery_address_line1 = Column(String, nullable=False)
    delivery_address_line2 = Column(String, nullable=True)
    delivery_city = Column(String, nullable=False)
    delivery_state = Column(String, nullable=False)
    delivery_zip = Column(String, nullable=False)
    delivery_notes = Column(Text, nullable=True)
    
    # Scheduling
    scheduled_start = Column(DateTime, nullable=True)
    scheduled_end = Column(DateTime, nullable=True)
    assigned_to = Column(String, nullable=True)
    
    # Completion timestamps
    delivered_at = Column(DateTime, nullable=True)  # When item was actually delivered
    paid_at = Column(DateTime, nullable=True)       # When payment was received

    # E-signature
    signature_url = Column(String, nullable=True)   # URL to customer signature image

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class DeliveryInvite(Base):
    __tablename__ = "delivery_invites"
    
    id = Column(Integer, primary_key=True, index=True)
    shopify_order_id = Column(String, nullable=False, index=True)
    shopify_order_number = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False, index=True)
    customer_email = Column(String, nullable=True)
    sku_list = Column(JSON, nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    status = Column(Enum(InviteStatus), default=InviteStatus.sent, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_sms_at = Column(DateTime, nullable=True)


class PickupRequest(Base):
    __tablename__ = "pickup_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    status = Column(Enum(PickupStatus), default=PickupStatus.pending, nullable=False)
    
    # Customer information
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False, index=True)
    customer_email = Column(String, nullable=True)
    
    # Pickup address
    pickup_address_line1 = Column(String, nullable=False)
    pickup_address_line2 = Column(String, nullable=True)
    pickup_city = Column(String, nullable=False)
    pickup_state = Column(String, nullable=False)
    pickup_zip = Column(String, nullable=False)
    
    # Item information
    item_description = Column(Text, nullable=False)  # What they want picked up
    item_count = Column(Integer, default=1, nullable=False)  # Estimated number of items
    item_photos = Column(JSON, nullable=True)  # List of photo URLs if available
    
    # Notes
    pickup_notes = Column(Text, nullable=True)  # Special instructions
    staff_notes = Column(Text, nullable=True)   # Internal notes from staff
    decline_reason = Column(Text, nullable=True)  # Reason if declined
    
    # Scheduling
    scheduled_start = Column(DateTime, nullable=True)
    scheduled_end = Column(DateTime, nullable=True)
    assigned_to = Column(String, nullable=True)
    
    # Completion
    completed_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, default="staff", nullable=False)  # staff, scheduler, admin
    is_active = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class SMSConversation(Base):
    """Tracks SMS conversation state for incoming customer requests"""
    __tablename__ = "sms_conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, nullable=False, index=True)  # Customer's phone (From field)
    status = Column(Enum(SMSConversationStatus), default=SMSConversationStatus.started, nullable=False)
    request_type = Column(Enum(SMSRequestType), nullable=True)  # delivery or pickup
    
    # Collected data (populated as conversation progresses)
    customer_name = Column(String, nullable=True)
    callback_phone = Column(String, nullable=True)  # May be different from SMS phone
    address_line1 = Column(String, nullable=True)
    address_line2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, default="IN", nullable=True)  # Default to Indiana
    zip_code = Column(String, nullable=True)
    item_description = Column(Text, nullable=True)
    photo_urls = Column(JSON, nullable=True)  # List of MMS photo URLs
    notes = Column(Text, nullable=True)
    
    # Link to created request (once completed)
    created_task_id = Column(Integer, nullable=True)  # Links to DeliveryTask if delivery
    created_pickup_id = Column(Integer, nullable=True)  # Links to PickupRequest if pickup
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    last_message_at = Column(DateTime, nullable=True)  # Last time customer sent a message





