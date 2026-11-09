import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import SQLAlchemyError

from ..config import settings
from ..database import AsyncSessionLocal
from ..models import PasswordResetToken, Usuario
from ..security import hash_password
from .auditoria_service import registrar_evento
from .correo_service import enviar_correo_recuperacion

logger = logging.getLogger(__name__)

MAX_SOLICITUDES_POR_HORA = 3
ENLACE_NO_VALIDO = "El enlace no es válido o ya venció. Solicita uno nuevo."


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def solicitar_recuperacion(email: str) -> None:
    """Procesa la solicitud en segundo plano y registra los errores."""
    try:
        correo = email.strip().lower()
        ahora = datetime.now(timezone.utc)

        async with AsyncSessionLocal() as db:
            await db.execute(
                delete(PasswordResetToken).where(
                    PasswordResetToken.expira_en < ahora - timedelta(days=1)
                )
            )

            resultado = await db.execute(
                select(Usuario).where(
                    Usuario.email == correo,
                    Usuario.activo.is_(True),
                )
            )
            usuario = resultado.scalar_one_or_none()

            if usuario is None:
                await db.commit()
                return

            recientes = await db.scalar(
                select(func.count())
                .select_from(PasswordResetToken)
                .where(
                    PasswordResetToken.usuario_id == usuario.id,
                    PasswordResetToken.creado_en > ahora - timedelta(hours=1),
                )
            )

            if (recientes or 0) >= MAX_SOLICITUDES_POR_HORA:
                await db.commit()
                logger.warning(
                    "Límite de solicitudes de recuperación alcanzado "
                    "para el usuario %s",
                    usuario.id,
                )
                return

            token = secrets.token_urlsafe(32)

            db.add(
                PasswordResetToken(
                    usuario_id=usuario.id,
                    token_hash=_hash_token(token),
                    expira_en=ahora
                    + timedelta(
                        minutes=settings.password_reset_expire_minutes
                    ),
                )
            )

            destino = usuario.email
            nombre = usuario.nombre

            await db.commit()

        enlace = (
            f"{settings.frontend_url.rstrip('/')}"
            f"/restablecer-contrasena#token={token}"
        )

        await enviar_correo_recuperacion(destino, nombre, enlace)

    except Exception:
        logger.exception(
            "No se pudo procesar la solicitud de recuperación"
        )


async def restablecer_contrasena(
    db,
    token: str,
    nueva_contrasena: str,
) -> tuple[str, str]:
    try:
        ahora = datetime.now(timezone.utc)

        resultado = await db.execute(
            select(PasswordResetToken)
            .where(
                PasswordResetToken.token_hash == _hash_token(token)
            )
            .with_for_update()
        )
        registro = resultado.scalar_one_or_none()

        if (
            registro is None
            or registro.usado_en is not None
            or registro.expira_en <= ahora
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ENLACE_NO_VALIDO,
            )

        usuario = await db.get(
            Usuario,
            registro.usuario_id,
            with_for_update=True,
        )

        if usuario is None or not usuario.activo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ENLACE_NO_VALIDO,
            )

        usuario.password_hash = await run_in_threadpool(
            hash_password,
            nueva_contrasena,
        )
        usuario.token_version += 1

        await db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.usuario_id == usuario.id,
                PasswordResetToken.usado_en.is_(None),
            )
            .values(usado_en=ahora)
        )

        registrar_evento(
            db,
            usuario.id,
            "contrasena_restablecida",
            "usuario",
            usuario.id,
            "mediante enlace de recuperación",
        )

        destino = usuario.email
        nombre = usuario.nombre

        await db.commit()

        return destino, nombre

    except HTTPException:
        await db.rollback()
        raise

    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception(
            "Error de base de datos al restablecer la contraseña"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo restablecer la contraseña.",
        ) from exc
    