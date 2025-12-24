# Delivery Management System - Backend

FastAPI backend for the Delivery Management System.

## Setup

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file with your configuration (see `.env.example`)

4. Initialize database:
```bash
python init_db.py
```

5. Run the server:
```bash
uvicorn main:app --reload
```

## API Documentation

Visit http://localhost:8000/docs for interactive API documentation.

## Database Models

### DeliveryTask
Main table for all delivery requests and scheduled deliveries.

### DeliveryInvite
Tracks delivery scheduling invitations sent to customers.

### User
User accounts with role-based permissions.

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user
- `POST /auth/register` - Register new user

### Tasks
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks/{id}` - Get task details
- `PATCH /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task

### Calendar
- `GET /api/calendar` - Get calendar events
- `GET /api/calendar/unscheduled` - Get unscheduled tasks

### Webhooks
- `POST /webhooks/shopify/orders` - Shopify order webhook
- `POST /webhooks/sms/incoming` - Incoming SMS webhook

### Scheduling
- `GET /schedule/{token}` - Customer scheduling form
- `POST /schedule/{token}` - Submit scheduling form

## Environment Variables

See `.env.example` for all required environment variables.

## Testing

Run tests:
```bash
pytest
```

## Production Deployment

1. Use PostgreSQL instead of SQLite:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

2. Set strong JWT_SECRET

3. Configure CORS for your frontend domain

4. Set up SSL/HTTPS

5. Configure proper logging

6. Set up monitoring and health checks





