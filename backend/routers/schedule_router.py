from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from database import get_db
from models import DeliveryInvite, DeliveryTask, TaskStatus, TaskSource
from schemas import ScheduleFormSubmit
from utils import encode_liberty_item_id
from notifications import notify_scheduler_new_task

router = APIRouter(prefix="/schedule", tags=["scheduling"])


@router.get("/{token}", response_class=HTMLResponse)
def show_schedule_form(token: str, db: Session = Depends(get_db)):
    """Display scheduling form for customer"""
    invite = db.query(DeliveryInvite).filter(DeliveryInvite.token == token).first()
    
    if not invite:
        return HTMLResponse(content="<h1>Invalid or expired link</h1>", status_code=404)
    
    if invite.status != "sent":
        return HTMLResponse(content="<h1>This invitation has already been used</h1>", status_code=400)
    
    # Simple HTML form
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Schedule Your Delivery</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .container {{
                background: white;
                padding: 40px 30px;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 500px;
                width: 100%;
            }}
            h1 {{
                color: #333;
                margin-bottom: 10px;
                font-size: 24px;
            }}
            .subtitle {{
                color: #666;
                margin-bottom: 30px;
                font-size: 14px;
            }}
            .order-info {{
                background: #f7f7f7;
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 30px;
            }}
            .order-info p {{
                margin: 8px 0;
                color: #555;
            }}
            .form-group {{
                margin-bottom: 20px;
            }}
            label {{
                display: block;
                margin-bottom: 8px;
                color: #333;
                font-weight: 500;
            }}
            input, textarea {{
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                transition: border-color 0.3s;
            }}
            input:focus, textarea:focus {{
                outline: none;
                border-color: #667eea;
            }}
            textarea {{
                resize: vertical;
                min-height: 100px;
            }}
            button {{
                width: 100%;
                padding: 15px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            }}
            button:hover {{
                transform: translateY(-2px);
            }}
            button:active {{
                transform: translateY(0);
            }}
            .success {{
                display: none;
                text-align: center;
                padding: 40px 20px;
            }}
            .success-icon {{
                font-size: 60px;
                margin-bottom: 20px;
            }}
            .success h2 {{
                color: #4CAF50;
                margin-bottom: 15px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div id="form-container">
                <h1>Schedule Your Delivery</h1>
                <p class="subtitle">Order #{invite.shopify_order_number}</p>
                
                <div class="order-info">
                    <p><strong>Items:</strong> {len(invite.sku_list)} item(s)</p>
                    <p><strong>SKUs:</strong> {', '.join(invite.sku_list)}</p>
                </div>
                
                <form id="schedule-form" onsubmit="submitForm(event)">
                    <div class="form-group">
                        <label for="preferred_date">Preferred Delivery Date (Optional)</label>
                        <input type="date" id="preferred_date" name="preferred_date">
                    </div>
                    
                    <div class="form-group">
                        <label for="notes">Special Instructions (Optional)</label>
                        <textarea id="notes" name="notes" placeholder="Gate code, parking instructions, etc."></textarea>
                    </div>
                    
                    <button type="submit">Request Delivery</button>
                </form>
            </div>
            
            <div class="success" id="success-message">
                <div class="success-icon">✅</div>
                <h2>Request Submitted!</h2>
                <p>We've received your delivery request. Our team will contact you shortly to confirm the delivery time.</p>
            </div>
        </div>
        
        <script>
            async function submitForm(e) {{
                e.preventDefault();
                
                const formData = {{
                    preferred_date: document.getElementById('preferred_date').value,
                    notes: document.getElementById('notes').value
                }};
                
                try {{
                    const response = await fetch('/schedule/{token}', {{
                        method: 'POST',
                        headers: {{'Content-Type': 'application/json'}},
                        body: JSON.stringify(formData)
                    }});
                    
                    if (response.ok) {{
                        document.getElementById('form-container').style.display = 'none';
                        document.getElementById('success-message').style.display = 'block';
                    }} else {{
                        alert('Error submitting form. Please try again.');
                    }}
                }} catch (error) {{
                    alert('Error submitting form. Please try again.');
                }}
            }}
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)


@router.post("/{token}")
def submit_schedule_form(
    token: str,
    form_data: ScheduleFormSubmit,
    db: Session = Depends(get_db)
):
    """Submit scheduling form and create delivery task"""
    invite = db.query(DeliveryInvite).filter(DeliveryInvite.token == token).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    
    if invite.status != "sent":
        raise HTTPException(status_code=400, detail="This invitation has already been used")
    
    # Update invite status
    invite.status = "responded_yes"
    db.commit()
    
    # Create delivery task for each SKU (or combine them)
    # For simplicity, creating one task with first SKU
    first_sku = invite.sku_list[0]
    
    # In production, you'd fetch product details from Shopify
    task = DeliveryTask(
        source=TaskSource.shopify_online,
        status=TaskStatus.pending,
        shopify_order_id=invite.shopify_order_id,
        shopify_order_number=invite.shopify_order_number,
        sku=first_sku,
        liberty_item_id=encode_liberty_item_id(first_sku),
        item_title=f"Online Order Item (SKU: {first_sku})",
        item_description=None,
        image_url=None,
        customer_name="Online Customer",  # Would fetch from Shopify
        customer_phone=invite.customer_phone,
        customer_email=invite.customer_email,
        delivery_address_line1="Address from Shopify",  # Would fetch from Shopify
        delivery_address_line2=None,
        delivery_city="City",
        delivery_state="State",
        delivery_zip="00000",
        delivery_notes=form_data.notes
    )
    
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Notify scheduler
    notify_scheduler_new_task(task)
    
    return {"status": "success", "task_id": task.id}





