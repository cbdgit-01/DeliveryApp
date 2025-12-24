import secrets
import string
import hmac
import hashlib
from typing import Optional
from twilio.rest import Client
from config import get_settings

settings = get_settings()


def generate_random_token(length: int = 8) -> str:
    """Generate a random alphanumeric token"""
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def verify_shopify_webhook(data: bytes, hmac_header: str) -> bool:
    """Verify Shopify webhook HMAC signature"""
    if not settings.shopify_webhook_secret:
        return True  # Skip verification in development
    
    digest = hmac.new(
        settings.shopify_webhook_secret.encode('utf-8'),
        data,
        hashlib.sha256
    ).digest()
    
    computed_hmac = hashlib.sha256(digest).hexdigest()
    return hmac.compare_digest(computed_hmac, hmac_header)


def send_sms(to: str, body: str) -> bool:
    """Send SMS using Twilio"""
    if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_phone_number]):
        print(f"[SMS] Would send to {to}: {body}")
        return True  # Skip in development
    
    try:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        message = client.messages.create(
            body=body,
            from_=settings.twilio_phone_number,
            to=to
        )
        print(f"[SMS] Sent message {message.sid} to {to}")
        return True
    except Exception as e:
        print(f"[SMS] Error sending to {to}: {e}")
        return False


def extract_sku_from_shopify_item(line_item: dict) -> Optional[str]:
    """Extract SKU from Shopify line item"""
    # Try variant SKU first
    if line_item.get('sku'):
        return line_item['sku']
    
    # Try product tags or other fields
    # This can be customized based on your Shopify setup
    return None


def is_deliverable_item(sku: str) -> bool:
    """Check if item requires delivery based on SKU or tags"""
    # Implement your business logic here
    # For example, check if SKU matches certain patterns
    # or belongs to specific categories
    
    # Simple example: items with certain prefixes need delivery
    deliverable_prefixes = ['FURN-', 'APPL-', 'LARGE-']
    return any(sku.startswith(prefix) for prefix in deliverable_prefixes)


def encode_liberty_item_id(sku: str) -> str:
    """Encode SKU to Liberty item ID format"""
    # Implement your encoding logic here
    # This is placeholder logic
    return sku.replace('-', '').upper()


def format_address(task) -> str:
    """Format delivery address for display"""
    parts = [task.delivery_address_line1]
    if task.delivery_address_line2:
        parts.append(task.delivery_address_line2)
    parts.append(f"{task.delivery_city}, {task.delivery_state} {task.delivery_zip}")
    return ", ".join(parts)


def format_phone(phone: str) -> str:
    """Format phone number for display"""
    # Remove non-digits
    digits = ''.join(c for c in phone if c.isdigit())
    
    # Format as (XXX) XXX-XXXX if 10 digits
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    
    return phone


def normalize_phone(phone: str) -> str:
    """Normalize phone number to E.164 format"""
    digits = ''.join(c for c in phone if c.isdigit())
    
    if len(digits) == 10:
        return f"+1{digits}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"+{digits}"
    
    return phone





