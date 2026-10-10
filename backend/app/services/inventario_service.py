from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..models import Movimiento, Producto
from ..schemas.inventario import MovimientoCreate
from .alerta_service import sincronizar_alerta_producto


async def registrar_movimiento(
    db,
    datos: MovimientoCreate,
    usuario_id: int,
) -> Movimiento:
    cantidad = datos.cantidad

    if datos.tipo == "venta":
        if cantidad <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La cantidad de una venta debe ser mayor que cero.",
            )
        cantidad = -cantidad

    elif datos.tipo == "ajuste":
        if cantidad == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La cantidad de un ajuste no puede ser cero.",
            )

    try:
        resultado = await db.execute(
            select(Producto)
            .where(
                Producto.id == datos.producto_id,
                Producto.activo.is_(True),
            )
            .with_for_update()
        )
        producto = resultado.scalar_one_or_none()

        if producto is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontró un producto activo con ese ID.",
            )

        stock_antes = producto.stock_actual
        stock_despues = stock_antes + cantidad

        if stock_despues < 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Stock insuficiente. Disponible: {stock_antes}; "
                    f"solicitado: {-cantidad}."
                ),
            )

        movimiento = Movimiento(
            producto_id=producto.id,
            usuario_id=usuario_id,
            deteccion_id=None,
            tipo=datos.tipo,
            cantidad=cantidad,
            stock_antes=stock_antes,
            stock_despues=stock_despues,
        )

        producto.stock_actual = stock_despues
        db.add(movimiento)

        # Crea o actualiza la alerta usando el nuevo stock.
        await sincronizar_alerta_producto(db, producto)

        # Stock, movimiento y alerta se confirman juntos.
        await db.commit()
        await db.refresh(movimiento)

        return movimiento

    except HTTPException:
        await db.rollback()
        raise

    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo registrar el movimiento de inventario.",
        ) from exc


async def listar_movimientos(
    db,
    producto_id: int | None = None,
    limite: int = 100,
) -> list[Movimiento]:
    consulta = select(Movimiento).order_by(Movimiento.fecha_hora.desc())

    if producto_id is not None:
        consulta = consulta.where(Movimiento.producto_id == producto_id)

    consulta = consulta.limit(limite)
    resultado = await db.execute(consulta)

    return list(resultado.scalars().all())

