import asyncio

from sqlalchemy import select

from backend.app.database import AsyncSessionLocal, engine
from backend.app.models import Movimiento, Producto, Usuario
from backend.app.security import hash_password

ADMIN_NOMBRE = "Tendero"
ADMIN_EMAIL = "tendero@tienda.local"
ADMIN_PASSWORD = "CambiaEsta123!"  # solo desarrollo

# (clase_yolo, nombre, stock_inicial, umbral_alerta)
PRODUCTOS = [
    (0, "Coca-Cola botella 1.5 L", 24, 6),
    (1, "Doritos clásicos x 34 g", 15, 5),
    (2, "Chocoramo ponqué x 55 g", 16, 6),
    (3, "Aceite vegetal Premier botella x 1 L", 18, 5),
    (4, "Leche Alquería entera bolsa x 1100 ml", 20, 6),
    (5, "Detergente Fab polvo bolsa x 500 g", 24, 6),
    (6, "Harina P.A.N. x 1000 g", 15, 4),
    (7, "Café Sello Rojo molido bolsa x 250 g", 18, 5),
    (8, "Crema dental Colgate Triple Acción tubo x 75 ml", 20, 5),
    (9, "Dog Chow Cachorro bolsa x 1 kg", 10, 3),
]


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Usuario).where(Usuario.email == ADMIN_EMAIL))
        usuario = result.scalar_one_or_none()
        if usuario is None:
            usuario = Usuario(
                nombre=ADMIN_NOMBRE,
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASSWORD),
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