from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Movimiento(Base):
    __tablename__ = "movimientos_inventario"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('entrada_deteccion','venta','ajuste')", name="ck_mov_tipo"
        ),
        CheckConstraint("cantidad <> 0", name="ck_mov_cantidad"),
        CheckConstraint("stock_despues >= 0", name="ck_mov_stock_no_negativo"),
        CheckConstraint(
            "stock_despues = stock_antes + cantidad", name="ck_mov_aritmetica"
        ),
        CheckConstraint(
            "(tipo = 'entrada_deteccion') = (deteccion_id IS NOT NULL)",
            name="ck_mov_deteccion",
        ),
        CheckConstraint(
            "(tipo = 'entrada_deteccion' AND cantidad > 0) "
            "OR (tipo = 'venta' AND cantidad < 0) "
            "OR tipo = 'ajuste'",
            name="ck_mov_signo",
        ),
        Index("ix_mov_producto_fecha", "producto_id", "fecha_hora"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    deteccion_id: Mapped[int | None] = mapped_column(ForeignKey("detecciones.id"))
    tipo: Mapped[str] = mapped_column(String(30))
    cantidad: Mapped[int] = mapped_column(Integer)
    stock_antes: Mapped[int] = mapped_column(Integer)
    stock_despues: Mapped[int] = mapped_column(Integer)
    fecha_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )