# Project Structure

Complete overview of the Delivery Management System file structure.

## Root Directory

```
DeliveryApp/
├── backend/              # FastAPI Python backend
├── frontend/             # React + Vite frontend
├── README.md            # Main project documentation
├── QUICKSTART.md        # 5-minute setup guide
├── DEPLOYMENT.md        # Production deployment guide
├── CHANGELOG.md         # Version history
├── PROJECT_STRUCTURE.md # This file
└── .gitignore          # Git ignore rules
```

## Backend Structure

```
backend/
├── main.py              # FastAPI app entry point
├── config.py            # Configuration and settings
├── database.py          # Database connection and session
├── models.py            # SQLAlchemy database models
├── schemas.py           # Pydantic schemas for validation
├── auth.py              # Authentication logic (JWT, passwords)
├── utils.py             # Helper functions (SMS, SKU parsing, etc.)
├── notifications.py     # SMS notification templates and sending
├── init_db.py          # Database initialization script
├── requirements.txt     # Python dependencies
├── runtime.txt         # Python version for deployment
├── Procfile            # Process file for deployment
├── .gitignore          # Git ignore rules
├── .env.example        # Environment variable template
├── README.md           # Backend documentation
└── routers/            # API route modules
    ├── __init__.py
    ├── auth_router.py      # /auth endpoints (login, register)
    ├── tasks_router.py     # /api/tasks endpoints (CRUD)
    ├── calendar_router.py  # /api/calendar endpoints
    ├── webhooks_router.py  # /webhooks endpoints (Shopify, SMS)
    └── schedule_router.py  # /schedule endpoints (customer forms)
```

### Key Backend Files

#### `main.py`
- FastAPI application initialization
- CORS configuration
- Router registration
- Health check endpoints

#### `models.py`
- **DeliveryTask**: Main delivery records
- **DeliveryInvite**: SMS invitation tracking
- **User**: User accounts with roles

#### `schemas.py`
- Pydantic models for request/response validation
- Type checking and data serialization

#### `auth.py`
- JWT token creation and validation
- Password hashing (bcrypt)
- User authentication
- Role-based authorization

#### `utils.py`
- SMS sending (Twilio integration)
- SKU parsing and validation
- Phone number formatting
- Shopify webhook verification

#### `notifications.py`
- SMS templates for different scenarios
- Customer notifications
- Scheduler notifications

## Frontend Structure

```
frontend/
├── index.html           # HTML entry point
├── package.json         # Node dependencies and scripts
├── vite.config.js      # Vite + PWA configuration
├── .gitignore          # Git ignore rules
├── .env.example        # Environment variable template
├── README.md           # Frontend documentation
├── public/             # Static assets
│   ├── vite.svg
│   └── PWA_ICONS.md    # Instructions for PWA icons
└── src/                # Source code
    ├── main.jsx        # React entry point
    ├── App.jsx         # Main app component with routing
    ├── App.css
    ├── index.css       # Global styles and CSS variables
    ├── context/        # React Context providers
    │   └── AuthContext.jsx    # Authentication state
    ├── services/       # API integration
    │   └── api.js      # Axios instance and API functions
    ├── components/     # Reusable UI components
    │   ├── Layout.jsx  # Main layout with navigation
    │   └── Layout.css
    └── pages/          # Page components
        ├── Login.jsx           # Authentication page
        ├── Login.css
        ├── Dashboard.jsx       # Main dashboard
        ├── Dashboard.css
        ├── Calendar.jsx        # FullCalendar view
        ├── Calendar.css
        ├── CreateTask.jsx      # New task form
        ├── CreateTask.css
        ├── TaskDetail.jsx      # Task detail and editing
        └── TaskDetail.css
```

### Key Frontend Files

#### `App.jsx`
- React Router setup
- Protected route wrapper
- Main app routing structure

#### `context/AuthContext.jsx`
- Authentication state management
- Login/logout functions
- User role checking
- Token storage

#### `services/api.js`
- Axios instance with interceptors
- API endpoint functions
- Automatic token injection
- Error handling

#### Pages

**Login.jsx**
- User authentication form
- Credential validation
- Redirect after login

**Dashboard.jsx**
- Task list with filtering
- Search functionality
- Statistics cards
- Task status overview

**Calendar.jsx**
- FullCalendar integration
- Drag-and-drop scheduling
- Unscheduled tasks sidebar
- Event detail modal

**CreateTask.jsx**
- Multi-section form
- Customer information
- Item details
- Delivery address

**TaskDetail.jsx**
- Complete task information
- Scheduling interface
- Status updates
- Google Maps integration

## Database Schema

### DeliveryTask
Primary table for all deliveries.

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| source | Enum | shopify_online or in_store |
| status | Enum | pending, scheduled, delivered, cancelled |
| sku | String | Product SKU |
| item_title | String | Product name |
| customer_name | String | Customer name |
| customer_phone | String | Phone number |
| delivery_address_* | String | Address fields |
| scheduled_start | DateTime | Delivery start time |
| scheduled_end | DateTime | Delivery end time |
| created_at | DateTime | Created timestamp |

### DeliveryInvite
Tracks customer delivery invitations.

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| shopify_order_id | String | Shopify order ID |
| customer_phone | String | Customer phone |
| token | String | Unique invitation token |
| status | Enum | sent, responded_yes, expired |
| sku_list | JSON | Array of SKUs |

### User
User accounts with roles.

| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| username | String | Unique username |
| hashed_password | String | Bcrypt hash |
| role | String | staff, scheduler, admin |
| is_active | Boolean | Account status |

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user
- `POST /auth/register` - Register new user

### Tasks
- `GET /api/tasks` - List tasks (with filters)
- `POST /api/tasks` - Create task
- `GET /api/tasks/{id}` - Get task
- `PATCH /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task

### Calendar
- `GET /api/calendar` - Get events for date range
- `GET /api/calendar/unscheduled` - Get unscheduled tasks

### Webhooks
- `POST /webhooks/shopify/orders` - Shopify order webhook
- `POST /webhooks/sms/incoming` - Twilio SMS webhook

### Scheduling
- `GET /schedule/{token}` - Customer scheduling form
- `POST /schedule/{token}` - Submit scheduling form

## Configuration Files

### Backend `.env`
```
DATABASE_URL=sqlite:///./delivery_app.db
JWT_SECRET=your-secret-key
SHOPIFY_API_KEY=...
TWILIO_ACCOUNT_SID=...
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
SCHEDULER_PHONE=+1234567890
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:8000
```

## Deployment Files

- `backend/Procfile` - Process definition for Heroku/Railway
- `backend/runtime.txt` - Python version specification
- `frontend/vite.config.js` - PWA and build configuration

## Development Workflow

1. **Backend Development**:
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn main:app --reload
   ```

2. **Frontend Development**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Database Changes**:
   ```bash
   cd backend
   # Modify models.py
   rm delivery_app.db
   python init_db.py
   ```

4. **Testing**:
   - Backend: Visit http://localhost:8000/docs
   - Frontend: Visit http://localhost:5173
   - Test with default credentials

## Production Build

### Backend
```bash
cd backend
pip install -r requirements.txt
python init_db.py
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run build
# dist/ folder contains production build
```

## Key Technologies

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database
- **Pydantic** - Data validation
- **Twilio** - SMS integration
- **python-jose** - JWT handling
- **passlib** - Password hashing

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **FullCalendar** - Calendar component
- **Axios** - HTTP client
- **React Router** - Navigation
- **vite-plugin-pwa** - PWA support

## Next Steps

1. **Customize Business Logic**:
   - Modify `utils.py::is_deliverable_item()` for your products
   - Update `utils.py::encode_liberty_item_id()` for your ID format

2. **Add Your Branding**:
   - Update colors in `frontend/src/index.css`
   - Add your logo to `frontend/public/`
   - Create PWA icons (see `frontend/public/PWA_ICONS.md`)

3. **Configure Integrations**:
   - Set up Shopify webhook
   - Configure Twilio SMS
   - Test end-to-end workflow

4. **Deploy to Production**:
   - Follow `DEPLOYMENT.md`
   - Use PostgreSQL for database
   - Set up monitoring and backups

---

For questions about specific files or features, see the README files in each directory.





