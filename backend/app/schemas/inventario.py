from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


TipoMovimientoManual = Literal["venta", "ajuste"]


class MovimientoCreate(BaseModel):
    producto_id: int = Field(gt=0)
    tipo: TipoMovimientoManual
    cantidad: int = Field(
        description=(
            "Para venta, ingresa unidades como número positivo. "
            "Para ajuste, usa positivo para sumar o negativo para restar."
        )
    )


class MovimientoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    producto_id: int
    usuario_id: int
    deteccion_id: int | None
    tipo: str
    cantidad: int
    stock_antes: int
    stock_despues: int
    fecha_hora: datetime

    