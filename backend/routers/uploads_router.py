from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from typing import List
import os
import uuid
import shutil

from auth import get_current_user
from models import User

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

# Create uploads directory if it doesn't exist
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Allowed file extensions
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def validate_file(file: UploadFile):
    """Validate uploaded file"""
    # Check extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    return ext


@router.post("/images")
async def upload_images(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload one or more images and return their URLs"""
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files allowed per upload")
    
    uploaded_urls = []
    
    for file in files:
        # Validate file
        ext = validate_file(file)
        
        # Generate unique filename
        unique_id = str(uuid.uuid4())
        filename = f"{unique_id}{ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        try:
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Generate URL (relative path that will be served)
            url = f"/api/uploads/images/{filename}"
            uploaded_urls.append(url)
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        finally:
            file.file.close()
    
    return {"urls": uploaded_urls}


@router.get("/images/{filename}")
async def get_image(filename: str):
    """Serve an uploaded image"""
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Validate filename to prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    return FileResponse(file_path)


@router.delete("/images/{filename}")
async def delete_image(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Delete an uploaded image"""
    # Validate filename
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        os.remove(file_path)
        return {"message": "Image deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

