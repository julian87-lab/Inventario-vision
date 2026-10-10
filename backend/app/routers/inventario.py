from fastapi import APIRouter, Query, status

from ..deps import CurrentUser, DbSession
from ..models import Movimiento
from ..schemas.inventario import MovimientoCreate, MovimientoRead
from ..services.inventario_service import (
    listar_movimientos,
    registrar_movimiento,
)


router = APIRouter(
    prefix="/inventario",
    tags=["inventario"],
)


@router.post(
    "/movimientos",
    response_model=MovimientoRead,
    status_code=status.HTTP_201_CREATED,
)
async def crear_movimiento(
    datos: MovimientoCreate,
    db: DbSession,
    usuario: CurrentUser,
) -> Movimiento:
    return await registrar_movimiento(
        db=db,
        datos=datos,
        usuario_id=usuario.id,
    )


@router.get(
    "/movimientos",
    response_model=list[MovimientoRead],
)
async def obtener_movimientos(
    db: DbSession,
    usuario: CurrentUser,
    producto_id: int | None = Query(default=None, gt=0),
    limite: int = Query(default=100, ge=1, le=500),
) -> list[Movimiento]:
    return await listar_movimientos(
        db=db,
        producto_id=producto_id,
        limite=limite,
    )

