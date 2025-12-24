#!/usr/bin/env python3
"""
Initialize database with sample data and default admin user
"""
from database import SessionLocal, engine, Base
from models import User, DeliveryTask, TaskStatus, TaskSource
from auth import get_password_hash
from datetime import datetime, timedelta

def init_database():
    """Initialize database with tables and sample data"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if admin user exists
        admin = db.query(User).filter(User.username == "admin").first()
        
        if not admin:
            print("Creating default admin user...")
            admin = User(
                username="admin",
                email="admin@example.com",
                full_name="System Administrator",
                role="admin",
                hashed_password=get_password_hash("admin123"),
                is_active=1
            )
            db.add(admin)
            print("✓ Admin user created (username: admin, password: admin123)")
        else:
            print("✓ Admin user already exists")
        
        # Check if staff user exists
        staff = db.query(User).filter(User.username == "staff").first()
        
        if not staff:
            print("Creating default staff user...")
            staff = User(
                username="staff",
                email="staff@example.com",
                full_name="Store Staff",
                role="staff",
                hashed_password=get_password_hash("staff123"),
                is_active=1
            )
            db.add(staff)
            print("✓ Staff user created (username: staff, password: staff123)")
        else:
            print("✓ Staff user already exists")
        
        # Check if scheduler user exists
        scheduler = db.query(User).filter(User.username == "scheduler").first()
        
        if not scheduler:
            print("Creating default scheduler user...")
            scheduler = User(
                username="scheduler",
                email="scheduler@example.com",
                full_name="Delivery Scheduler",
                role="scheduler",
                hashed_password=get_password_hash("scheduler123"),
                is_active=1
            )
            db.add(scheduler)
            print("✓ Scheduler user created (username: scheduler, password: scheduler123)")
        else:
            print("✓ Scheduler user already exists")
        
        db.commit()
        
        # Create sample delivery tasks if none exist
        task_count = db.query(DeliveryTask).count()
        
        if task_count == 0:
            print("Creating sample delivery tasks...")
            
            # Sample pending task
            task1 = DeliveryTask(
                source=TaskSource.in_store,
                status=TaskStatus.pending,
                sku="FURN-001",
                liberty_item_id="FURN001",
                item_title="Victorian Sofa - Blue Velvet",
                item_description="Beautiful vintage sofa in excellent condition",
                customer_name="Jane Smith",
                customer_phone="+1234567890",
                customer_email="jane@example.com",
                delivery_address_line1="123 Main Street",
                delivery_address_line2="Apt 4B",
                delivery_city="San Francisco",
                delivery_state="CA",
                delivery_zip="94102",
                delivery_notes="Please call upon arrival"
            )
            db.add(task1)
            
            # Sample scheduled task
            tomorrow = datetime.now() + timedelta(days=1)
            task2 = DeliveryTask(
                source=TaskSource.in_store,
                status=TaskStatus.scheduled,
                sku="FURN-002",
                liberty_item_id="FURN002",
                item_title="Brass Table Lamp",
                customer_name="John Doe",
                customer_phone="+1987654321",
                delivery_address_line1="456 Oak Avenue",
                delivery_city="Oakland",
                delivery_state="CA",
                delivery_zip="94601",
                scheduled_start=tomorrow.replace(hour=14, minute=0, second=0),
                scheduled_end=tomorrow.replace(hour=16, minute=0, second=0)
            )
            db.add(task2)
            
            # Sample delivered task
            yesterday = datetime.now() - timedelta(days=1)
            task3 = DeliveryTask(
                source=TaskSource.shopify_online,
                status=TaskStatus.delivered,
                shopify_order_id="12345",
                shopify_order_number="1001",
                sku="FURN-003",
                liberty_item_id="FURN003",
                item_title="Antique Dresser",
                customer_name="Bob Johnson",
                customer_phone="+1555555555",
                customer_email="bob@example.com",
                delivery_address_line1="789 Pine Street",
                delivery_city="Berkeley",
                delivery_state="CA",
                delivery_zip="94704",
                scheduled_start=yesterday.replace(hour=10, minute=0, second=0),
                scheduled_end=yesterday.replace(hour=12, minute=0, second=0)
            )
            db.add(task3)
            
            db.commit()
            print("✓ Sample tasks created")
        else:
            print(f"✓ Database already has {task_count} tasks")
        
        print("\n" + "="*50)
        print("Database initialization complete!")
        print("="*50)
        print("\nDefault Users:")
        print("  Admin:     username='admin'     password='admin123'")
        print("  Staff:     username='staff'     password='staff123'")
        print("  Scheduler: username='scheduler' password='scheduler123'")
        print("\nYou can now start the server with: uvicorn main:app --reload")
        print("="*50)
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_database()





