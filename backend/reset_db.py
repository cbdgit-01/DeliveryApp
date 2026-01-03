#!/usr/bin/env python3
"""
Database Reset Script
Clears all data and reinitializes with default users only (no sample data).
Run this after configuring Shopify to start fresh.
"""

import os
import sys

# Add the backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
from models import User, DeliveryTask, DeliveryInvite
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def reset_database():
    print("=" * 50)
    print("DATABASE RESET SCRIPT")
    print("=" * 50)
    
    # Confirm with user
    confirm = input("\n⚠️  This will DELETE ALL DATA including:\n"
                   "   - All delivery tasks\n"
                   "   - All delivery invites\n"
                   "   - All users\n\n"
                   "Type 'RESET' to confirm: ")
    
    if confirm != "RESET":
        print("\n❌ Reset cancelled.")
        return
    
    print("\n🗑️  Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("📦 Creating fresh tables...")
    Base.metadata.create_all(bind=engine)
    
    print("👤 Creating default users...")
    db = SessionLocal()
    
    try:
        # Create admin user
        admin = User(
            username="admin",
            email="admin@example.com",
            hashed_password=pwd_context.hash("admin123"),
            full_name="Administrator",
            role="admin",
            is_active=1
        )
        db.add(admin)
        
        # Create staff user
        staff = User(
            username="staff",
            email="staff@example.com",
            hashed_password=pwd_context.hash("staff123"),
            full_name="Store Staff",
            role="staff",
            is_active=1
        )
        db.add(staff)
        
        db.commit()
        
        print("\n✅ Database reset complete!")
        print("\n" + "=" * 50)
        print("DEFAULT LOGIN CREDENTIALS:")
        print("=" * 50)
        print("\n  Admin:")
        print("    Username: admin")
        print("    Password: admin123")
        print("\n  Staff:")
        print("    Username: staff")
        print("    Password: staff123")
        print("\n" + "=" * 50)
        print("\nTo manage users later, run:")
        print("  python manage_users.py list")
        print("  python manage_users.py create <username> <password> <role>")
        print("  python manage_users.py reset-password <username> <new_password>")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    reset_database()

