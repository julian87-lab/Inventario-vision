from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    false,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Alerta(Base):
    __tablename__ = "alertas"
    __table_args__ = (
        CheckConstraint("tipo IN ('stock_bajo','sin_stock')", name="ck_alertas_tipo"),
        Index(
            "uq_alerta_pendiente",
            "producto_id",
            "tipo",
            unique=True,
            postgresql_where=text("NOT atendida"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    tipo: Mapped[str] = mapped_column(String(20))
    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    atendida: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false()
    )