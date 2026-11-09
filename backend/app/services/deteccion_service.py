import logging
from collections import defaultdict
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import selectinload

from ..config import settings
from ..inference import Detector, StubDetector
from ..models import (
    Deteccion,
    DeteccionItem,
    Movimiento,
    Producto,
    Usuario,
)
from ..schemas.deteccion import ConfirmarDeteccion
from .alerta_service import sincronizar_alerta_producto

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 10 * 1024 * 1024

ALLOWED_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


@lru_cache
def _crear_detector_yolo() -> Detector:
    from ..inference.yolo_detector import YoloDetector

    return YoloDetector(
        model_path=settings.yolo_model_path,
        confianza=settings.yolo_confidence,
    )


def get_detector() -> Detector:
    if settings.detector == "yolo":
        return _crear_detector_yolo()

    return StubDetector()


def _aplicar_alcance(consulta, usuario: Usuario):
    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está desactivada.",
        )

    if usuario.rol == "administrador":
        return consulta

    if usuario.rol == "operador":
        return consulta.where(Deteccion.usuario_id == usuario.id)

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tienes permiso para gestionar detecciones.",
    )


def _eliminar_imagen_si_existe(ruta: Path) -> None:
    try:
        ruta.unlink(missing_ok=True)
    except OSError:
        logger.exception(
            "No se pudo eliminar una imagen tras fallar la detección"
        )


async def guardar_imagen(file: UploadFile) -> tuple[Path, str]:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    contents = await file.read(MAX_IMAGE_BYTES + 1)

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )

    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen no puede superar 10 MB.",
        )

    try:
        with Image.open(BytesIO(contents)) as image:
            image_format = image.format
            image.verify()

    except (
        UnidentifiedImageError,
        OSError,
        EOFError,
        ValueError,
        Image.DecompressionBombError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="El archivo no es una imagen válida compatible.",
        ) from exc

    if image_format == "MPO":
        try:
            with Image.open(BytesIO(contents)) as image:
                image.seek(0)
                imagen_rgb = ImageOps.exif_transpose(image).convert("RGB")

                with BytesIO() as buffer:
                    imagen_rgb.save(
                        buffer,
                        format="JPEG",
                        quality=95,
                    )
                    contents = buffer.getvalue()

            image_format = "JPEG"

        except (
            UnidentifiedImageError,
            OSError,
            EOFError,
            ValueError,
            Image.DecompressionBombError,
        ) as exc:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="No se pudo convertir la imagen MPO a JPEG.",
            ) from exc

    extension = ALLOWED_FORMATS.get(image_format or "")

    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Formato detectado: {image_format!r}. "
                "Permitidos: JPEG, PNG o WebP."
            ),
        )

    filename = f"{uuid4().hex}{extension}"
    destination = upload_dir / filename

    try:
        await run_in_threadpool(destination.write_bytes, contents)
    except OSError as exc:
        _eliminar_imagen_si_existe(destination)
        logger.exception("No se pudo guardar la imagen")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo guardar la imagen.",
        ) from exc

    return destination, f"/uploads/{filename}"


async def crear_deteccion(
    db,
    file: UploadFile,
    usuario_id: int,
) -> Deteccion:
    image_path, image_url = await guardar_imagen(file)
    guardada_en_bd = False

    try:
        detector = await run_in_threadpool(get_detector)
        resultados = await run_in_threadpool(
            detector.detectar,
            str(image_path),
        )

        confianzas_por_clase: dict[int, list[float]] = defaultdict(list)

        for resultado in resultados:
            if (
                0 <= resultado.clase_yolo <= 9
                and 0.0 <= resultado.confianza <= 1.0
            ):
                confianzas_por_clase[resultado.clase_yolo].append(
                    resultado.confianza
                )

        clases = list(confianzas_por_clase)
        productos_por_clase: dict[int, Producto] = {}

        if clases:
            query_productos = await db.execute(
                select(Producto).where(
                    Producto.clase_yolo.in_(clases),
                    Producto.activo.is_(True),
                )
            )

            productos_por_clase = {
                producto.clase_yolo: producto
                for producto in query_productos.scalars().all()
            }

        deteccion = Deteccion(
            usuario_id=usuario_id,
            imagen_url=image_url,
            modelo_version=detector.version,
            estado="pendiente",
        )
        db.add(deteccion)

        await db.flush()
        deteccion_id = deteccion.id

        for clase_yolo, confianzas in confianzas_por_clase.items():
            producto = productos_por_clase.get(clase_yolo)

            if producto is None:
                continue

            db.add(
                DeteccionItem(
                    deteccion_id=deteccion_id,
                    producto_id=producto.id,
                    cantidad_detectada=len(confianzas),
                    confianza=sum(confianzas) / len(confianzas),
                    cantidad_confirmada=None,
                )
            )

        await db.commit()
        guardada_en_bd = True

        query_deteccion = await db.execute(
            select(Deteccion)
            .options(selectinload(Deteccion.items))
            .where(Deteccion.id == deteccion_id)
        )

        return query_deteccion.scalar_one()

    except HTTPException:
        await db.rollback()

        if not guardada_en_bd:
            _eliminar_imagen_si_existe(image_path)

        raise

    except Exception as exc:
        await db.rollback()

        if not guardada_en_bd:
            _eliminar_imagen_si_existe(image_path)

        logger.exception("Error al crear la detección")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo procesar la imagen para detección.",
        ) from exc


async def obtener_deteccion(
    db,
    deteccion_id: int,
    usuario: Usuario,
) -> Deteccion:
    consulta = (
        select(Deteccion)
        .options(selectinload(Deteccion.items))
        .where(Deteccion.id == deteccion_id)
    )
    consulta = _aplicar_alcance(consulta, usuario)

    resultado = await db.execute(consulta)
    deteccion = resultado.scalar_one_or_none()

    if deteccion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró esa detección.",
        )

    return deteccion


async def listar_detecciones(
    db,
    limite: int,
    usuario: Usuario,
) -> list[Deteccion]:
    consulta = select(Deteccion).options(
        selectinload(Deteccion.items)
    )
    consulta = _aplicar_alcance(consulta, usuario)
    consulta = consulta.order_by(
        Deteccion.fecha_hora.desc(),
        Deteccion.id.desc(),
    ).limit(limite)

    resultado = await db.execute(consulta)
    return list(resultado.scalars().all())


async def _cargar_deteccion_para_actualizar(
    db,
    deteccion_id: int,
    usuario: Usuario,
) -> Deteccion:
    consulta = (
        select(Deteccion)
        .options(selectinload(Deteccion.items))
        .where(Deteccion.id == deteccion_id)
    )
    consulta = _aplicar_alcance(consulta, usuario)
    consulta = consulta.with_for_update()

    resultado = await db.execute(consulta)
    deteccion = resultado.scalar_one_or_none()

    if deteccion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró esa detección.",
        )

    if deteccion.estado != "pendiente":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se pueden modificar detecciones pendientes.",
        )

    return deteccion


async def confirmar_deteccion(
    db,
    deteccion_id: int,
    datos: ConfirmarDeteccion,
    usuario: Usuario,
) -> Deteccion:
    try:
        deteccion = await _cargar_deteccion_para_actualizar(
            db,
            deteccion_id,
            usuario,
        )

        items_por_producto = {
            item.producto_id: item
            for item in deteccion.items
        }

        confirmaciones: dict[int, int] = {}

        for item_confirmado in datos.items:
            producto_id = item_confirmado.producto_id

            if producto_id not in items_por_producto:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        "La confirmación incluye un producto que no pertenece "
                        "a esta detección."
                    ),
                )

            if producto_id in confirmaciones:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="No repitas productos en la confirmación.",
                )

            confirmaciones[producto_id] = (
                item_confirmado.cantidad_confirmada
            )

        ids_productos = list(items_por_producto)
        productos: dict[int, Producto] = {}

        if ids_productos:
            resultado_productos = await db.execute(
                select(Producto)
                .where(
                    Producto.id.in_(ids_productos),
                    Producto.activo.is_(True),
                )
                .order_by(Producto.id)
                .with_for_update()
            )

            productos = {
                producto.id: producto
                for producto in resultado_productos.scalars().all()
            }

        for item in deteccion.items:
            cantidad = confirmaciones.get(item.producto_id, 0)
            item.cantidad_confirmada = cantidad

            if cantidad == 0:
                continue

            producto = productos.get(item.producto_id)

            if producto is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Un producto de la detección ya no está activo."
                    ),
                )

            stock_antes = producto.stock_actual
            stock_despues = stock_antes + cantidad
            producto.stock_actual = stock_despues

            db.add(
                Movimiento(
                    producto_id=producto.id,
                    usuario_id=usuario.id,
                    deteccion_id=deteccion.id,
                    tipo="entrada_deteccion",
                    cantidad=cantidad,
                    stock_antes=stock_antes,
                    stock_despues=stock_despues,
                )
            )

            await sincronizar_alerta_producto(db, producto)

        deteccion.estado = "confirmada"
        await db.commit()

        return await obtener_deteccion(
            db,
            deteccion_id,
            usuario,
        )

    except HTTPException:
        await db.rollback()
        raise

    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception(
            "Error de base de datos al confirmar la detección"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo confirmar la detección.",
        ) from exc


async def descartar_deteccion(
    db,
    deteccion_id: int,
    usuario: Usuario,
) -> Deteccion:
    try:
        deteccion = await _cargar_deteccion_para_actualizar(
            db,
            deteccion_id,
            usuario,
        )

        deteccion.estado = "descartada"
        await db.commit()

        return await obtener_deteccion(
            db,
            deteccion_id,
            usuario,
        )

    except HTTPException:
        await db.rollback()
        raise

    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception(
            "Error de base de datos al descartar la detección"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo descartar la detección.",
        ) from exc
    