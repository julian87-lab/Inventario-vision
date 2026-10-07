from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import Usuario
from ..schemas.auth import Token, UsuarioOut
from ..security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
) -> Token:
    result = await db.execute(
        select(Usuario).where(Usuario.email == form_data.username.strip().lower())
    )
    usuario = result.scalar_one_or_none()

    if usuario is None or not verify_password(form_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Token(access_token=create_access_token(str(usuario.id)))


@router.get("/me", response_model=UsuarioOut)
async def me(current_user: CurrentUser) -> Usuario:
    return current_user