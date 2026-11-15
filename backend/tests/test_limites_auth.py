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
    