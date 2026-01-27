from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from models import TaskSource, TaskStatus, InviteStatus, PickupStatus, SMSConversationStatus, SMSRequestType


# User schemas
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: str = "staff"


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# Item schema for multi-item deliveries
class DeliveryItem(BaseModel):
    sku: str
    item_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None


# DeliveryTask schemas
class DeliveryTaskBase(BaseModel):
    source: TaskSource
    sku: str
    liberty_item_id: str
    item_title: str
    item_description: Optional[str] = None
    image_url: Optional[str] = None
    items: Optional[List[DeliveryItem]] = None  # Multiple items support
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    delivery_address_line1: str
    delivery_address_line2: Optional[str] = None
    delivery_city: str
    delivery_state: str
    delivery_zip: str
    delivery_notes: Optional[str] = None


class DeliveryTaskCreate(DeliveryTaskBase):
    shopify_order_id: Optional[str] = None
    shopify_order_number: Optional[str] = None


class DeliveryTaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    assigned_to: Optional[str] = None
    delivery_notes: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    delivery_address_line1: Optional[str] = None
    delivery_address_line2: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    delivery_zip: Optional[str] = None
    signature_url: Optional[str] = None


class DeliveryTaskResponse(DeliveryTaskBase):
    id: int
    status: TaskStatus
    shopify_order_id: Optional[str] = None
    shopify_order_number: Optional[str] = None
    items: Optional[List[DeliveryItem]] = None  # Multiple items
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    assigned_to: Optional[str] = None
    delivered_at: Optional[datetime] = None    # When actually delivered
    paid_at: Optional[datetime] = None         # When payment received
    signature_url: Optional[str] = None        # E-signature image URL
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Calendar Event schema
class CalendarEvent(BaseModel):
    id: int
    title: str
    start: datetime
    end: datetime
    backgroundColor: Optional[str] = None
    borderColor: Optional[str] = None
    extendedProps: dict


# DeliveryInvite schemas
class DeliveryInviteCreate(BaseModel):
    shopify_order_id: str
    shopify_order_number: str
    customer_phone: str
    customer_email: Optional[str] = None
    sku_list: List[str]


class DeliveryInviteResponse(BaseModel):
    id: int
    shopify_order_id: str
    shopify_order_number: str
    customer_phone: str
    customer_email: Optional[str] = None
    sku_list: List[str]
    token: str
    status: InviteStatus
    created_at: datetime
    last_sms_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Webhook schemas
class ShopifyWebhookOrder(BaseModel):
    id: int
    order_number: int
    email: Optional[str] = None
    phone: Optional[str] = None
    customer: Optional[dict] = None
    shipping_address: Optional[dict] = None
    line_items: List[dict]


class SMSWebhookIncoming(BaseModel):
    From: str
    Body: str
    MessageSid: Optional[str] = None


# Schedule form schema
class ScheduleFormSubmit(BaseModel):
    preferred_date: Optional[str] = None
    notes: Optional[str] = None


# PickupRequest schemas
class PickupRequestBase(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    pickup_address_line1: str
    pickup_address_line2: Optional[str] = None
    pickup_city: str
    pickup_state: str
    pickup_zip: str
    item_description: str
    item_count: int = 1
    item_photos: Optional[List[str]] = None
    pickup_notes: Optional[str] = None


class PickupRequestCreate(PickupRequestBase):
    pass


class PickupRequestUpdate(BaseModel):
    status: Optional[PickupStatus] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    pickup_address_line1: Optional[str] = None
    pickup_address_line2: Optional[str] = None
    pickup_city: Optional[str] = None
    pickup_state: Optional[str] = None
    pickup_zip: Optional[str] = None
    item_description: Optional[str] = None
    item_count: Optional[int] = None
    item_photos: Optional[List[str]] = None
    pickup_notes: Optional[str] = None
    staff_notes: Optional[str] = None
    decline_reason: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    assigned_to: Optional[str] = None


class PickupRequestResponse(PickupRequestBase):
    id: int
    status: PickupStatus
    staff_notes: Optional[str] = None
    decline_reason: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    assigned_to: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# SMS Conversation schemas
class SMSConversationResponse(BaseModel):
    id: int
    phone_number: str
    status: SMSConversationStatus
    request_type: Optional[SMSRequestType] = None
    customer_name: Optional[str] = None
    callback_phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    item_description: Optional[str] = None
    photo_urls: Optional[List[str]] = None
    notes: Optional[str] = None
    created_task_id: Optional[int] = None
    created_pickup_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    last_message_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TwilioWebhookPayload(BaseModel):
    """Incoming Twilio SMS/MMS webhook payload"""
    MessageSid: str
    AccountSid: str
    From: str  # Customer phone number
    To: str    # Your Twilio number
    Body: str  # Message text
    NumMedia: Optional[str] = "0"  # Number of media attachments
    # Media URLs (populated if NumMedia > 0)
    MediaUrl0: Optional[str] = None
    MediaUrl1: Optional[str] = None
    MediaUrl2: Optional[str] = None
    MediaContentType0: Optional[str] = None
    MediaContentType1: Optional[str] = None
    MediaContentType2: Optional[str] = None





