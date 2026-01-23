import os

# DEBUG: Print all database-related env vars
print("=" * 50)
print("DATABASE DEBUG INFO")
print("=" * 50)
for var_name in ["POSTGRES_URL", "DATABASE_PRIVATE_URL", "DATABASE_URL"]:
    val = os.environ.get(var_name, "NOT SET")
    if val != "NOT SET" and "@" in val:
        print(f"{var_name}: postgresql://***@{val.split('@')[1][:30]}...")
    elif val != "NOT SET":
        print(f"{var_name}: {val[:50]}...")
    else:
        print(f"{var_name}: NOT SET")
print("=" * 50)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import engine, Base, SessionLocal
from routers import auth_router, tasks_router, calendar_router, webhooks_router, schedule_router, items_router, pickups_router, sms_router, uploads_router
from config import get_settings
from models import User
from auth import get_password_hash
from users_config import USERS

settings = get_settings()

# Print what settings ended up using
db_type = "PostgreSQL" if "postgresql" in settings.database_url else "SQLite"
print(f"🗄️  Using Database: {db_type}")

# Create database tables
Base.metadata.create_all(bind=engine)

# Ensure schema is up to date (add missing columns safely)
def ensure_schema_updates():
    """Add any missing columns to existing tables - safe for production"""
    from sqlalchemy import text
    from database import engine
    
    # List of schema updates (column additions only - safe operations)
    schema_updates = [
        # Add items column to delivery_tasks if it doesn't exist
        ("delivery_tasks", "items", "ALTER TABLE delivery_tasks ADD COLUMN IF NOT EXISTS items JSON"),
        # Add signature_url column to delivery_tasks for e-signatures
        ("delivery_tasks", "signature_url", "ALTER TABLE delivery_tasks ADD COLUMN IF NOT EXISTS signature_url VARCHAR(255)"),
    ]
    
    with engine.connect() as conn:
        for table, column, sql in schema_updates:
            try:
                # Check if column exists (PostgreSQL)
                if "postgresql" in settings.database_url:
                    result = conn.execute(text(
                        f"SELECT column_name FROM information_schema.columns "
                        f"WHERE table_name='{table}' AND column_name='{column}'"
                    ))
                    if result.fetchone() is None:
                        conn.execute(text(sql))
                        conn.commit()
                        print(f"✓ Added column: {table}.{column}")
                    else:
                        print(f"✓ Column exists: {table}.{column}")
                else:
                    # SQLite - just try to add, ignore if exists
                    try:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} JSON"))
                        conn.commit()
                        print(f"✓ Added column: {table}.{column}")
                    except:
                        print(f"✓ Column exists: {table}.{column}")
            except Exception as e:
                print(f"Schema update skipped for {table}.{column}: {e}")

ensure_schema_updates()

# Sync users from config file
def sync_users():
    """Sync users from users_config.py to database"""
    db = SessionLocal()
    try:
        for user_data in USERS:
            existing = db.query(User).filter(User.username == user_data["username"]).first()
            if not existing:
                # Create new user
                user = User(
                    username=user_data["username"],
                    hashed_password=get_password_hash(user_data["password"]),
                    role=user_data["role"],
                    full_name=user_data.get("full_name", ""),
                    is_active=1
                )
                db.add(user)
                print(f"✓ Created user: {user_data['username']}")
            else:
                # Update existing user (in case password/role changed)
                existing.hashed_password = get_password_hash(user_data["password"])
                existing.role = user_data["role"]
                existing.full_name = user_data.get("full_name", "")
        db.commit()
    except Exception as e:
        print(f"Error syncing users: {e}")
        db.rollback()
    finally:
        db.close()

sync_users()

# Initialize FastAPI app
app = FastAPI(
    title="Consigned By Design API",
    description="Delivery and pickup management for Consigned By Design",
    version="1.0.0"
)

# Configure CORS - allow ngrok for development testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router.router)
app.include_router(tasks_router.router)
app.include_router(calendar_router.router)
app.include_router(webhooks_router.router)
app.include_router(schedule_router.router)
app.include_router(items_router.router)
app.include_router(pickups_router.router)
app.include_router(sms_router.router)
app.include_router(uploads_router.router)


@app.get("/health")
def health_check():
    """Health check endpoint"""
    db_type = "postgresql" if "postgresql" in settings.database_url else "sqlite"
    return {
        "status": "healthy",
        "database": db_type
    }


@app.get("/api-info")
def api_info():
    """API info endpoint"""
    return {
        "name": "Consigned By Design API",
        "version": "1.0.0",
        "status": "operational"
    }


# Serve frontend static files in production
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    # Mount assets folder
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all non-API routes"""
        # Don't serve frontend for API routes
        if full_path.startswith(("api/", "auth/", "sms/", "webhooks/", "schedule/", "health", "api-info")):
            return {"error": "Not found"}
        
        # Try to serve the exact file
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Return index.html for SPA routing (React Router)
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        
        return {"error": "Frontend not found"}
else:
    # No static folder - show API info at root
    @app.get("/")
    def root():
        """Root endpoint when no frontend"""
        return {
            "name": "Consigned By Design API",
            "version": "1.0.0", 
            "status": "operational",
            "message": "Frontend not deployed. Visit /health for health check."
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

