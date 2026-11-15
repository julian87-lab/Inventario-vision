import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from io import BytesIO
from threading import Barrier

import jwt
from PIL import Image

from backend.app.config import settings
from backend.app.models import Usuario
from backend.app.security import create_access_token

from conftest import TestSessionLocal


def token_headers(usuario_id: int, version: int = 0):
    token = create_access_token(
        subject=str(usuario_id),
        token_version=version,
    )
    return {"Authorization": f"Bearer {token}"}


def crear_png() -> bytes:
    buffer = BytesIO()

    with Image.new("RGB", (100, 100), color="white") as imagen:
        imagen.save(buffer, format="PNG")

    return buffer.getvalue()


def subir(client, headers):
    respuesta = client.post(
        "/api/detecciones",
        headers=headers,
        files={
            "file": (
                "prueba.png",
                crear_png(),
                "image/png",
            )
        },
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def stocks(client, headers):
    respuesta = client.get("/api/productos", headers=headers)
    assert respuesta.status_code == 200, respuesta.text

    return {
        producto["id"]: producto["stock_actual"]
        for producto in respuesta.json()
    }


async def cambiar_usuario(usuario_id: int, **cambios):
    async with TestSessionLocal() as db:
        usuario = await db.get(Usuario, usuario_id)
        assert usuario is not None

        for atributo, valor in cambios.items():
            setattr(usuario, atributo, valor)

        await db.commit()


def confirmar_payload():
    return {
        "items": [
            {
                "producto_id": 1,
                "cantidad_confirmada": 2,
            },
            {
                "producto_id": 2,
                "cantidad_confirmada": 1,
            },
        ]
    }


def test_token_vencido_se_rechaza(client):
    token = jwt.encode(
        {
            "sub": "1",
            "ver": 0,
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    respuesta = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert respuesta.status_code == 401


def test_token_version_anterior_se_rechaza(client):
    headers = token_headers(2)

    assert client.get(
        "/api/auth/me",
        headers=headers,
    ).status_code == 200

    asyncio.run(cambiar_usuario(2, token_version=1))

    respuesta = client.get(
        "/api/auth/me",
        headers=headers,
    )

    assert respuesta.status_code == 401


def test_cuenta_desactivada_pierde_acceso(client):
    headers = token_headers(2)

    assert client.get(
        "/api/auth/me",
        headers=headers,
    ).status_code == 200

    asyncio.run(cambiar_usuario(2, activo=False))

    respuesta = client.get(
        "/api/auth/me",
        headers=headers,
    )

    assert respuesta.status_code == 401


def test_cambio_rol_se_refleja_con_token_existente(client):
    headers = token_headers(2)

    antes = client.get("/api/auth/me", headers=headers)
    assert antes.status_code == 200, antes.text
    assert antes.json()["rol"] == "operador"

    asyncio.run(cambiar_usuario(2, rol="administrador"))

    despues = client.get("/api/auth/me", headers=headers)
    assert despues.status_code == 200, despues.text
    assert despues.json()["rol"] == "administrador"


def test_operador_no_consulta_recepcion_ajena(client):
    propia = token_headers(2)
    ajena = token_headers(3)

    deteccion = subir(client, propia)
    ruta = f"/api/detecciones/{deteccion['id']}"

    assert client.get(
        ruta,
        headers=propia,
    ).status_code == 200

    assert client.get(
        ruta,
        headers=ajena,
    ).status_code == 404

    assert client.get(
        f"{ruta}/imagen",
        headers=ajena,
    ).status_code == 404


def test_operador_solo_lista_sus_recepciones(client):
    primero = token_headers(2)
    segundo = token_headers(3)

    deteccion_primero = subir(client, primero)
    deteccion_segundo = subir(client, segundo)

    respuesta = client.get(
        "/api/detecciones",
        headers=primero,
    )
    assert respuesta.status_code == 200, respuesta.text

    ids = {deteccion["id"] for deteccion in respuesta.json()}

    assert deteccion_primero["id"] in ids
    assert deteccion_segundo["id"] not in ids


def test_administrador_consulta_recepcion_de_operador(client, headers):
    deteccion = subir(client, token_headers(2))

    respuesta = client.get(
        f"/api/detecciones/{deteccion['id']}",
        headers=headers,
    )

    assert respuesta.status_code == 200, respuesta.text


def test_operador_no_confirma_ni_descarta_recepcion_ajena(
    client,
    headers,
):
    deteccion = subir(client, token_headers(2))
    ruta = f"/api/detecciones/{deteccion['id']}"
    ajena = token_headers(3)
    antes = stocks(client, headers)

    confirmar = client.post(
        f"{ruta}/confirmar",
        headers=ajena,
        json=confirmar_payload(),
    )
    assert confirmar.status_code == 404, confirmar.text

    descartar = client.post(
        f"{ruta}/descartar",
        headers=ajena,
        json={"motivo": "Intento sin permiso"},
    )
    assert descartar.status_code == 404, descartar.text

    consulta = client.get(ruta, headers=headers)
    assert consulta.status_code == 200, consulta.text
    assert consulta.json()["estado"] == "pendiente"
    assert stocks(client, headers) == antes


def test_producto_manual_repetido_no_modifica_recepcion(
    client,
    headers,
):
    deteccion = subir(client, headers)
    antes = stocks(client, headers)

    respuesta = client.post(
        f"/api/detecciones/{deteccion['id']}/items",
        headers=headers,
        json={"producto_id": 1, "cantidad": 3},
    )

    assert respuesta.status_code == 409, respuesta.text

    consulta = client.get(
        f"/api/detecciones/{deteccion['id']}",
        headers=headers,
    )
    assert consulta.status_code == 200, consulta.text
    assert len(consulta.json()["items"]) == 2
    assert stocks(client, headers) == antes


def test_producto_manual_cantidad_cero_se_rechaza(client, headers):
    deteccion = subir(client, headers)

    respuesta = client.post(
        f"/api/detecciones/{deteccion['id']}/items",
        headers=headers,
        json={"producto_id": 1, "cantidad": 0},
    )

    assert respuesta.status_code == 422, respuesta.text


def test_recepcion_descartada_no_admite_confirmacion(client, headers):
    deteccion = subir(client, headers)
    ruta = f"/api/detecciones/{deteccion['id']}"
    antes = stocks(client, headers)

    descartada = client.post(
        f"{ruta}/descartar",
        headers=headers,
        json={"motivo": "Prueba"},
    )
    assert descartada.status_code == 200, descartada.text

    respuesta = client.post(
        f"{ruta}/confirmar",
        headers=headers,
        json=confirmar_payload(),
    )

    assert respuesta.status_code == 409, respuesta.text
    assert stocks(client, headers) == antes


def test_confirmacion_simultanea_suma_una_sola_vez(client, headers):
    deteccion = subir(client, headers)
    ruta = f"/api/detecciones/{deteccion['id']}/confirmar"
    barrera = Barrier(2)

    def confirmar():
        barrera.wait(timeout=15)
        return client.post(
            ruta,
            headers=headers,
            json=confirmar_payload(),
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futuros = [executor.submit(confirmar) for _ in range(2)]
        respuestas = [futuro.result(timeout=30) for futuro in futuros]

    assert sorted(
        respuesta.status_code for respuesta in respuestas
    ) == [200, 409], [
        (respuesta.status_code, respuesta.text)
        for respuesta in respuestas
    ]

    assert stocks(client, headers) == {1: 12, 2: 9}

    historial = client.get(
        "/api/inventario/movimientos",
        headers=headers,
    )
    assert historial.status_code == 200, historial.text

    movimientos = [
        movimiento
        for movimiento in historial.json()
        if movimiento["deteccion_id"] == deteccion["id"]
    ]
    assert len(movimientos) == 2


def test_ventas_simultaneas_no_dejan_stock_negativo(client, headers):
    barrera = Barrier(2)

    def vender():
        barrera.wait(timeout=15)
        return client.post(
            "/api/inventario/movimientos",
            headers=headers,
            json={
                "producto_id": 1,
                "tipo": "venta",
                "cantidad": 7,
            },
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futuros = [executor.submit(vender) for _ in range(2)]
        respuestas = [futuro.result(timeout=30) for futuro in futuros]

    assert sorted(
        respuesta.status_code for respuesta in respuestas
    ) == [201, 409], [
        (respuesta.status_code, respuesta.text)
        for respuesta in respuestas
    ]

    assert stocks(client, headers)[1] == 3

    historial = client.get(
        "/api/inventario/movimientos",
        headers=headers,
    )
    assert historial.status_code == 200, historial.text
    assert len(historial.json()) == 1
    