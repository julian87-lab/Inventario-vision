"""Crea o promueve un administrador desde la consola del servidor."""

import argparse
import asyncio
import getpass
import re
import sys

from sqlalchemy import select

from backend.app.database import AsyncSessionLocal, engine
from backend.app.models import Usuario
from backend.app.security import hash_password
from backend.app.services.auditoria_service import registrar_evento

PATRON_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def _ejecutar(
    email: str,
    nombre: str | None,
) -> int:
    correo = email.strip().lower()

    if (
        len(correo) > 255
        or not PATRON_EMAIL.fullmatch(correo)
        or any(caracter in correo for caracter in "[]()")
        or "mailto:" in correo
    ):
        print(
            "Correo inválido. Escribe solo la dirección, "
            "sin corchetes, paréntesis ni mailto:."
        )
        return 1

    async with AsyncSessionLocal() as db:
        resultado = await db.execute(
            select(Usuario)
            .where(Usuario.email == correo)
            .with_for_update()
        )
        usuario = resultado.scalar_one_or_none()

        if usuario is not None:
            if usuario.rol == "administrador" and usuario.activo:
                print(
                    "Ese usuario ya es administrador activo. "
                    "No se hicieron cambios."
                )
                return 0

            rol_anterior = usuario.rol
            activo_anterior = usuario.activo

            usuario.rol = "administrador"
            usuario.activo = True

            # Invalida sesiones anteriores al cambio de privilegios.
            usuario.token_version += 1

            registrar_evento(
                db,
                None,
                "administrador_promovido",
                "usuario",
                usuario.id,
                (
                    f"correo: {correo}; "
                    f"rol anterior: {rol_anterior}; "
                    f"activo anterior: {activo_anterior}; "
                    "mediante línea de comandos"
                ),
            )

            await db.commit()

            print(f"Listo: {correo} ahora es administrador.")
            print(
                "Su contraseña no cambió. "
                "Debe iniciar sesión nuevamente."
            )
            return 0

        nombre_limpio = " ".join((nombre or "").split())

        if not 2 <= len(nombre_limpio) <= 120:
            print(
                "El usuario no existe. Para crearlo, indica "
                '--nombre "Nombre del administrador" '
                "con entre 2 y 120 caracteres."
            )
            return 1

        contrasena = getpass.getpass("Contraseña: ")
        confirmacion = getpass.getpass("Repite la contraseña: ")

        if contrasena != confirmacion:
            print("Las contraseñas no coinciden.")
            return 1

        if not 8 <= len(contrasena) <= 128:
            print(
                "La contraseña debe tener entre 8 y 128 caracteres."
            )
            return 1

        usuario = Usuario(
            nombre=nombre_limpio,
            email=correo,
            password_hash=hash_password(contrasena),
            rol="administrador",
            activo=True,
            token_version=0,
        )

        db.add(usuario)
        await db.flush()

        registrar_evento(
            db,
            None,
            "administrador_creado",
            "usuario",
            usuario.id,
            f"correo: {correo}; mediante línea de comandos",
        )

        await db.commit()

        print(f"Listo: administrador creado para {correo}.")
        return 0


async def _principal(
    email: str,
    nombre: str | None,
) -> int:
    try:
        return await _ejecutar(email, nombre)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crea o promueve un administrador."
    )
    parser.add_argument("--email", required=True)
    parser.add_argument("--nombre")

    args = parser.parse_args()

    codigo = asyncio.run(
        _principal(args.email, args.nombre)
    )
    sys.exit(codigo)


if __name__ == "__main__":
    main()
