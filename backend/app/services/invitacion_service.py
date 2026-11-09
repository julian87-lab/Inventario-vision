import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ..config import settings
from ..models import Invitacion, Usuario
from ..security import hash_password
from ..tokens import generar_token, hash_token
from .auditoria_service import registrar_evento

logger = logging.getLogger(__name__)

INVITACION_NO_VALIDA = (
    "La invitación no es válida o ya venció. Pide una nueva al administrador."
)


def _vigente(invitacion: Invitacion | None, ahora: datetime) -> bool:
    return (
        invitacion is not None
        and invitacion.usada_en is None
        and invitacion.revocada_en is None
        and invitacion.expira_en > ahora
    )


async def crear_invitacion(
    db,
    actor: Usuario,
    email: str,
    rol: str,
    reenvio: bool = False,
) -> tuple[Invitacion, str]:
    correo = email.strip().lower()
    ahora = datetime.now(timezone.utc)

    try:
        existente = await db.scalar(
            select(Usuario.id).where(Usuario.email == correo)
        )
        if existente is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un usuario con ese correo.",
            )

        await db.execute(
            update(Invitacion)
            .where(
                Invitacion.email == correo,
                Invitacion.usada_en.is_(None),
                Invitacion.revocada_en.is_(None),
            )
            .values(revocada_en=ahora)
        )

        token = generar_token()
        invitacion = Invitacion(
            email=correo,
            rol=rol,
            token_hash=hash_token(token),
            creada_por_id=actor.id,
            expira_en=ahora + timedelta(hours=settings.invitacion_expire_hours),
        )
        db.add(invitacion)
        await db.flush()

        registrar_evento(
            db,
            actor.id,
            "invitacion_reenviada" if reenvio else "invitacion_creada",
            "invitacion",
            invitacion.id,
            f"correo: {correo}; rol: {rol}",
        )

        await db.commit()
        await db.refresh(invitacion)
        return invitacion, token

    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya hay una invitación pendiente para ese correo. Inténtalo de nuevo.",
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Error de base de datos al crear la invitación")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo crear la invitación.",
        ) from exc


async def consultar_invitacion(db, token: str) -> Invitacion:
    ahora = datetime.now(timezone.utc)

    resultado = await db.execute(
        select(Invitacion).where(Invitacion.token_hash == hash_token(token))
    )
    invitacion = resultado.scalar_one_or_none()

    if not _vigente(invitacion, ahora):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVITACION_NO_VALIDA,
        )

    existente = await db.scalar(
        select(Usuario.id).where(Usuario.email == invitacion.email)
    )
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVITACION_NO_VALIDA,
        )

    return invitacion


async def registrar_con_invitacion(
    db,
    token: str,
    nombre: str,
    contrasena: str,
) -> Usuario:
    ahora = datetime.now(timezone.utc)

    try:
        resultado = await db.execute(
            select(Invitacion)
            .where(Invitacion.token_hash == hash_token(token))
            .with_for_update()
        )
        invitacion = resultado.scalar_one_or_none()

        if not _vigente(invitacion, ahora):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVITACION_NO_VALIDA,
            )

        existente = await db.scalar(
            select(Usuario.id).where(Usuario.email == invitacion.email)
        )
        if existente is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=INVITACION_NO_VALIDA,
            )

        usuario = Usuario(
            nombre=nombre,
            email=invitacion.email,
            password_hash=await run_in_threadpool(hash_password, contrasena),
            rol=invitacion.rol,
            activo=True,
        )
        db.add(usuario)
        await db.flush()

        invitacion.usada_en = ahora
        invitacion.usuario_id = usuario.id

        registrar_evento(
            db,
            usuario.id,
            "usuario_registrado",
            "usuario",
            usuario.id,
            f"rol: {usuario.rol}; invitación: {invitacion.id}",
        )

        await db.commit()
        return usuario

    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVITACION_NO_VALIDA,
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Error de base de datos al registrar un usuario")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo crear la cuenta.",
        ) from exc


async def listar_invitaciones(db, limite: int = 100) -> list[Invitacion]:
    resultado = await db.execute(
        select(Invitacion)
        .order_by(Invitacion.creada_en.desc(), Invitacion.id.desc())
        .limit(limite)
    )
    return list(resultado.scalars().all())


async def revocar_invitacion(db, actor: Usuario, invitacion_id: int) -> Invitacion:
    ahora = datetime.now(timezone.utc)

    try:
        resultado = await db.execute(
            select(Invitacion)
            .where(Invitacion.id == invitacion_id)
            .with_for_update()
        )
        invitacion = resultado.scalar_one_or_none()

        if invitacion is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró esa invitación.",
            )
        if invitacion.usada_en is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Esa invitación ya fue usada.",
            )
        if invitacion.revocada_en is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Esa invitación ya estaba revocada.",
            )

        invitacion.revocada_en = ahora
        registrar_evento(
            db,
            actor.id,
            "invitacion_revocada",
            "invitacion",
            invitacion.id,
            f"correo: {invitacion.email}",
        )

        await db.commit()
        return invitacion

    except HTTPException:
        await db.rollback()
        raise
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Error de base de datos al revocar la invitación")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo revocar la invitación.",
        ) from exc


async def reenviar_invitacion(
    db,
    actor: Usuario,
    invitacion_id: int,
) -> tuple[Invitacion, str]:
    anterior = await db.get(Invitacion, invitacion_id)

    if anterior is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró esa invitación.",
        )
    if anterior.usada_en is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esa invitación ya fue usada: la persona ya tiene cuenta.",
        )

    return await crear_invitacion(
        db, actor, anterior.email, anterior.rol, reenvio=True
    )
