from sqlalchemy import Boolean, CheckConstraint, Integer, SmallInteger, String, true
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Producto(Base):
    __tablename__ = "productos"
    __table_args__ = (
        CheckConstraint("clase_yolo >= 0", name="ck_productos_clase_yolo"),
        CheckConstraint("stock_actual >= 0", name="ck_productos_stock"),
        CheckConstraint("umbral_alerta >= 0", name="ck_productos_umbral"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    clase_yolo: Mapped[int] = mapped_column(SmallInteger, unique=True)
    nombre: Mapped[str] = mapped_column(String(150), unique=True)
    stock_actual: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    umbral_alerta: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())