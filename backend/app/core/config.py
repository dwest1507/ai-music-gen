import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PROJECT_NAME: str = "AI Music Gen"
    API_V1_STR: str = "/api"

    # ACE-Step Modal API
    ACESTEP_API_URL: str = os.getenv("ACESTEP_API_URL", "")
    ACESTEP_API_KEY: str = os.getenv("ACESTEP_API_KEY", "")

    # Security
    SESSION_SECRET: str = os.getenv("SESSION_SECRET", "super-secret-key")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Groq API
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


settings = Settings()
