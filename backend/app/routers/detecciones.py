from fastapi import APIRouter, File, Query, UploadFile, status

from ..deps import CurrentUser, DbSession
from ..models import Deteccion
from ..schemas.deteccion import (
    ConfirmarDeteccion,
    DescartarDeteccion,
    DeteccionRead,
)
from ..services.deteccion_service import (
    confirmar_deteccion,
    crear_deteccion,
    descartar_deteccion,
    listar_detecciones,
    obtener_deteccion,
)


router = APIRouter(
    prefix="/detecciones",
    tags=["detecciones"],
)


@router.post(
    "",
    response_model=DeteccionRead,
    status_code=status.HTTP_201_CREATED,
)
async def subir_imagen(
    db: DbSession,
    usuario: CurrentUser,
    file: UploadFile = File(...),
) -> Deteccion:
    return await crear_deteccion(
        db=db,
        file=file,
        usuario_id=usuario.id,
    )


@router.get("", response_model=list[DeteccionRead])
async def obtener_detecciones(
    db: DbSession,
    usuario: CurrentUser,
    limite: int = Query(default=100, ge=1, le=500),
) -> list[Deteccion]:
    return await listar_detecciones(db, limite)


@router.get("/{deteccion_id}", response_model=DeteccionRead)
async def obtener_deteccion_por_id(
    deteccion_id: int,
    db: DbSession,
    usuario: CurrentUser,
) -> Deteccion:
    return await obtener_deteccion(db, deteccion_id)


@router.post(
    "/{deteccion_id}/confirmar",
    response_model=DeteccionRead,
)
async def confirmar(
    deteccion_id: int,
    datos: ConfirmarDeteccion,
    db: DbSession,
    usuario: CurrentUser,
) -> Deteccion:
    return await confirmar_deteccion(
        db=db,
        deteccion_id=deteccion_id,
        datos=datos,
        usuario_id=usuario.id,
    )


@router.post(
    "/{deteccion_id}/descartar",
    response_model=DeteccionRead,
)
async def descartar(
    deteccion_id: int,
    datos: DescartarDeteccion,
    db: DbSession,
    usuario: CurrentUser,
) -> Deteccion:
    return await descartar_deteccion(db, deteccion_id)
