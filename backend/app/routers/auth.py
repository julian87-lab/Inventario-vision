from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    status,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..deps import CurrentUser, DbSession
from ..models import Usuario
from ..schemas.auth import (
    ActualizarPerfil,
    CambiarContrasena,
    InvitacionConsulta,
    InvitacionInfo,
    MensajeOut,
    RegistroInvitacion,
    RestablecerContrasena,
    SolicitudRecuperacion,
    Token,
    UsuarioOut,
)
from ..security import create_access_token, hash_password, verify_password
from ..services.auditoria_service import registrar_evento
from ..services.correo_service import enviar_aviso_cambio_contrasena
from ..services.invitacion_service import (
    consultar_invitacion,
    registrar_con_invitacion,
)
from ..services.rate_limit import LimitadorVentana
from ..services.recuperacion_service import (
    restablecer_contrasena,
    solicitar_recuperacion,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_limite_login = LimitadorVentana(maximo=10, ventana_segundos=15 * 60)
_limite_login_ip = LimitadorVentana(maximo=50, ventana_segundos=15 * 60)
_limite_login_correo = LimitadorVentana(maximo=30, ventana_segundos=15 * 60)
_limite_solicitud = LimitadorVentana(maximo=10, ventana_segundos=15 * 60)
_limite_restablecer = LimitadorVentana(maximo=10, ventana_segundos=15 * 60)
_limite_registro = LimitadorVentana(maximo=10, ventana_segundos=15 * 60)
_limite_cambio = LimitadorVentana(maximo=5, ventana_segundos=15 * 60)

MENSAJE_SOLICITUD = (
    "Si el correo está registrado, enviaremos un enlace para restablecer "
    "la contraseña. Revisa también la carpeta de spam."
)
MENSAJE_LIMITE = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."

# Permite comprobar un hash incluso cuando el correo no existe.
_HASH_FICTICIO = hash_password("contrasena-ficticia-no-valida")


def _ip_cliente(request: Request) -> str:
    return request.client.host if request.client else "desconocido"


def _aplicar_limite(limitador: LimitadorVentana, clave: str) -> None:
    if not limitador.permitir(clave):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=MENSAJE_LIMITE,
            headers={"Retry-After": "900"},
        )


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    request: Request,
    db: DbSession,
) -> Token:
    correo = form_data.username.strip().lower()
    ip = _ip_cliente(request)

    _aplicar_limite(_limite_login_ip, ip)
    _aplicar_limite(_limite_login_correo, correo)
    _aplicar_limite(_limite_login, f"{ip}|{correo}")

    result = await db.execute(
        select(Usuario).where(Usuario.email == correo)
    )
    usuario = result.scalar_one_or_none()

    hash_a_verificar = usuario.password_hash if usuario else _HASH_FICTICIO
    contrasena_valida = await run_in_threadpool(
        verify_password,
        form_data.password,
        hash_a_verificar,
    )

    if usuario is None or not contrasena_valida:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está desactivada. Contacta al administrador.",
        )

    return Token(
        access_token=create_access_token(
            str(usuario.id),
            usuario.token_version,
        )
    )


@router.get("/me", response_model=UsuarioOut)
async def me(current_user: CurrentUser) -> Usuario:
    return current_user


@router.patch("/me", response_model=UsuarioOut)
async def actualizar_mi_perfil(
    datos: ActualizarPerfil,
    db: DbSession,
    current_user: CurrentUser,
) -> Usuario:
    try:
        resultado = await db.execute(
            select(Usuario)
            .where(Usuario.id == current_user.id)
            .with_for_update()
        )
        usuario = resultado.scalar_one()

        if usuario.nombre == datos.nombre:
            return usuario

        nombre_anterior = usuario.nombre
        usuario.nombre = datos.nombre

        registrar_evento(
            db,
            usuario.id,
            "perfil_actualizado",
            "usuario",
            usuario.id,
            (
                f"nombre anterior: {nombre_anterior}; "
                f"nombre nuevo: {usuario.nombre}"
            ),
        )

        await db.commit()
        return usuario

    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo actualizar el nombre.",
        ) from exc


@router.post(
    "/forgot-password",
    response_model=MensajeOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def solicitar_recuperacion_contrasena(
    datos: SolicitudRecuperacion,
    request: Request,
    segundo_plano: BackgroundTasks,
) -> MensajeOut:
    _aplicar_limite(_limite_solicitud, _ip_cliente(request))

    segundo_plano.add_task(solicitar_recuperacion, datos.email)
    return MensajeOut(mensaje=MENSAJE_SOLICITUD)


@router.post("/reset-password", response_model=MensajeOut)
async def restablecer_contrasena_endpoint(
    datos: RestablecerContrasena,
    request: Request,
    db: DbSession,
    segundo_plano: BackgroundTasks,
) -> MensajeOut:
    _aplicar_limite(_limite_restablecer, _ip_cliente(request))

    destino, nombre = await restablecer_contrasena(
        db,
        datos.token,
        datos.password,
    )
    segundo_plano.add_task(
        enviar_aviso_cambio_contrasena,
        destino,
        nombre,
    )

    return MensajeOut(
        mensaje="Tu contraseña se actualizó. Ya puedes iniciar sesión."
    )


@router.post("/invitacion/consultar", response_model=InvitacionInfo)
async def consultar_invitacion_endpoint(
    datos: InvitacionConsulta,
    request: Request,
    db: DbSession,
) -> InvitacionInfo:
    _aplicar_limite(_limite_registro, _ip_cliente(request))

    invitacion = await consultar_invitacion(db, datos.token)
    return InvitacionInfo(
        email=invitacion.email,
        rol=invitacion.rol,
    )


@router.post(
    "/registro",
    response_model=MensajeOut,
    status_code=status.HTTP_201_CREATED,
)
async def registrar(
    datos: RegistroInvitacion,
    request: Request,
    db: DbSession,
) -> MensajeOut:
    _aplicar_limite(_limite_registro, _ip_cliente(request))

    await registrar_con_invitacion(
        db,
        datos.token,
        datos.nombre,
        datos.password,
    )

    return MensajeOut(
        mensaje="Tu cuenta fue creada. Ya puedes iniciar sesión."
    )


@router.post("/change-password", response_model=Token)
async def cambiar_contrasena(
    datos: CambiarContrasena,
    current_user: CurrentUser,
    db: DbSession,
    segundo_plano: BackgroundTasks,
) -> Token:
    _aplicar_limite(_limite_cambio, str(current_user.id))

    contrasena_actual_valida = await run_in_threadpool(
        verify_password,
        datos.actual,
        current_user.password_hash,
    )

    if not contrasena_actual_valida:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual no es correcta.",
        )

    if datos.actual == datos.nueva:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña nueva debe ser distinta de la actual.",
        )

    try:
        current_user.password_hash = await run_in_threadpool(
            hash_password,
            datos.nueva,
        )
        current_user.token_version += 1

        registrar_evento(
            db,
            current_user.id,
            "contrasena_cambiada",
            "usuario",
            current_user.id,
        )

        await db.commit()

    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo cambiar la contraseña.",
        ) from exc

    segundo_plano.add_task(
        enviar_aviso_cambio_contrasena,
        current_user.email,
        current_user.nombre,
    )

    # Emite un token con la nueva versión e invalida los anteriores.
    return Token(
        access_token=create_access_token(
            str(current_user.id),
            current_user.token_version,
        )
    )
