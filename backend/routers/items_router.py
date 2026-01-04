from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import User
from auth import get_current_user
import httpx
from config import get_settings

router = APIRouter(prefix="/api/items", tags=["items"])
settings = get_settings()


def get_shopify_headers():
    """Get headers for Shopify API calls"""
    return {
        "X-Shopify-Access-Token": settings.shopify_access_token,
        "Content-Type": "application/json"
    }


def get_shopify_api_url(endpoint: str, api_version: str = "2024-01"):
    """Build Shopify Admin API URL"""
    shop_url = settings.shopify_shop_url.replace("https://", "").replace("http://", "").rstrip("/")
    return f"https://{shop_url}/admin/api/{api_version}/{endpoint}"


async def lookup_shopify_product(sku: str):
    """
    Lookup product from Shopify by SKU or Item ID
    Returns product details if found
    Searches multiple fields: SKU, barcode, and general search
    """
    if not all([settings.shopify_shop_url, settings.shopify_access_token]):
        # Development mode - return mock data
        return {
            "sku": sku,
            "liberty_item_id": sku.replace('-', '').upper(),
            "title": f"Sample Item ({sku})",
            "description": "This is sample data. Configure Shopify API to get real product info.",
            "image_url": None,
            "price": None,
            "inventory_quantity": None
        }
    
    try:
        headers = get_shopify_headers()
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Method 1: Try GraphQL search first (more efficient)
            graphql_url = get_shopify_api_url("graphql.json")
            graphql_query = """
            query searchProductBySku($query: String!) {
                products(first: 10, query: $query) {
                    edges {
                        node {
                            id
                            title
                            description
                            featuredImage {
                                url
                            }
                            images(first: 5) {
                                edges {
                                    node {
                                        url
                                    }
                                }
                            }
                            variants(first: 10) {
                                edges {
                                    node {
                                        id
                                        sku
                                        barcode
                                        price
                                        inventoryQuantity
                                    }
                                }
                            }
                        }
                    }
                }
            }
            """
            
            # Search with a combined query for speed (OR logic in single request)
            # This is much faster than sequential searches
            combined_query = f"sku:{sku} OR barcode:{sku} OR {sku}"
            
            graphql_response = await client.post(
                graphql_url,
                headers=headers,
                json={"query": graphql_query, "variables": {"query": combined_query}}
            )
            
            if graphql_response.status_code == 200:
                gql_data = graphql_response.json()
                products = gql_data.get('data', {}).get('products', {}).get('edges', [])
                
                for product_edge in products:
                    product = product_edge.get('node', {})
                    variants = product.get('variants', {}).get('edges', [])
                    
                    for variant_edge in variants:
                        variant = variant_edge.get('node', {})
                        variant_sku = variant.get('sku', '')
                        variant_barcode = variant.get('barcode', '')
                        
                        # Match by SKU, barcode, or if barcode contains the item ID
                        if (variant_sku == sku or 
                            variant_barcode == sku or 
                            sku in str(variant_barcode) or
                            sku in str(variant_sku)):
                            # Get all images
                            images = []
                            if product.get('featuredImage'):
                                images.append(product['featuredImage']['url'])
                            for img_edge in product.get('images', {}).get('edges', []):
                                img_url = img_edge.get('node', {}).get('url')
                                if img_url and img_url not in images:
                                    images.append(img_url)
                            
                            return {
                                "sku": variant_sku or sku,
                                "liberty_item_id": variant_barcode or sku,
                                "title": product.get('title', ''),
                                "description": product.get('description', ''),
                                "image_url": images[0] if images else None,
                                "images": images,
                                "price": variant.get('price'),
                                "inventory_quantity": variant.get('inventoryQuantity'),
                                "shopify_product_id": product.get('id', '').split('/')[-1],
                                "shopify_variant_id": variant.get('id', '').split('/')[-1]
                            }
            
            # Not found via GraphQL - return None immediately (no slow REST fallback)
            return None
                
    except Exception as e:
        print(f"Error looking up Shopify product: {e}")
        return None


@router.get("/shopify/status")
async def shopify_status(
    current_user: User = Depends(get_current_user)
):
    """
    Check Shopify API connection status (Admin only)
    """
    if current_user.role not in ['admin', 'scheduler']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if credentials are configured
    has_shop_url = bool(settings.shopify_shop_url)
    has_access_token = bool(settings.shopify_access_token)
    
    if not has_shop_url or not has_access_token:
        return {
            "connected": False,
            "status": "not_configured",
            "message": "Shopify credentials not configured",
            "details": {
                "shop_url_configured": has_shop_url,
                "access_token_configured": has_access_token
            }
        }
    
    # Test the connection
    try:
        headers = get_shopify_headers()
        url = get_shopify_api_url("shop.json")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                shop_data = response.json().get('shop', {})
                return {
                    "connected": True,
                    "status": "connected",
                    "message": "Successfully connected to Shopify",
                    "shop": {
                        "name": shop_data.get('name'),
                        "domain": shop_data.get('domain'),
                        "email": shop_data.get('email'),
                        "currency": shop_data.get('currency'),
                        "plan_name": shop_data.get('plan_name')
                    }
                }
            elif response.status_code == 401:
                return {
                    "connected": False,
                    "status": "unauthorized",
                    "message": "Invalid access token. Please check your Shopify API credentials."
                }
            elif response.status_code == 404:
                return {
                    "connected": False,
                    "status": "not_found",
                    "message": "Shop not found. Please check your shop URL."
                }
            else:
                return {
                    "connected": False,
                    "status": "error",
                    "message": f"Shopify API returned status {response.status_code}",
                    "details": response.text
                }
    except httpx.TimeoutException:
        return {
            "connected": False,
            "status": "timeout",
            "message": "Connection to Shopify timed out"
        }
    except Exception as e:
        return {
            "connected": False,
            "status": "error",
            "message": f"Error connecting to Shopify: {str(e)}"
        }


@router.get("/search")
async def search_items(
    q: str = Query(..., description="Search query (title, SKU, etc.)"),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    """
    Search products in Shopify by title, SKU, or other attributes
    """
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
    
    q = q.strip()
    
    if not all([settings.shopify_shop_url, settings.shopify_access_token]):
        # Development mode - return mock results
        return {
            "results": [
                {
                    "sku": f"MOCK-{q.upper()[:5]}-001",
                    "title": f"Sample Product matching '{q}'",
                    "image_url": None,
                    "price": "99.99"
                }
            ],
            "total": 1,
            "mock_data": True
        }
    
    try:
        headers = get_shopify_headers()
        graphql_url = get_shopify_api_url("graphql.json")
        
        # Use GraphQL for better search
        graphql_query = """
        query searchProducts($query: String!, $first: Int!) {
            products(first: $first, query: $query) {
                edges {
                    node {
                        id
                        title
                        featuredImage {
                            url
                        }
                        variants(first: 5) {
                            edges {
                                node {
                                    sku
                                    price
                                }
                            }
                        }
                    }
                }
            }
        }
        """
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                graphql_url,
                headers=headers,
                json={
                    "query": graphql_query,
                    "variables": {"query": q, "first": limit}
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                products = data.get('data', {}).get('products', {}).get('edges', [])
                
                results = []
                for edge in products:
                    product = edge.get('node', {})
                    variants = product.get('variants', {}).get('edges', [])
                    
                    # Get first variant with SKU
                    sku = None
                    price = None
                    for v_edge in variants:
                        variant = v_edge.get('node', {})
                        if variant.get('sku'):
                            sku = variant.get('sku')
                            price = variant.get('price')
                            break
                    
                    results.append({
                        "sku": sku,
                        "title": product.get('title'),
                        "image_url": product.get('featuredImage', {}).get('url') if product.get('featuredImage') else None,
                        "price": price,
                        "shopify_product_id": product.get('id', '').split('/')[-1]
                    })
                
                return {
                    "results": results,
                    "total": len(results),
                    "query": q
                }
            else:
                raise HTTPException(status_code=502, detail="Failed to search Shopify products")
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Search request timed out")
    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail="Error searching products")


@router.get("/lookup")
async def lookup_item(
    sku: str = Query(..., description="SKU or Item ID to lookup"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lookup item by SKU - used for scanning items during delivery creation
    Returns item details from Shopify or local database
    Handles barcode scanners that add leading zeros
    """
    if not sku:
        raise HTTPException(status_code=400, detail="SKU is required")
    
    # Clean up SKU (remove whitespace)
    sku = sku.strip()
    original_input = sku
    
    # Try multiple lookup strategies
    lookup_attempts = [sku]
    
    # Strategy 1: Strip leading zeros (barcodes often add 00 prefix)
    stripped_sku = sku.lstrip('0')
    if stripped_sku and stripped_sku != sku:
        lookup_attempts.append(stripped_sku)
    
    # Strategy 2: If it's all numeric, it might be an item number that needs SKU format
    # Some systems store as "363068" but SKU might be "3630-68" or similar
    if stripped_sku.isdigit() and len(stripped_sku) >= 4:
        # Try common SKU formats: XXXX-XX, XXX-XXX, etc.
        if len(stripped_sku) == 6:
            lookup_attempts.append(f"{stripped_sku[:4]}-{stripped_sku[4:]}")
            lookup_attempts.append(f"{stripped_sku[:3]}-{stripped_sku[3:]}")
        elif len(stripped_sku) == 7:
            lookup_attempts.append(f"{stripped_sku[:4]}-{stripped_sku[4:]}")
    
    # Try each lookup strategy
    for attempt_sku in lookup_attempts:
        item_data = await lookup_shopify_product(attempt_sku)
        
        if item_data:
            # Check inventory availability
            inventory_qty = item_data.get('inventory_quantity')
            
            # Item found - check if it's available
            if inventory_qty is not None and inventory_qty <= 0:
                return {
                    "found": True,
                    "available": False,
                    "item": item_data,
                    "message": "Item found but is not available (sold or out of stock)",
                    "inventory_status": {
                        "quantity": inventory_qty,
                        "status": "sold" if inventory_qty == 0 else "unavailable"
                    }
                }
            
            return {
                "found": True,
                "available": True,
                "item": item_data,
                "inventory_status": {
                    "quantity": inventory_qty,
                    "status": "available"
                }
            }
    
    # Return not found with the original input and what we tried
    return {
        "found": False,
        "available": False,
        "message": "Item not found. Please check the SKU or item number and try again.",
        "sku": original_input,
        "attempted_skus": lookup_attempts
    }





