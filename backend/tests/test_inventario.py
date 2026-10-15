from io import BytesIO

from PIL import Image


def crear_imagen_png() -> bytes:
    buffer = BytesIO()

    with Image.new("RGB", (100, 100), color="white") as image:
        image.save(buffer, format="PNG")

    return buffer.getvalue()


def subir_deteccion(client, headers):
    response = client.post(
        "/api/detecciones",
        headers=headers,
        files={
            "file": (
                "recepcion_prueba.png",
                crear_imagen_png(),
                "image/png",
            )
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def consultar_stock(client, headers):
    response = client.get("/api/productos", headers=headers)
    assert response.status_code == 200, response.text

    return {
        producto["id"]: producto["stock_actual"]
        for producto in response.json()
    }


def test_login_y_usuario(client, headers):
    response = client.get("/api/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json()["email"] == "pruebas@inventario.local"


def test_productos_requieren_autenticacion(client):
    response = client.get("/api/productos")

    assert response.status_code == 401


def test_productos_ordenados(client, headers):
    response = client.get("/api/productos", headers=headers)

    assert response.status_code == 200
    assert [
        producto["clase_yolo"]
        for producto in response.json()
    ] == [0, 1]


def test_venta_descuenta_stock(client, headers):
    response = client.post(
        "/api/inventario/movimientos",
        headers=headers,
        json={
            "producto_id": 1,
            "tipo": "venta",
            "cantidad": 2,
        },
    )

    assert response.status_code == 201, response.text

    movimiento = response.json()
    assert movimiento["cantidad"] == -2
    assert movimiento["stock_antes"] == 10
    assert movimiento["stock_despues"] == 8
    assert consultar_stock(client, headers)[1] == 8


def test_venta_sin_stock_no_crea_movimiento(client, headers):
    response = client.post(
        "/api/inventario/movimientos",
        headers=headers,
        json={
            "producto_id": 1,
            "tipo": "venta",
            "cantidad": 11,
        },
    )

    assert response.status_code == 409
    assert consultar_stock(client, headers)[1] == 10

    historial = client.get(
        "/api/inventario/movimientos",
        headers=headers,
    )
    assert historial.status_code == 200
    assert historial.json() == []


def test_subir_deteccion_no_cambia_stock(client, headers):
    antes = consultar_stock(client, headers)
    deteccion = subir_deteccion(client, headers)

    assert deteccion["estado"] == "pendiente"
    assert deteccion["modelo_version"] == "stub-v1"

    conteos = {
        item["producto_id"]: item["cantidad_detectada"]
        for item in deteccion["items"]
    }
    assert conteos == {1: 2, 2: 1}
    assert consultar_stock(client, headers) == antes


def test_confirmacion_suma_una_sola_vez(client, headers):
    deteccion = subir_deteccion(client, headers)
    deteccion_id = deteccion["id"]

    payload = {
        "items": [
            {"producto_id": 1, "cantidad_confirmada": 2},
            {"producto_id": 2, "cantidad_confirmada": 1},
        ]
    }

    response = client.post(
        f"/api/detecciones/{deteccion_id}/confirmar",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "confirmada"
    assert consultar_stock(client, headers) == {1: 12, 2: 9}

    repetida = client.post(
        f"/api/detecciones/{deteccion_id}/confirmar",
        headers=headers,
        json=payload,
    )

    assert repetida.status_code == 409
    assert consultar_stock(client, headers) == {1: 12, 2: 9}

    historial = client.get(
        "/api/inventario/movimientos",
        headers=headers,
    )
    assert historial.status_code == 200

    movimientos = historial.json()
    assert len(movimientos) == 2
    assert all(
        movimiento["tipo"] == "entrada_deteccion"
        and movimiento["deteccion_id"] == deteccion_id
        for movimiento in movimientos
    )


def test_descartar_no_cambia_stock(client, headers):
    antes = consultar_stock(client, headers)
    deteccion = subir_deteccion(client, headers)

    response = client.post(
        f"/api/detecciones/{deteccion['id']}/descartar",
        headers=headers,
        json={"motivo": "Prueba automatizada"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["estado"] == "descartada"
    assert consultar_stock(client, headers) == antes


def test_imagen_requiere_token(client, headers):
    deteccion = subir_deteccion(client, headers)
    ruta = f"/api/detecciones/{deteccion['id']}/imagen"

    sin_token = client.get(ruta)
    assert sin_token.status_code == 401

    con_token = client.get(ruta, headers=headers)
    assert con_token.status_code == 200
    assert con_token.headers["content-type"].startswith("image/")



def test_ajuste_negativo_actualiza_stock(client, headers):
    response = client.post(
        "/api/inventario/movimientos",
        headers=headers,
        json={
            "producto_id": 1,
            "tipo": "ajuste",
            "cantidad": -4,
        },
    )

    assert response.status_code == 201, response.text

    movimiento = response.json()
    assert movimiento["tipo"] == "ajuste"
    assert movimiento["cantidad"] == -4
    assert movimiento["stock_antes"] == 10
    assert movimiento["stock_despues"] == 6
    assert consultar_stock(client, headers)[1] == 6

def test_ajuste_cero_se_rechaza(client, headers):
    response = client.post(
        "/api/inventario/movimientos",
        headers=headers,
        json={
            "producto_id": 1,
            "tipo": "ajuste",
            "cantidad": 0,
        },
    )

    assert response.status_code == 422
    assert consultar_stock(client, headers)[1] == 10

    historial = client.get(
        "/api/inventario/movimientos",
        headers=headers,
    )

    assert historial.status_code == 200
    assert historial.json() == []


def test_stock_bajo_genera_una_sola_alerta(client, headers):
    # Producto 1: stock inicial 10 y umbral 3.
    response = client.post(
        "/api/inventario/movimientos",
        headers=headers,
        json={
            "producto_id": 1,
            "tipo": "venta",
            "cantidad": 7,
        },
    )
    assert response.status_code == 201, response.text
    assert consultar_stock(client, headers)[1] == 3

    alertas = client.get("/api/alertas", headers=headers)
    assert alertas.status_code == 200

    pendientes = alertas.json()
    assert len(pendientes) == 1
    assert pendientes[0]["producto_id"] == 1
    assert pendientes[0]["tipo"] == "stock_bajo"
    assert pendientes[0]["atendida"] is False

    # Otra venta mantiene stock bajo sin crear una alerta duplicada.
    segunda_venta = client.post(
        "/api/inventario/movimientos",
        headers=headers,
        json={
            "producto_id": 1,
            "tipo": "venta",
            "cantidad": 1,
        },
    )
    assert segunda_venta.status_code == 201, segunda_venta.text
    assert consultar_stock(client, headers)[1] == 2

    alertas = client.get("/api/alertas", headers=headers)
    assert alertas.status_code == 200
    assert len(alertas.json()) == 1


def test_recuperar_stock_atiende_alerta(client, headers):
    venta = client.post(
        "/api/inventario/movimientos",
        headers=headers,
        json={
            "producto_id": 1,
            "tipo": "venta",
            "cantidad": 7,
        },
    )
    assert venta.status_code == 201, venta.text

    pendientes = client.get("/api/alertas", headers=headers)
    assert pendientes.status_code == 200
    assert len(pendientes.json()) == 1

    # Ajuste de prueba: sube de 3 a 5, por encima del umbral.
    ajuste = client.post(
        "/api/inventario/movimientos",
        headers=headers,
        json={
            "producto_id": 1,
            "tipo": "ajuste",
            "cantidad": 2,
        },
    )
    assert ajuste.status_code == 201, ajuste.text
    assert consultar_stock(client, headers)[1] == 5

    pendientes = client.get("/api/alertas", headers=headers)
    assert pendientes.status_code == 200
    assert pendientes.json() == []