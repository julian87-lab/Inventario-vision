from fastapi import APIRouter
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import Producto
from ..schemas.producto import ProductoRead


router = APIRouter(
    prefix="/productos",
    tags=["productos"],
)


@router.get("", response_model=list[ProductoRead])
async def listar_productos(
    db: DbSession,
    usuario: CurrentUser,
) -> list[Producto]:
    resultado = await db.execute(
        select(Producto)
        .where(Producto.activo.is_(True))
        .order_by(Producto.clase_yolo)
    )
    return list(resultado.scalars().all())

