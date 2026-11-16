from backend.app.routers import auth
from backend.app.services.rate_limit import LimitadorVentana


def test_login_bloquea_al_superar_diez_intentos(client):
    datos = {
        "username": "limite@inventario.local",
        "password": "contrasena-incorrecta",
    }

    for intento in range(10):
        respuesta = client.post(
            "/api/auth/login",
            data=datos,
        )

        assert respuesta.status_code == 401, (
            f"Intento {intento + 1}: "
            f"{respuesta.status_code} - {respuesta.text}"
        )

    bloqueada = client.post(
        "/api/auth/login",
        data=datos,
    )

    assert bloqueada.status_code == 429, bloqueada.text
    assert bloqueada.headers.get("Retry-After") == "900"
    assert bloqueada.json()["detail"] == (
        "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."
    )


def test_login_no_comparte_contador_entre_correos(client):
    for _ in range(10):
        respuesta = client.post(
            "/api/auth/login",
            data={
                "username": "primero@inventario.local",
                "password": "incorrecta",
            },
        )

        assert respuesta.status_code == 401, respuesta.text

    bloqueada = client.post(
        "/api/auth/login",
        data={
            "username": "primero@inventario.local",
            "password": "incorrecta",
        },
    )

    assert bloqueada.status_code == 429, bloqueada.text

    otro_correo = client.post(
        "/api/auth/login",
        data={
            "username": "segundo@inventario.local",
            "password": "incorrecta",
        },
    )

    assert otro_correo.status_code == 401, otro_correo.text


def test_login_limita_ip_aunque_cambie_correo(client, monkeypatch):
    monkeypatch.setattr(
        auth,
        "_limite_login_ip",
        LimitadorVentana(maximo=3, ventana_segundos=15 * 60),
    )

    for intento in range(3):
        respuesta = client.post(
            "/api/auth/login",
            data={
                "username": f"correo-{intento}@inventario.local",
                "password": "incorrecta",
            },
        )

        assert respuesta.status_code == 401, respuesta.text

    bloqueada = client.post(
        "/api/auth/login",
        data={
            "username": "otro-correo@inventario.local",
            "password": "incorrecta",
        },
    )

    assert bloqueada.status_code == 429, bloqueada.text
    assert bloqueada.headers.get("Retry-After") == "900"


def test_login_limita_correo_aunque_cambie_ip(client, monkeypatch):
    monkeypatch.setattr(
        auth,
        "_limite_login_correo",
        LimitadorVentana(maximo=3, ventana_segundos=15 * 60),
    )

    datos = {
        "username": "cuenta-compartida@inventario.local",
        "password": "incorrecta",
    }

    for intento in range(3):
        monkeypatch.setattr(
            auth,
            "_ip_cliente",
            lambda request, numero=intento: f"192.0.2.{numero + 1}",
        )

        respuesta = client.post(
            "/api/auth/login",
            data=datos,
        )

        assert respuesta.status_code == 401, respuesta.text

    monkeypatch.setattr(
        auth,
        "_ip_cliente",
        lambda request: "192.0.2.100",
    )

    bloqueada = client.post(
        "/api/auth/login",
        data=datos,
    )

    assert bloqueada.status_code == 429, bloqueada.text
    assert bloqueada.headers.get("Retry-After") == "900"
    