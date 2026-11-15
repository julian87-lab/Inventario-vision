import asyncio
from io import BytesIO

from PIL import Image
from sqlalchemy import select

from backend.app.models import EventoAuditoria, Producto
from backend.app.security import create_access_token
from conftest import TestSessionLocal


def headers_usuario(usuario_id: int):
    token = create_access_token(
        subject=str(usuario_id),
        token_version=0,
    )
    return {"Authorization": f"Bearer {token}"}


def crear_png() -> bytes:
    buffer = BytesIO()

    with Image.new("RGB", (100, 100), color="white") as imagen:
        imagen.save(buffer, format="PNG")

    return buffer.getvalue()


def subir_recepcion(client, headers):
    respuesta = client.post(
        "/api/detecciones",
        headers=headers,
        files={
            "file": (
                "producto_manual.png",
                crear_png(),
                "image/png",
            )
        },
    )

    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


async def crear_producto_manual(activo: bool = True):
    async with TestSessionLocal() as db:
        db.add(
            Producto(
                id=3,
                clase_yolo=2,
                nombre="Producto manual de prueba",
                stock_actual=5,
                umbral_alerta=1,
                activo=activo,
            )
        )
        await db.commit()


async def consultar_stock_producto_manual():
    async with TestSessionLocal() as db:
        producto = await db.get(Producto, 3)
        assert producto is not None
        return producto.stock_actual


async def consultar_eventos_manuales(deteccion_id: int):
    async with TestSessionLocal() as db:
        resultado = await db.execute(
            select(EventoAuditoria).where(
                EventoAuditoria.accion == "producto_manual_agregado",
                EventoAuditoria.objeto_tipo == "deteccion",
                EventoAuditoria.objeto_id == deteccion_id,
            )
        )

        return [
            {
                "usuario_id": evento.usuario_id,
                "detalle": evento.detalle,
            }
            for evento in resultado.scalars().all()
        ]


def consultar_recepcion(client, headers, deteccion_id: int):
    respuesta = client.get(
        f"/api/detecciones/{deteccion_id}",
        headers=headers,
    )

    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def consultar_movimientos(client, headers):
    respuesta = client.get(
        "/api/inventario/movimientos",
        headers=headers,
    )

    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def test_producto_manual_auditoria_y_confirmacion_unica(client):
    headers = headers_usuario(2)
    deteccion = subir_recepcion(client, headers)
    deteccion_id = deteccion["id"]

    asyncio.run(crear_producto_manual())

    assert all(
        item["producto_id"] != 3
        for item in deteccion["items"]
    )

    agregado = client.post(
        f"/api/detecciones/{deteccion_id}/items",
        headers=headers,
        json={
            "producto_id": 3,
            "cantidad": 4,
        },
    )

    assert agregado.status_code == 201, agregado.text

    actualizada = agregado.json()
    assert actualizada["estado"] == "pendiente"

    manuales = [
        item
        for item in actualizada["items"]
        if item["producto_id"] == 3
    ]

    assert len(manuales) == 1
    assert manuales[0]["cantidad_detectada"] == 4
    assert manuales[0]["confianza"] is None
    assert manuales[0]["cantidad_confirmada"] is None

    # Añadir a la propuesta no debe crear una entrada de stock.
    assert asyncio.run(consultar_stock_producto_manual()) == 5
    assert consultar_movimientos(client, headers) == []

    # El producto también debe aparecer en una consulta posterior.
    persistida = consultar_recepcion(
        client,
        headers,
        deteccion_id,
    )

    assert any(
        item["producto_id"] == 3
        and item["cantidad_detectada"] == 4
        for item in persistida["items"]
    )

    eventos = asyncio.run(
        consultar_eventos_manuales(deteccion_id)
    )

    assert len(eventos) == 1
    assert eventos[0]["usuario_id"] == 2
    assert "Producto manual de prueba" in eventos[0]["detalle"]
    assert "cantidad: 4" in eventos[0]["detalle"]
    assert "corrección manual" in eventos[0]["detalle"]

    # Se corrige de 4 a 3 antes de confirmar.
    payload = {
        "items": [
            {
                "producto_id": item["producto_id"],
                "cantidad_confirmada": (
                    3 if item["producto_id"] == 3 else 0
                ),
            }
            for item in persistida["items"]
        ]
    }

    confirmada = client.post(
        f"/api/detecciones/{deteccion_id}/confirmar",
        headers=headers,
        json=payload,
    )

    assert confirmada.status_code == 200, confirmada.text
    assert confirmada.json()["estado"] == "confirmada"
    assert asyncio.run(consultar_stock_producto_manual()) == 8

    item_confirmado = next(
        item
        for item in confirmada.json()["items"]
        if item["producto_id"] == 3
    )
    assert item_confirmado["cantidad_confirmada"] == 3

    movimientos = consultar_movimientos(client, headers)

    assert len(movimientos) == 1

    movimiento = movimientos[0]
    assert movimiento["producto_id"] == 3
    assert movimiento["deteccion_id"] == deteccion_id
    assert movimiento["tipo"] == "entrada_deteccion"
    assert movimiento["cantidad"] == 3
    assert movimiento["stock_antes"] == 5
    assert movimiento["stock_despues"] == 8

    repetida = client.post(
        f"/api/detecciones/{deteccion_id}/confirmar",
        headers=headers,
        json=payload,
    )

    assert repetida.status_code == 409, repetida.text
    assert asyncio.run(consultar_stock_producto_manual()) == 8
    assert len(consultar_movimientos(client, headers)) == 1

    agregado_tardio = client.post(
        f"/api/detecciones/{deteccion_id}/items",
        headers=headers,
        json={
            "producto_id": 3,
            "cantidad": 1,
        },
    )

    assert agregado_tardio.status_code == 409, agregado_tardio.text

    assert len(
        asyncio.run(consultar_eventos_manuales(deteccion_id))
    ) == 1


def test_descartar_producto_manual_no_modifica_stock(client):
    headers = headers_usuario(2)
    deteccion = subir_recepcion(client, headers)
    deteccion_id = deteccion["id"]

    asyncio.run(crear_producto_manual())

    agregado = client.post(
        f"/api/detecciones/{deteccion_id}/items",
        headers=headers,
        json={
            "producto_id": 3,
            "cantidad": 4,
        },
    )

    assert agregado.status_code == 201, agregado.text

    descartada = client.post(
        f"/api/detecciones/{deteccion_id}/descartar",
        headers=headers,
        json={"motivo": "Prueba de descarte con producto manual"},
    )

    assert descartada.status_code == 200, descartada.text
    assert descartada.json()["estado"] == "descartada"

    assert asyncio.run(consultar_stock_producto_manual()) == 5
    assert consultar_movimientos(client, headers) == []

    # Se conserva la trazabilidad de lo añadido a la propuesta.
    assert len(
        asyncio.run(consultar_eventos_manuales(deteccion_id))
    ) == 1

    agregado_tardio = client.post(
        f"/api/detecciones/{deteccion_id}/items",
        headers=headers,
        json={
            "producto_id": 3,
            "cantidad": 1,
        },
    )

    assert agregado_tardio.status_code == 409, agregado_tardio.text


def test_operador_no_agrega_producto_a_recepcion_ajena(client):
    propietario = headers_usuario(2)
    otro_operador = headers_usuario(3)

    deteccion = subir_recepcion(client, propietario)
    deteccion_id = deteccion["id"]

    asyncio.run(crear_producto_manual())

    respuesta = client.post(
        f"/api/detecciones/{deteccion_id}/items",
        headers=otro_operador,
        json={
            "producto_id": 3,
            "cantidad": 4,
        },
    )

    assert respuesta.status_code == 404, respuesta.text

    actualizada = consultar_recepcion(
        client,
        propietario,
        deteccion_id,
    )

    assert all(
        item["producto_id"] != 3
        for item in actualizada["items"]
    )

    assert asyncio.run(consultar_stock_producto_manual()) == 5
    assert asyncio.run(
        consultar_eventos_manuales(deteccion_id)
    ) == []


def test_producto_manual_inactivo_se_rechaza(client):
    headers = headers_usuario(2)
    deteccion = subir_recepcion(client, headers)
    deteccion_id = deteccion["id"]

    asyncio.run(crear_producto_manual(activo=False))

    respuesta = client.post(
        f"/api/detecciones/{deteccion_id}/items",
        headers=headers,
        json={
            "producto_id": 3,
            "cantidad": 4,
        },
    )

    assert respuesta.status_code == 400, respuesta.text

    actualizada = consultar_recepcion(
        client,
        headers,
        deteccion_id,
    )

    assert all(
        item["producto_id"] != 3
        for item in actualizada["items"]
    )

    assert asyncio.run(consultar_stock_producto_manual()) == 5
    assert asyncio.run(
        consultar_eventos_manuales(deteccion_id)
    ) == []
    
    