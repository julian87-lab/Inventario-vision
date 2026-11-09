from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from ..config import settings
from ..deps import AdminUser, DbSession
from ..schemas.admin import (
    AuditoriaRead,
    InvitacionCreate,
    InvitacionRead,
    UsuarioAdminRead,
    UsuarioAdminUpdate,
)
from ..services.auditoria_service import listar_auditoria
from ..services.correo_service import enviar_correo_invitacion
from ..services.invitacion_service import (
    crear_invitacion,
    listar_invitaciones,
    reenviar_invitacion,
    revocar_invitacion,
)
from ..services.rate_limit import LimitadorVentana
from ..services.usuario_admin_service import actualizar_usuario, listar_usuarios

router = APIRouter(prefix="/admin", tags=["admin"])

_limite_invitaciones = LimitadorVentana(maximo=20, ventana_segundos=60 * 60)


def _enlace_invitacion(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/registro#token={token}"


def _aplicar_limite(admin_id: int) -> None:
    if not _limite_invitaciones.permitir(str(admin_id)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiadas invitaciones en poco tiempo. Inténtalo más tarde.",
            headers={"Retry-After": "3600"},
        )


@router.get("/usuarios", response_model=list[UsuarioAdminRead])
async def obtener_usuarios(db: DbSession, admin: AdminUser):
    return await listar_usuarios(db)


@router.patch("/usuarios/{usuario_id}", response_model=UsuarioAdminRead)
async def modificar_usuario(
    usuario_id: int,
    datos: UsuarioAdminUpdate,
    db: DbSession,
    admin: AdminUser,
):
    return await actualizar_usuario(db, admin, usuario_id, datos)


@router.get("/invitaciones", response_model=list[InvitacionRead])
async def obtener_invitaciones(
    db: DbSession,
    admin: AdminUser,
    limite: int = Query(default=100, ge=1, le=500),
):
    return await listar_invitaciones(db, limite)


@router.post(
    "/invitaciones",
    response_model=InvitacionRead,
    status_code=status.HTTP_201_CREATED,
)
async def invitar(
    datos: InvitacionCreate,
    db: DbSession,
    admin: AdminUser,
    segundo_plano: BackgroundTasks,
):
    _aplicar_limite(admin.id)
    invitacion, token = await crear_invitacion(db, admin, datos.email, datos.rol)

    segundo_plano.add_task(
        enviar_correo_invitacion,
        invitacion.email,
        admin.nombre,
        invitacion.rol,
        _enlace_invitacion(token),
    )
    return invitacion


@router.post("/invitaciones/{invitacion_id}/revocar", response_model=InvitacionRead)
async def revocar(invitacion_id: int, db: DbSession, admin: AdminUser):
    return await revocar_invitacion(db, admin, invitacion_id)


@router.post("/invitaciones/{invitacion_id}/reenviar", response_model=InvitacionRead)
async def reenviar(
    invitacion_id: int,
    db: DbSession,
    admin: AdminUser,
    segundo_plano: BackgroundTasks,
):
    _aplicar_limite(admin.id)
    invitacion, token = await reenviar_invitacion(db, admin, invitacion_id)

    segundo_plano.add_task(
        enviar_correo_invitacion,
        invitacion.email,
        admin.nombre,
        invitacion.rol,
        _enlace_invitacion(token),
    )
    return invitacion


@router.get("/auditoria", response_model=list[AuditoriaRead])
async def obtener_auditoria(
    db: DbSession,
    admin: AdminUser,
    limite: int = Query(default=100, ge=1, le=500),
):
    return await listar_auditoria(db, limite)
