from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Inventario Vision API"
    environment: str = "development"
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    upload_dir: str = "backend/uploads"

    detector: Literal["stub", "yolo"] = "stub"
    yolo_model_path: str = "backend/weights/best.pt"
    yolo_confidence: float = Field(default=0.50, ge=0.0, le=1.0)

    frontend_url: str = "http://localhost:5173"
    password_reset_expire_minutes: int = Field(default=30, ge=5, le=120)
    invitacion_expire_hours: int = Field(default=72, ge=1, le=336)

    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_starttls: bool = True
    smtp_ssl: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validar_configuracion(self) -> "Settings":
        if self.smtp_host and not self.smtp_from:
            raise ValueError(
                "SMTP_FROM es obligatorio cuando se configura SMTP_HOST."
            )

        if self.environment.strip().lower() == "production":
            if (
                len(self.jwt_secret_key) < 32
                or "cambia" in self.jwt_secret_key.lower()
            ):
                raise ValueError(
                    "En producción JWT_SECRET_KEY debe ser aleatoria y "
                    "tener al menos 32 caracteres."
                )
            if not self.frontend_url.startswith("https://"):
                raise ValueError(
                    "En producción FRONTEND_URL debe comenzar con https://."
                )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

