from sqlalchemy import select

from ..models import EventoAuditoria


def registrar_evento(
    db,
    actor_id: int | None,
    accion: str,
    objeto_tipo: str,
    objeto_id: int | None = None,
    detalle: str | None = None,
) -> None:
    """Agrega el evento a la transacción actual; el commit lo hace quien llama."""
    db.add(
        EventoAuditoria(
            usuario_id=actor_id,
            accion=accion,
            objeto_tipo=objeto_tipo,
            objeto_id=objeto_id,
            detalle=detalle,
        )
    )


async def listar_auditoria(db, limite: int = 100) -> list[EventoAuditoria]:
    resultado = await db.execute(
        select(EventoAuditoria)
        .order_by(EventoAuditoria.fecha_hora.desc(), EventoAuditoria.id.desc())
        .limit(limite)
    )
    return list(resultado.scalars().all())
