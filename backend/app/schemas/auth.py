from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Rol = Literal["administrador", "operador"]
PATRON_EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    email: str
    rol: Rol


class SolicitudRecuperacion(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class RestablecerContrasena(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class MensajeOut(BaseModel):
    mensaje: str


class InvitacionConsulta(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class InvitacionInfo(BaseModel):
    email: str
    rol: Rol


class RegistroInvitacion(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    nombre: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, valor: str) -> str:
        valor = " ".join(valor.split())

        if len(valor) < 2:
            raise ValueError("El nombre es demasiado corto.")

        return valor


class CambiarContrasena(BaseModel):
    actual: str = Field(min_length=1, max_length=128)
    nueva: str = Field(min_length=8, max_length=128)


class ActualizarPerfil(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=2, max_length=120)

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, valor: object) -> object:
        if isinstance(valor, str):
            return " ".join(valor.split())

        return valor
    