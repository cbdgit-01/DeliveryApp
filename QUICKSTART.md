# Quick Start Guide

Get the Delivery Management System running in 5 minutes!

## Prerequisites

- Python 3.10+ installed
- Node.js 18+ and npm installed
- Terminal/Command prompt

## Step 1: Backend Setup (2 minutes)

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Mac/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cat > .env << EOF
DATABASE_URL=sqlite:///./delivery_app.db
JWT_SECRET=super-secret-key-change-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=24
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
SCHEDULER_PHONE=+1234567890
ENVIRONMENT=development
EOF

# Initialize database with sample data
python init_db.py

# Start the server
uvicorn main:app --reload
```

✅ Backend is now running at http://localhost:8000

## Step 2: Frontend Setup (2 minutes)

Open a NEW terminal window:

```bash
# Navigate to frontend
cd frontend

# Install dependencies (this might take a minute)
npm install

# Start development server
npm run dev
```

✅ Frontend is now running at http://localhost:5173

## Step 3: Login and Explore (1 minute)

1. Open your browser to http://localhost:5173

2. Login with default credentials:
   - **Username**: `admin`
   - **Password**: `admin123`

3. Explore the app:
   - View the Dashboard with sample deliveries
   - Check out the Calendar view
   - Create a new delivery task
   - Click on a task to see details

## Default Test Accounts

| Role      | Username   | Password      |
|-----------|------------|---------------|
| Admin     | admin      | admin123      |
| Staff     | staff      | staff123      |
| Scheduler | scheduler  | scheduler123  |

## What's Next?

### For Development:
- Read [README.md](./README.md) for full documentation
- Customize `backend/utils.py` for your business logic
- Add your Shopify credentials to `.env`
- Set up Twilio for SMS notifications

### For Production:
- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide
- Change all default passwords
- Use PostgreSQL instead of SQLite
- Set up proper environment variables
- Configure SSL/HTTPS

## Testing the Workflow

### 1. Create In-Store Delivery
- Click "New Delivery" in the dashboard
- Fill in customer and item details
- Submit the form
- The scheduler will receive an SMS notification (if configured)

### 2. Schedule a Delivery
- Go to Calendar view
- See unscheduled deliveries in the left sidebar
- Drag an unscheduled item onto the calendar
- Or click a pending task and use "Schedule" button

### 3. Mark as Delivered
- Click on a scheduled delivery
- Click "Mark as Delivered"
- Customer receives SMS confirmation (if configured)

## Common Issues

### Backend won't start
**Error**: `Address already in use`
**Solution**: Port 8000 is already in use. Stop other services or change port:
```bash
uvicorn main:app --reload --port 8001
```

### Frontend won't start
**Error**: `Port 5173 is in use`
**Solution**: Stop other Vite servers or:
```bash
npm run dev -- --port 3000
```

### Can't login
**Solution**: Make sure:
1. Backend is running (check http://localhost:8000/health)
2. Database was initialized (`python init_db.py`)
3. Using correct credentials (admin/admin123)

### Database errors
**Solution**: Delete the database and reinitialize:
```bash
cd backend
rm delivery_app.db
python init_db.py
```

## API Documentation

While the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Stopping the Servers

### Stop Backend
Press `Ctrl+C` in the backend terminal

### Stop Frontend
Press `Ctrl+C` in the frontend terminal

### Deactivate Python Virtual Environment
```bash
deactivate
```

## Need Help?

- Check [README.md](./README.md) for detailed documentation
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
- Look at API docs at http://localhost:8000/docs
- Review backend logs in the terminal

---

🎉 **You're all set!** Start building your delivery management workflow.





