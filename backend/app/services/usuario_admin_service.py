import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from ..models import Usuario
from ..schemas.admin import UsuarioAdminUpdate
from .auditoria_service import registrar_evento

logger = logging.getLogger(__name__)


async def listar_usuarios(db) -> list[Usuario]:
    resultado = await db.execute(select(Usuario).order_by(Usuario.id))
    return list(resultado.scalars().all())


async def actualizar_usuario(
    db,
    actor: Usuario,
    usuario_id: int,
    datos: UsuarioAdminUpdate,
) -> Usuario:
    if usuario_id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No puedes cambiar tu propio rol ni desactivar tu propia cuenta.",
        )

    try:
        # Bloquea a los administradores activos para evitar que dos
        # cambios simultáneos dejen el sistema sin administrador.
        await db.execute(
            select(Usuario.id)
            .where(Usuario.rol == "administrador", Usuario.activo.is_(True))
            .order_by(Usuario.id)
            .with_for_update()
        )

        resultado = await db.execute(
            select(Usuario).where(Usuario.id == usuario_id).with_for_update()
        )
        objetivo = resultado.scalar_one_or_none()

        if objetivo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró ese usuario.",
            )

        rol_anterior = objetivo.rol
        activo_anterior = objetivo.activo
        nuevo_rol = datos.rol if datos.rol is not None else rol_anterior
        nuevo_activo = datos.activo if datos.activo is not None else activo_anterior

        if nuevo_rol == rol_anterior and nuevo_activo == activo_anterior:
            return objetivo

        era_admin_activo = rol_anterior == "administrador" and activo_anterior
        seguira_siendo = nuevo_rol == "administrador" and nuevo_activo

        if era_admin_activo and not seguira_siendo:
            otros = await db.scalar(
                select(func.count())
                .select_from(Usuario)
                .where(
                    Usuario.rol == "administrador",
                    Usuario.activo.is_(True),
                    Usuario.id != objetivo.id,
                )
            )
            if (otros or 0) == 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Debe quedar al menos un administrador activo.",
                )

        if nuevo_rol != rol_anterior:
            registrar_evento(
                db,
                actor.id,
                "rol_cambiado",
                "usuario",
                objetivo.id,
                f"correo: {objetivo.email}; rol: {rol_anterior} → {nuevo_rol}",
            )

        if nuevo_activo != activo_anterior:
            registrar_evento(
                db,
                actor.id,
                "usuario_activado" if nuevo_activo else "usuario_desactivado",
                "usuario",
                objetivo.id,
                f"correo: {objetivo.email}",
            )
            if not nuevo_activo:
                objetivo.token_version += 1

        objetivo.rol = nuevo_rol
        objetivo.activo = nuevo_activo

        await db.commit()
        return objetivo

    except HTTPException:
        await db.rollback()
        raise
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Error de base de datos al actualizar el usuario")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo actualizar el usuario.",
        ) from exc
    