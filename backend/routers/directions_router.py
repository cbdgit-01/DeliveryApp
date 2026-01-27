import os
import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/directions", tags=["directions"])

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")


class ETAResponse(BaseModel):
    duration: str
    distance: str | None = None
    status: str


@router.get("/eta", response_model=ETAResponse)
async def get_eta(
    origin_lat: float = Query(..., description="Origin latitude"),
    origin_lng: float = Query(..., description="Origin longitude"),
    destination: str = Query(..., description="Destination address"),
):
    """
    Get ETA from origin coordinates to destination address using Google Maps Distance Matrix API.
    This endpoint proxies the request to avoid CORS issues in the browser.
    """
    if not GOOGLE_MAPS_API_KEY:
        # Return fallback if no API key configured
        return ETAResponse(
            duration="approximately 20-30 minutes",
            distance=None,
            status="fallback"
        )

    try:
        url = "https://maps.googleapis.com/maps/api/distancematrix/json"
        params = {
            "origins": f"{origin_lat},{origin_lng}",
            "destinations": destination,
            "key": GOOGLE_MAPS_API_KEY,
            "units": "imperial",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=10.0)
            response.raise_for_status()
            data = response.json()

        if data.get("status") != "OK":
            raise HTTPException(
                status_code=400,
                detail=f"Google Maps API error: {data.get('status')}"
            )

        element = data.get("rows", [{}])[0].get("elements", [{}])[0]

        if element.get("status") != "OK":
            raise HTTPException(
                status_code=400,
                detail=f"Route calculation failed: {element.get('status')}"
            )

        return ETAResponse(
            duration=element.get("duration", {}).get("text", "unknown"),
            distance=element.get("distance", {}).get("text"),
            status="ok"
        )

    except httpx.TimeoutException:
        return ETAResponse(
            duration="approximately 20-30 minutes",
            distance=None,
            status="timeout"
        )
    except httpx.HTTPError as e:
        return ETAResponse(
            duration="approximately 20-30 minutes",
            distance=None,
            status="error"
        )
    except Exception as e:
        return ETAResponse(
            duration="approximately 20-30 minutes",
            distance=None,
            status="error"
        )
