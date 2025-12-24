from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth_router, tasks_router, calendar_router, webhooks_router, schedule_router, items_router
from config import get_settings

settings = get_settings()

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Delivery Management System",
    description="Production-quality delivery management system with Shopify integration",
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


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "name": "Delivery Management System API",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

