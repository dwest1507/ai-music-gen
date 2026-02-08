# Object Storage Integration Guide (Implemented)

## Overview

This guide details how to implement object storage (AWS S3, Cloudflare R2, or Google Cloud Storage) for the AI Music Generator. This is **required** for production deployments where the Worker and API services run in separate environments (e.g., Railway). 

Currently, the Worker generates audio files and uploads them to the configured object storage (Cloudflare R2). The API generates presigned URLs for the frontend to download/stream the content.

## Prerequisites

1.  **Cloud Provider Account**: AWS, Cloudflare, or Google Cloud.
2.  **Storage Bucket**: A bucket created specifically for this project (e.g., `your-bucket-name`).
3.  **Credentials**: Access Key ID and Secret Access Key.

16: 
17: ## Status: Implemented
18: 
19: The integration supports generic S3 protocol (AWS S3, Cloudflare R2, MinIO).
20: 
21: ---
22: 
23: ## Implementation Details

We will use the generic S3 protocol, which is supported by AWS, Cloudflare R2, DigitalOcean Spaces, and MinIO. This avoids vendor lock-in.

### 1. New Environment Variables

Add the following variables to your `.env` (local) and Railway/Vercel (production):

```bash
# Object Storage Configuration
STORAGE_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com  # or AWS/GCS endpoint
STORAGE_ACCESS_KEY_ID=your_access_key
STORAGE_SECRET_ACCESS_KEY=your_secret_key
STORAGE_BUCKET_NAME=your-bucket-name
STORAGE_REGION=auto  # or specific region like us-east-1
```

### 2. Dependency Changes

Add `boto3` to `backend/requirements.txt`:
```text
boto3==1.34.0
```

### 3. Code Changes

#### A. Create Storage Service (`backend/app/services/storage.py`)

Create a new service module to handle S3 interactions:

```python
import boto3
from botocore.exceptions import ClientError
from app.core.config import settings

class StorageService:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.STORAGE_ENDPOINT_URL,
            aws_access_key_id=settings.STORAGE_ACCESS_KEY_ID,
            aws_secret_access_key=settings.STORAGE_SECRET_ACCESS_KEY,
            region_name=settings.STORAGE_REGION
        )
        self.bucket = settings.STORAGE_BUCKET_NAME

    def upload_file(self, file_content: bytes, object_name: str, content_type: str = "audio/wav"):
        """Upload a file to S3 bucket"""
        try:
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=object_name,
                Body=file_content,
                ContentType=content_type
            )
            return True
        except ClientError as e:
            print(f"Error uploading file: {e}")
            return False

    def generate_presigned_url(self, object_name: str, expiration=3600):
        """Generate a presigned URL to share an S3 object"""
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': object_name},
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            print(f"Error generating presigned URL: {e}")
            return None

storage_service = StorageService()
```

#### B. Update Configuration (`backend/app/core/config.py`)

Add the new storage variables to the `Settings` class.

#### C. Modify Worker Task (`backend/app/services/modal_client.py`)

Update `generate_music_task` to upload to S3 instead of saving locally:

```python
from app.services.storage import storage_service

# ... inside generate_music_task ...

# Call Modal
audio_bytes = f.remote(prompt, duration, genre)

# Upload to S3
filename = f"{job_id}.wav"
success = storage_service.upload_file(audio_bytes, filename)

if success:
    return {
        "status": "completed", 
        "storage_key": filename,
        "storage_type": "s3"
    }
else:
    raise Exception("Failed to upload generated audio to storage")
```

#### D. Modify API Endpoint (`backend/app/api/routes/generation.py`)

Update `download_audio` to redirect to the presigned URL:

```python
from fastapi.responses import RedirectResponse
from app.services.storage import storage_service

@router.get("/audio/{job_id}")
async def download_audio(job_id: str, request: Request):
    # ... (auth checks) ...
    
    result = job.result
    if not result or "storage_key" not in result:
         # Handle legacy local files if needed, or error
         raise HTTPException(status_code=404, detail="Audio file not found")
         
    # Generate presigned URL
    url = storage_service.generate_presigned_url(result["storage_key"])
    
    if not url:
        raise HTTPException(status_code=500, detail="Could not generate download URL")
        
    return RedirectResponse(url)
```

## Migration Plan

1.  **Phase 1 (Preparation)**: Set up the bucket and environment variables.
2.  **Phase 2 (Implementation)**: Deploy the updated backend code with `boto3` and the new service.
3.  **Phase 3 (Cleanup)**: Remove local file handling code once confirmed working.

---

**Note**: For development, you can use MinIO (a local S3-compatible server) via Docker, or simply mock the storage service to save files locally if `STORAGE_ENDPOINT_URL` is not set.
