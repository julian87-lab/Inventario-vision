from pydantic import BaseModel, ConfigDict


class ProductoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clase_yolo: int
    nombre: str
    stock_actual: int
    umbral_alerta: int
    activo: bool

    