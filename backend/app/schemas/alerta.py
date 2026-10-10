from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class AlertaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    producto_id: int
    tipo: Literal["stock_bajo", "sin_stock"]
    fecha_hora: datetime
    atendida: bool

    