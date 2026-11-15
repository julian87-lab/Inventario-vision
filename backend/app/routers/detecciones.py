from pathlib import Path

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse

from ..config import settings
from ..deps import CurrentUser, DbSession
from ..models import Deteccion
from ..schemas.deteccion import (
    AgregarItemDeteccion,
    ConfirmarDeteccion,
    DescartarDeteccion,
    DeteccionRead,
)
from ..services.deteccion_service import (
    agregar_item_manual,
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

TIPOS_IMAGEN = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


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
    return await listar_detecciones(db, limite, usuario)


@router.get("/{deteccion_id}", response_model=DeteccionRead)
async def obtener_deteccion_por_id(
    deteccion_id: int,
    db: DbSession,
    usuario: CurrentUser,
) -> Deteccion:
    return await obtener_deteccion(db, deteccion_id, usuario)


@router.get("/{deteccion_id}/imagen")
async def obtener_imagen_deteccion(
    deteccion_id: int,
    db: DbSession,
    usuario: CurrentUser,
) -> FileResponse:
    # El mismo alcance que la detección: operador, la suya; administrador, todas.
    deteccion = await obtener_deteccion(db, deteccion_id, usuario)

    nombre_archivo = Path(deteccion.imagen_url).name
    carpeta_imagenes = Path(settings.upload_dir).resolve()
    ruta_imagen = (carpeta_imagenes / nombre_archivo).resolve()

    if carpeta_imagenes not in ruta_imagen.parents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró el archivo de imagen.",
        )

    if not ruta_imagen.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró el archivo de imagen.",
        )

    media_type = TIPOS_IMAGEN.get(ruta_imagen.suffix.lower())

    if media_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró el archivo de imagen.",
        )

    return FileResponse(
        ruta_imagen,
        media_type=media_type,
    )


@router.post(
    "/{deteccion_id}/items",
    response_model=DeteccionRead,
    status_code=status.HTTP_201_CREATED,
)
async def agregar_producto_manual(
    deteccion_id: int,
    datos: AgregarItemDeteccion,
    db: DbSession,
    usuario: CurrentUser,
) -> Deteccion:
    return await agregar_item_manual(
        db=db,
        deteccion_id=deteccion_id,
        datos=datos,
        usuario=usuario,
    )


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
        usuario=usuario,
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
    return await descartar_deteccion(db, deteccion_id, usuario)
