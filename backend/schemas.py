from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from models import TaskSource, TaskStatus, InviteStatus


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


# DeliveryTask schemas
class DeliveryTaskBase(BaseModel):
    source: TaskSource
    sku: str
    liberty_item_id: str
    item_title: str
    item_description: Optional[str] = None
    image_url: Optional[str] = None
    customer_name: str
    customer_phone: str
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


class DeliveryTaskResponse(DeliveryTaskBase):
    id: int
    status: TaskStatus
    shopify_order_id: Optional[str] = None
    shopify_order_number: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    assigned_to: Optional[str] = None
    delivered_at: Optional[datetime] = None    # When actually delivered
    paid_at: Optional[datetime] = None         # When payment received
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





