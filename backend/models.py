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


class InviteStatus(str, enum.Enum):
    sent = "sent"
    responded_yes = "responded_yes"
    expired = "expired"


class DeliveryTask(Base):
    __tablename__ = "delivery_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    source = Column(Enum(TaskSource), nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.pending, nullable=False)
    
    # Shopify fields
    shopify_order_id = Column(String, nullable=True, index=True)
    shopify_order_number = Column(String, nullable=True)
    
    # Product information
    sku = Column(String, nullable=False, index=True)
    liberty_item_id = Column(String, nullable=False)
    item_title = Column(String, nullable=False)
    item_description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    
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





