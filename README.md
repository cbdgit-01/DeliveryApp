# Delivery Management System

A production-quality delivery management system that replaces manual Google Calendar workflows with automated scheduling, notifications, and a professional web interface.

## 🚀 Features

- **Automated Delivery Detection**: Automatically detects online orders requiring delivery via Shopify webhooks
- **Staff Portal**: In-store employees can create delivery tasks for walk-in customers
- **Smart Scheduling**: Drag-and-drop calendar interface for easy delivery scheduling
- **SMS Notifications**: Automated SMS notifications for customers and schedulers
- **Mobile-First Design**: Optimized for iPhone with PWA support
- **Role-Based Access**: Different permissions for staff, schedulers, and admins
- **Real-Time Updates**: Live calendar updates and status tracking

## 📋 System Requirements

### Backend
- Python 3.10 or higher
- SQLite (included) or PostgreSQL for production

### Frontend
- Node.js 18+ and npm
- Modern web browser (Chrome, Safari, Firefox, Edge)

## 🛠️ Installation & Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file (copy from `.env.example` in documentation below):
```bash
# Copy the environment variables from the backend/.env.example structure
```

5. Initialize the database:
```bash
python init_db.py
```

6. Start the backend server:
```bash
uvicorn main:app --reload
```

The backend will be available at http://localhost:8000

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at http://localhost:5173

## 👥 Default Users

After running `init_db.py`, you'll have these default accounts:

- **Admin**: username: `admin`, password: `admin123`
- **Staff**: username: `staff`, password: `staff123`
- **Scheduler**: username: `scheduler`, password: `scheduler123`

**⚠️ Change these passwords in production!**

## 🔑 Configuration

### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL=sqlite:///./delivery_app.db

# JWT Authentication
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=24

# Shopify
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SHOPIFY_SHOP_URL=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret

# Twilio SMS
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# App Configuration
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
SCHEDULER_PHONE=+1234567890

# Environment
ENVIRONMENT=development
```

### Frontend Configuration

Create a `.env` file in the `frontend` directory (optional):

```env
VITE_API_URL=http://localhost:8000
```

## 🚢 Deployment

### Backend Deployment (Railway/Render/Fly.io)

1. Push your code to GitHub
2. Connect your repository to your hosting platform
3. Set environment variables in the platform dashboard
4. Deploy!

**Recommended platforms**:
- Railway: https://railway.app
- Render: https://render.com
- Fly.io: https://fly.io

### Frontend Deployment (Vercel/Netlify)

1. Push your code to GitHub
2. Connect your repository to Vercel or Netlify
3. Set build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Set environment variable: `VITE_API_URL=https://your-api-domain.com`
5. Deploy!

## 📱 PWA Installation

The app works as a Progressive Web App (PWA):

### iPhone
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Name it "Deliveries" and tap Add

### Android
1. Open the app in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home Screen"
4. Tap Add

## 🔄 Shopify Integration

### Setting Up Webhooks

1. Go to your Shopify Admin → Settings → Notifications → Webhooks
2. Create a new webhook:
   - Event: `Order creation`
   - Format: `JSON`
   - URL: `https://your-api-domain.com/webhooks/shopify/orders`
   - Webhook API version: Latest

3. Save and test with a sample order

### Product Configuration

For items that require delivery, add a tag or use SKU patterns that match your `is_deliverable_item()` logic in `utils.py`.

## 📞 Twilio/SMS Setup

1. Sign up for Twilio: https://www.twilio.com
2. Get a phone number with SMS capabilities
3. Add your Twilio credentials to `.env`
4. Configure webhook for incoming SMS:
   - URL: `https://your-api-domain.com/webhooks/sms/incoming`
   - Method: POST

## 📖 API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🏗️ Architecture

### Backend (FastAPI)
- `main.py` - Application entry point
- `models.py` - Database models
- `schemas.py` - Pydantic schemas for validation
- `database.py` - Database connection
- `auth.py` - Authentication logic
- `routers/` - API endpoints organized by feature
- `utils.py` - Helper functions
- `notifications.py` - SMS notification logic

### Frontend (React + Vite)
- `src/pages/` - Page components
- `src/components/` - Reusable UI components
- `src/context/` - React context (Auth)
- `src/services/` - API integration
- `src/App.jsx` - Main app component with routing

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🔒 Security Notes

1. **Change default passwords** immediately
2. **Use HTTPS** in production
3. **Set strong JWT_SECRET**
4. **Enable CORS** only for your domains
5. **Validate Shopify webhooks** using HMAC
6. **Validate Twilio webhooks** using request signatures

## 🐛 Troubleshooting

### Backend won't start
- Check Python version: `python --version` (need 3.10+)
- Check if port 8000 is available
- Verify `.env` file exists and is properly formatted

### Frontend won't start
- Check Node version: `node --version` (need 18+)
- Delete `node_modules` and run `npm install` again
- Check if port 5173 is available

### Database issues
- Delete `delivery_app.db` and run `python init_db.py` again
- Check database permissions

### SMS not sending
- Verify Twilio credentials in `.env`
- Check Twilio account balance
- Verify phone numbers are in E.164 format

## 📝 License

Proprietary - All rights reserved

## 🤝 Support

For issues and questions, contact your development team.

---

Built with ❤️ for efficient delivery management





