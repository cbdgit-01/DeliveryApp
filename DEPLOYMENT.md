# Deployment Guide

Complete guide to deploying the Delivery Management System to production.

## Overview

The system consists of two parts:
1. **Backend**: FastAPI Python application
2. **Frontend**: React + Vite static site

## Backend Deployment

### Option 1: Railway (Recommended)

1. **Sign up**: https://railway.app

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Configure Service**:
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Add Environment Variables**:
   ```
   DATABASE_URL=postgresql://... (Railway will provide this)
   JWT_SECRET=<generate-strong-secret>
   SHOPIFY_API_KEY=<your-key>
   SHOPIFY_API_SECRET=<your-secret>
   SHOPIFY_SHOP_URL=<your-shop>.myshopify.com
   SHOPIFY_ACCESS_TOKEN=<your-token>
   SHOPIFY_WEBHOOK_SECRET=<your-secret>
   TWILIO_ACCOUNT_SID=<your-sid>
   TWILIO_AUTH_TOKEN=<your-token>
   TWILIO_PHONE_NUMBER=<your-number>
   FRONTEND_URL=https://your-frontend-domain.com
   BACKEND_URL=https://your-backend-domain.railway.app
   SCHEDULER_PHONE=<your-phone>
   ENVIRONMENT=production
   ```

5. **Add PostgreSQL Database**:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically set DATABASE_URL

6. **Initialize Database**:
   - In Railway dashboard, open "Deploy" tab
   - Add one-time command: `python init_db.py`

7. **Deploy**: Railway will automatically deploy on git push

### Option 2: Render

1. **Sign up**: https://render.com

2. **Create Web Service**:
   - Click "New +" → "Web Service"
   - Connect repository
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Add PostgreSQL Database**:
   - Create new PostgreSQL database
   - Copy internal database URL

4. **Add Environment Variables** (same as Railway)

5. **Deploy**

### Option 3: Fly.io

1. **Install Fly CLI**: https://fly.io/docs/hands-on/install-flyctl/

2. **Login**:
   ```bash
   flyctl auth login
   ```

3. **Create fly.toml** in backend directory:
   ```toml
   app = "delivery-app-backend"
   
   [build]
     builder = "paketobuildpacks/builder:base"
   
   [env]
     PORT = "8000"
   
   [[services]]
     internal_port = 8000
     protocol = "tcp"
   
     [[services.ports]]
       handlers = ["http"]
       port = 80
     
     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443
   ```

4. **Deploy**:
   ```bash
   cd backend
   flyctl launch
   flyctl deploy
   ```

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Sign up**: https://vercel.com

2. **Import Project**:
   - Click "New Project"
   - Import from GitHub
   - Select your repository

3. **Configure**:
   - Root directory: `frontend`
   - Framework preset: Vite
   - Build command: `npm run build`
   - Output directory: `dist`

4. **Environment Variables**:
   ```
   VITE_API_URL=https://your-backend-domain.com
   ```

5. **Deploy**: Vercel will auto-deploy on git push

### Option 2: Netlify

1. **Sign up**: https://netlify.com

2. **Import Project**:
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub
   - Select repository

3. **Configure**:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`

4. **Environment Variables**:
   ```
   VITE_API_URL=https://your-backend-domain.com
   ```

5. **Deploy**

## Database Setup

### PostgreSQL (Production)

When using PostgreSQL, update your backend `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Run migrations:
```bash
python init_db.py
```

## Post-Deployment Checklist

### Backend
- [ ] Database initialized with `init_db.py`
- [ ] All environment variables set
- [ ] JWT_SECRET is strong and unique
- [ ] HTTPS enabled
- [ ] CORS configured for frontend domain
- [ ] Health check endpoint working: `/health`
- [ ] API docs accessible: `/docs`

### Frontend
- [ ] VITE_API_URL points to backend
- [ ] App loads without errors
- [ ] Login works with test accounts
- [ ] PWA manifest loaded correctly
- [ ] Mobile responsive design works

### Integration
- [ ] Shopify webhook configured and tested
- [ ] Twilio SMS webhook configured
- [ ] Test SMS notifications work
- [ ] Test creating a delivery task
- [ ] Test scheduling on calendar
- [ ] Test drag-and-drop calendar

## Shopify Configuration

1. **Go to Shopify Admin** → Settings → Notifications → Webhooks

2. **Create Webhook**:
   - Event: Order creation
   - Format: JSON
   - URL: `https://your-backend-domain.com/webhooks/shopify/orders`
   - Webhook API version: Latest

3. **Test Webhook**:
   - Create a test order in Shopify
   - Check backend logs for webhook receipt

## Twilio Configuration

1. **Go to Twilio Console**: https://console.twilio.com

2. **Buy Phone Number** with SMS capabilities

3. **Configure Webhook**:
   - Go to Phone Numbers → Active Numbers
   - Click your number
   - Messaging Configuration:
     - A message comes in: Webhook
     - URL: `https://your-backend-domain.com/webhooks/sms/incoming`
     - HTTP POST

4. **Test SMS**:
   - Send a test SMS to your Twilio number
   - Check backend logs

## Monitoring

### Backend Health Check
```bash
curl https://your-backend-domain.com/health
```

### Frontend Health Check
Open https://your-frontend-domain.com in browser

### Database Check
```bash
# Railway
railway run python -c "from database import engine; print(engine.table_names())"

# Render/Fly
# Use their respective CLI tools
```

## Backup Strategy

### Database Backups

**Railway**: Automatic backups included
**Render**: Automatic backups on paid plans
**Custom**: Set up daily cron job:

```bash
# Backup PostgreSQL
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## Security Hardening

1. **Change Default Passwords**:
   ```bash
   # After deployment, login and change all default user passwords
   ```

2. **Enable Rate Limiting**:
   - Add rate limiting middleware to FastAPI
   - Use Cloudflare for DDoS protection

3. **Environment Variables**:
   - Never commit `.env` files
   - Use platform secret management
   - Rotate secrets regularly

4. **HTTPS Only**:
   - Ensure all platforms use HTTPS
   - Enable HSTS headers

5. **Database Security**:
   - Use strong database passwords
   - Enable SSL for database connections
   - Restrict database access by IP

## Troubleshooting

### Backend not starting
- Check environment variables are set
- Check database connection string
- View application logs in platform dashboard
- Verify Python version (3.10+)

### Frontend not loading API data
- Check CORS settings in backend
- Verify VITE_API_URL is correct
- Check browser console for errors
- Test API directly: `curl https://your-backend/health`

### Webhooks not working
- Verify webhook URLs are correct
- Check webhook secrets match
- View webhook logs in Shopify/Twilio dashboards
- Test with webhook testing tools

### SMS not sending
- Check Twilio account balance
- Verify phone numbers are in E.164 format (+1234567890)
- Check Twilio logs for errors
- Test with Twilio API explorer

## Scaling

### Backend Scaling
- **Railway/Render**: Auto-scaling available
- **Database**: Upgrade to larger instance as needed
- **Caching**: Add Redis for session storage

### Frontend Scaling
- Vercel/Netlify handle CDN automatically
- No additional scaling needed

## Cost Estimates

### Development/Small Business
- Railway Backend: $5-10/month
- Railway PostgreSQL: $5/month
- Vercel Frontend: Free
- Twilio SMS: ~$0.0075/SMS
- **Total**: ~$15/month + SMS usage

### Medium Business
- Render Backend: $20/month
- Render PostgreSQL: $20/month
- Netlify Frontend: Free (or $19/month for team)
- Twilio SMS: ~$0.0075/SMS
- **Total**: ~$40-60/month + SMS usage

## Maintenance

### Weekly
- [ ] Check error logs
- [ ] Monitor SMS delivery rates
- [ ] Review failed webhooks

### Monthly
- [ ] Update dependencies
- [ ] Review user accounts
- [ ] Backup database
- [ ] Check disk space usage

### Quarterly
- [ ] Security audit
- [ ] Performance optimization
- [ ] Review and optimize costs

---

Need help? Contact your development team or create an issue in the repository.





