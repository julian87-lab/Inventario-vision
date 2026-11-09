from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Integer,
    String,
    func,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base

ROL_ADMINISTRADOR = "administrador"
ROL_OPERADOR = "operador"


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint(
            "rol IN ('administrador','operador')", name="ck_usuarios_rol"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    rol: Mapped[str] = mapped_column(
        String(20), default=ROL_OPERADOR, server_default=ROL_OPERADOR
    )
    activo: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true()
    )
    token_version: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    