# Shopify Integration Setup Guide

This guide walks you through connecting your Shopify store to the Delivery Management System.

## What You Need

1. **A Shopify store** with Admin access
2. **A Custom App** created in Shopify (for API access)

---

## Step 1: Create a Custom App in Shopify

1. Log into your **Shopify Admin** panel
2. Go to **Settings** → **Apps and sales channels**
3. Click **Develop apps** (top right)
4. If prompted, click **Allow custom app development**
5. Click **Create an app**
6. Name it something like "Delivery Management System"
7. Click **Create app**

---

## Step 2: Configure API Scopes

1. In your new app, click **Configure Admin API scopes**
2. Enable these scopes:
   - ✅ `read_products` - Required for SKU lookup
   - ✅ `read_orders` - Required for order webhooks
   - ✅ `read_customers` - Required for customer info
   - ✅ `read_inventory` - Optional: for stock levels
3. Click **Save**

---

## Step 3: Install the App and Get Credentials

1. Click **Install app** (top right)
2. Confirm the installation
3. You'll now see your **Admin API access token** - **COPY THIS NOW** (it only shows once!)
4. Also note down your **API key** and **API secret key** from the app overview

---

## Step 4: Configure Environment Variables

Add these to your `.env` file in the `backend` directory:

```env
# Shopify Configuration
SHOPIFY_SHOP_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here
```

### Where to find each value:

| Variable | Where to Find It |
|----------|------------------|
| `SHOPIFY_SHOP_URL` | Your store URL (e.g., `liberty-furniture.myshopify.com`) - just the domain, no `https://` |
| `SHOPIFY_ACCESS_TOKEN` | Shows once when you install the app (starts with `shpat_`) |
| `SHOPIFY_API_KEY` | App overview page → API credentials |
| `SHOPIFY_API_SECRET` | App overview page → API credentials |
| `SHOPIFY_WEBHOOK_SECRET` | See Step 5 below |

---

## Step 5: Set Up Webhooks (For Automatic Order Detection)

To automatically create delivery tasks when orders come in:

1. In your Shopify app, go to **Webhooks**
2. Click **Add webhook**
3. Configure:
   - **Event:** `Order creation`
   - **Format:** `JSON`
   - **URL:** `https://your-domain.com/webhooks/shopify/orders`
   
   For local development with ngrok:
   ```
   https://your-ngrok-url.ngrok-free.dev/webhooks/shopify/orders
   ```

4. Click **Save**
5. Copy the **Webhook signing secret** and add it to your `.env` as `SHOPIFY_WEBHOOK_SECRET`

---

## Step 6: Test Your Connection

Once configured, restart your backend server and test the connection:

### Using the API:

```bash
# Login first to get a token
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'

# Test Shopify connection (use the token from login)
curl http://localhost:8000/api/items/shopify/status \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Expected Response (Success):

```json
{
  "connected": true,
  "status": "connected",
  "message": "Successfully connected to Shopify",
  "shop": {
    "name": "Your Store Name",
    "domain": "your-store.myshopify.com",
    "email": "store@example.com",
    "currency": "USD",
    "plan_name": "Basic Shopify"
  }
}
```

### Expected Response (Not Configured):

```json
{
  "connected": false,
  "status": "not_configured",
  "message": "Shopify credentials not configured"
}
```

---

## Step 7: Test SKU Lookup

Once connected, test the SKU lookup feature:

```bash
curl "http://localhost:8000/api/items/lookup?sku=YOUR-SKU-HERE" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

This will return product details including:
- Title
- Description
- Images
- Price
- Inventory quantity

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/items/shopify/status` | GET | Check Shopify connection status |
| `/api/items/lookup?sku=XXX` | GET | Look up product by SKU |
| `/api/items/search?q=XXX` | GET | Search products by title/SKU |
| `/webhooks/shopify/orders` | POST | Receive order webhooks |

---

## Troubleshooting

### "Shopify credentials not configured"
- Check that all 4 Shopify variables are in your `.env` file
- Restart the backend server after changing `.env`

### "Invalid access token"
- Your access token may have expired or been revoked
- Go to your Shopify app and regenerate the access token
- Remember: the token only shows once when you install the app!

### "Shop not found"
- Check your `SHOPIFY_SHOP_URL` - it should be just the domain like `your-store.myshopify.com`
- Don't include `https://` or trailing slashes

### Webhook not working
- Make sure your webhook URL is publicly accessible (use ngrok for local dev)
- Check the webhook signing secret matches
- Look at Shopify's webhook logs for errors

### SKU not found
- Make sure the SKU exists in your Shopify products
- SKUs are case-sensitive
- Check that the product isn't archived/draft

---

## Development Mode

If Shopify is not configured, the system runs in **development mode**:
- SKU lookups return mock data
- Webhooks are still received but won't have real product data
- This lets you test the workflow without Shopify access

---

## Security Notes

- **Never commit your `.env` file** to version control
- The access token has full read access to your store data
- Use webhook signing verification in production
- Consider IP allowlisting for webhook endpoints


