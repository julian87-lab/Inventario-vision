from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Deteccion(Base):
    __tablename__ = "detecciones"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('pendiente','confirmada','descartada')",
            name="ck_detecciones_estado",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), index=True)
    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    imagen_url: Mapped[str] = mapped_column(String(500))
    modelo_version: Mapped[str] = mapped_column(String(50))
    estado: Mapped[str] = mapped_column(
        String(20), default="pendiente", server_default="pendiente"
    )

    items: Mapped[list["DeteccionItem"]] = relationship(
        back_populates="deteccion", cascade="all, delete-orphan"
    )


class DeteccionItem(Base):
    __tablename__ = "detecciones_items"
    __table_args__ = (
        UniqueConstraint("deteccion_id", "producto_id", name="uq_deteccion_producto"),
        CheckConstraint("cantidad_detectada >= 0", name="ck_item_detectada"),
        CheckConstraint("confianza BETWEEN 0 AND 1", name="ck_item_confianza"),
        CheckConstraint("cantidad_confirmada >= 0", name="ck_item_confirmada"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    deteccion_id: Mapped[int] = mapped_column(
        ForeignKey("detecciones.id", ondelete="CASCADE")
    )
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    cantidad_detectada: Mapped[int] = mapped_column(Integer)
    confianza: Mapped[float | None] = mapped_column(Float)
    cantidad_confirmada: Mapped[int | None] = mapped_column(Integer)

    deteccion: Mapped["Deteccion"] = relationship(back_populates="items")