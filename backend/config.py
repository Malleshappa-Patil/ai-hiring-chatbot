"""
Application configuration using Pydantic Settings.
All values are loaded from environment variables or .env file.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ── Application ──────────────────────────────────────────────
    APP_NAME: str = "AI Hiring Chatbot"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # ── API ──────────────────────────────────────────────────────
    API_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ── Database (PostgreSQL) ─────────────────────────────────────
    POSTGRES_USER: str = "hiring_user"
    POSTGRES_PASSWORD: str = "root"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "hiring_db"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── Redis ─────────────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None

    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # ── JWT Auth ──────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "e127e4b1d61c4b4568c35733179e5ce490a00e41c2e739a681ca561e68e55437"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Google Gemini ─────────────────────────────────────────────
    GOOGLE_API_KEY: str = "enter-your-google-api-key"
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_TEMPERATURE: float = 0.3

    # ── HuggingFace Embeddings ────────────────────────────────────
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DEVICE: str = "cpu"  # or "cuda" if GPU available

    # ── ChromaDB ─────────────────────────────────────────────────
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "hiring_knowledge"

    # ── Email (fastapi-mail) ──────────────────────────────────────
    MAIL_USERNAME: str = "example@gmail.com"
    MAIL_PASSWORD: str = "enter-your-mail-password"
    MAIL_FROM: str = "example@gmail.com"
    MAIL_FROM_NAME: str = "AI Hiring Platform"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    MAIL_MOCK: bool = False  # Turned off mock mode so real emails will be sent!

    # ── LangSmith Observability ───────────────────────────────────
    LANGCHAIN_TRACING_V2: bool = True
    LANGCHAIN_API_KEY: str = "enter_your_langchain_api_key"
    LANGCHAIN_PROJECT: str = "ai-hiring-platform"
    LANGCHAIN_ENDPOINT: str = "https://api.smith.langchain.com"

    # ── Workflow ──────────────────────────────────────────────────
    MAX_JD_RETRIES: int = 3
    MIN_APPLICANT_COUNT: int = 10
    MAX_SOURCING_RETRIES: int = 2

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Singleton settings instance
settings = Settings()
