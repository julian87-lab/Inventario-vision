from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models import Usuario
from .models.usuario import ROL_ADMINISTRADOR
from .security import decode_access_token_claims

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DbSession,
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    claims = decode_access_token_claims(token)
    subject = claims.get("sub") if claims else None
    if not isinstance(subject, str) or not subject.isdigit():
        raise credentials_exception

    usuario = await db.get(Usuario, int(subject))
    if usuario is None or not usuario.activo:
        raise credentials_exception

    version = claims.get("ver", 0) if claims else 0
    if not isinstance(version, int) or version != usuario.token_version:
        raise credentials_exception

    return usuario


CurrentUser = Annotated[Usuario, Depends(get_current_user)]


def requiere_rol(*roles: str):
    async def dependencia(usuario: CurrentUser) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para realizar esta acción.",
            )
        return usuario

    return dependencia


AdminUser = Annotated[Usuario, Depends(requiere_rol(ROL_ADMINISTRADOR))]
