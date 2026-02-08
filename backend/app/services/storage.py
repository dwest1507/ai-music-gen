import boto3
from botocore.exceptions import ClientError
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.enabled = bool(settings.STORAGE_ENDPOINT_URL and settings.STORAGE_ACCESS_KEY_ID)
        if self.enabled:
            self.s3_client = boto3.client(
                's3',
                endpoint_url=settings.STORAGE_ENDPOINT_URL,
                aws_access_key_id=settings.STORAGE_ACCESS_KEY_ID,
                aws_secret_access_key=settings.STORAGE_SECRET_ACCESS_KEY,
                region_name=settings.STORAGE_REGION
            )
            self.bucket = settings.STORAGE_BUCKET_NAME
        else:
            logger.warning("Object storage not configured. File uploads will be skipped or strictly local.")

    def upload_file(self, file_content: bytes, object_name: str, content_type: str = "audio/wav") -> bool:
        """Upload a file to S3 bucket"""
        if not self.enabled:
             logger.error("Cannot upload: Storage not configured.")
             return False
             
        try:
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=object_name,
                Body=file_content,
                ContentType=content_type
            )
            return True
        except ClientError as e:
            logger.error(f"Error uploading file: {e}")
            return False

    def generate_presigned_url(self, object_name: str, expiration=3600) -> str | None:
        """Generate a presigned URL to share an S3 object"""
        if not self.enabled:
            return None
            
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': object_name},
                ExpiresIn=expiration
            )
            return response
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {e}")
            return None

storage_service = StorageService()
