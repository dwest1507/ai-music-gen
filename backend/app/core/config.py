import os


class Settings:
    PROJECT_NAME: str = "AI Music Gen"
    API_V1_STR: str = "/api"

    # ACE-Step Modal API
    ACESTEP_API_URL: str = os.getenv("ACESTEP_API_URL", "")
    ACESTEP_API_KEY: str = os.getenv("ACESTEP_API_KEY", "")

    # Security
    SESSION_SECRET: str = os.getenv("SESSION_SECRET", "super-secret-key")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")


settings = Settings()
