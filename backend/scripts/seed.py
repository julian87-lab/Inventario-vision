import asyncio
import os

from sqlalchemy import select

from backend.app.database import AsyncSessionLocal, engine
from backend.app.models import Movimiento, Producto, Usuario
from backend.app.security import hash_password

ADMIN_NOMBRE = "Tendero"
ADMIN_EMAIL = "tendero@tienda.local"

# (clase_yolo, nombre, stock_inicial, umbral_alerta)
PRODUCTOS = [
    (0, "Coca-Cola botella 1.5 L", 24, 6),
    (1, "Doritos clásicos x 34 g", 15, 5),
    (2, "Chocoramo ponqué x 55 g", 16, 6),
    (3, "Aceite vegetal Ideal botella x 1 L", 18, 5),
    (4, "Leche Alquería entera bolsa x 1100 ml", 20, 6),
    (5, "Detergente Fab polvo bolsa x 500 g", 24, 6),
    (6, "Harina P.A.N. x 1000 g", 15, 4),
    (7, "Café Sello Rojo molido bolsa x 250 g", 18, 5),
    (8, "Crema dental Colgate Triple Acción tubo x 75 ml", 20, 5),
    (9, "Dog Chow Cachorro bolsa x 1 kg", 10, 3),
]


def obtener_contrasena_administrador() -> str:
    contrasena = os.environ.get("ADMIN_PASSWORD", "").strip()

    if not contrasena:
        raise RuntimeError(
            "Define ADMIN_PASSWORD en el entorno antes de ejecutar el seed. "
            "No se permite una contraseña fija en el código."
        )

    if len(contrasena) < 12:
        raise RuntimeError(
            "ADMIN_PASSWORD debe tener al menos 12 caracteres."
        )

    return contrasena


async def main() -> None:
    contrasena_administrador = obtener_contrasena_administrador()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Usuario).where(Usuario.email == ADMIN_EMAIL)
        )
        usuario = result.scalar_one_or_none()

        if usuario is None:
            usuario = Usuario(
                nombre=ADMIN_NOMBRE,
                email=ADMIN_EMAIL,
                password_hash=hash_password(contrasena_administrador),
            )
            db.add(usuario)
            await db.flush()

        for clase, nombre, stock, umbral in PRODUCTOS:
            result = await db.execute(
                select(Producto).where(Producto.clase_yolo == clase)
            )
            producto = result.scalar_one_or_none()

            if producto is not None:
                producto.nombre = nombre
                producto.umbral_alerta = umbral
                continue

            producto = Producto(
                clase_yolo=clase,
                nombre=nombre,
                stock_actual=stock,
                umbral_alerta=umbral,
            )
            db.add(producto)
            await db.flush()

            if stock > 0:
                db.add(
                    Movimiento(
                        producto_id=producto.id,
                        usuario_id=usuario.id,
                        tipo="ajuste",
                        cantidad=stock,
                        stock_antes=0,
                        stock_despues=stock,
                    )
                )

        await db.commit()

    await engine.dispose()
    print("Seed completado")


asyncio.run(main())