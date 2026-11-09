from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from .auth import PATRON_EMAIL, Rol


class UsuarioAdminRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    email: str
    rol: Rol
    activo: bool
    creado_en: datetime


class UsuarioAdminUpdate(BaseModel):
    rol: Rol | None = None
    activo: bool | None = None

    @model_validator(mode="after")
    def exigir_un_cambio(self) -> "UsuarioAdminUpdate":
        if self.rol is None and self.activo is None:
            raise ValueError("Indica al menos un cambio.")
        return self


class InvitacionCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255, pattern=PATRON_EMAIL)
    rol: Rol = "operador"

    @field_validator("email", mode="before")
    @classmethod
    def normalizar_email(cls, valor: object) -> object:
        return valor.strip().lower() if isinstance(valor, str) else valor


class InvitacionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    rol: Rol
    estado: Literal["pendiente", "usada", "revocada", "vencida"]
    creada_por_id: int
    creada_en: datetime
    expira_en: datetime
    usada_en: datetime | None
    revocada_en: datetime | None


class AuditoriaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    usuario_id: int | None
    accion: str
    objeto_tipo: str
    objeto_id: int | None
    detalle: str | None
    fecha_hora: datetime
    