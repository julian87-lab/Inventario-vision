from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DeteccionItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    producto_id: int
    cantidad_detectada: int
    confianza: float | None
    cantidad_confirmada: int | None


class DeteccionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    usuario_id: int
    fecha_hora: datetime
    imagen_url: str
    modelo_version: str
    estado: Literal["pendiente", "confirmada", "descartada"]
    items: list[DeteccionItemRead]


class DeteccionItemConfirmacion(BaseModel):
    producto_id: int = Field(gt=0)
    cantidad_confirmada: int = Field(ge=0)


class AgregarItemDeteccion(BaseModel):
    producto_id: int = Field(gt=0)
    cantidad: int = Field(ge=1)


class ConfirmarDeteccion(BaseModel):
    items: list[DeteccionItemConfirmacion] = Field(min_length=1)


class DescartarDeteccion(BaseModel):
    motivo: str | None = Field(default=None, max_length=300)
