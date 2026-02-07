import os

class Settings:
    PROJECT_NAME: str = "AI Music Gen"
    API_V1_STR: str = "/api"
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Modal
    MODAL_TOKEN_ID: str = os.getenv("MODAL_TOKEN_ID", "")
    MODAL_TOKEN_SECRET: str = os.getenv("MODAL_TOKEN_SECRET", "")
    
    # Security
    SESSION_SECRET: str = os.getenv("SESSION_SECRET", "super-secret-key")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

settings = Settings()
