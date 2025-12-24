from datetime import datetime
from utils import send_sms, format_address, normalize_phone
from config import get_settings

settings = get_settings()


def notify_scheduler_new_task(task):
    """Send SMS to scheduler when new delivery task is created"""
    scheduler_phone = normalize_phone(settings.scheduler_phone)
    task_url = f"{settings.frontend_url}/tasks/{task.id}"
    
    message = (
        f"New Delivery Request:\n"
        f"{task.customer_name} – {task.item_title}\n"
        f"Tap to schedule: {task_url}"
    )
    
    return send_sms(scheduler_phone, message)


def notify_customer_delivery_scheduled(task):
    """Send SMS to customer when delivery is scheduled"""
    customer_phone = normalize_phone(task.customer_phone)
    
    if not task.scheduled_start:
        return False
    
    date_str = task.scheduled_start.strftime("%A, %B %d")
    time_start = task.scheduled_start.strftime("%I:%M %p")
    time_end = task.scheduled_end.strftime("%I:%M %p") if task.scheduled_end else "TBD"
    
    message = (
        f"Your delivery has been scheduled!\n"
        f"Date: {date_str}\n"
        f"Time: {time_start} - {time_end}\n"
        f"Item: {task.item_title}"
    )
    
    return send_sms(customer_phone, message)


def notify_customer_delivery_confirmed(task):
    """Send SMS to customer confirming delivery"""
    customer_phone = normalize_phone(task.customer_phone)
    
    if not task.scheduled_start:
        return False
    
    date_str = task.scheduled_start.strftime("%A, %B %d")
    
    message = (
        f"Your delivery is confirmed for {date_str}.\n"
        f"We'll notify you when the driver is on the way!"
    )
    
    return send_sms(customer_phone, message)


def send_delivery_invite_sms(invite):
    """Send SMS invitation to customer for delivery scheduling"""
    customer_phone = normalize_phone(invite.customer_phone)
    schedule_url = f"{settings.backend_url}/schedule/{invite.token}"
    
    message = (
        f"Thanks for your order #{invite.shopify_order_number}!\n"
        f"Reply YES or click to schedule delivery:\n"
        f"{schedule_url}"
    )
    
    return send_sms(customer_phone, message)


def notify_scheduler_customer_responded(invite):
    """Notify scheduler when customer responds to delivery invite"""
    scheduler_phone = normalize_phone(settings.scheduler_phone)
    
    message = (
        f"Customer accepted delivery invitation!\n"
        f"Order #{invite.shopify_order_number}\n"
        f"Phone: {invite.customer_phone}"
    )
    
    return send_sms(scheduler_phone, message)





