from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webm", ".mov"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload attachment file"""
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 50MB allowed.")
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed. Use images/videos.")
    
    file_id = str(uuid.uuid4())
    file_name = f"{file_id}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {"url": f"/api/uploads/{file_name}", "filename": file.filename}