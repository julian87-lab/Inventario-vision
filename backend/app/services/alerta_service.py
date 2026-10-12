from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..models import Alerta, Producto


async def sincronizar_alerta_producto(db, producto: Producto) -> None:
    if producto.stock_actual <= producto.umbral_alerta:
        tipo = "sin_stock" if producto.stock_actual == 0 else "stock_bajo"

        sentencia = (
            pg_insert(Alerta)
            .values(producto_id=producto.id, tipo=tipo, atendida=False)
            .on_conflict_do_nothing(
                index_elements=[Alerta.producto_id, Alerta.tipo],
                index_where=text("NOT atendida"),
            )
        )
        await db.execute(sentencia)
        return

    pendientes = await db.execute(
        select(Alerta).where(
            Alerta.producto_id == producto.id,
            Alerta.atendida.is_(False),
        )
    )
    for alerta in pendientes.scalars().all():
        alerta.atendida = True


async def listar_alertas_pendientes(db) -> list[Alerta]:
    resultado = await db.execute(
        select(Alerta)
        .where(Alerta.atendida.is_(False))
        .order_by(Alerta.fecha_hora.desc())
    )
    return list(resultado.scalars().all())
