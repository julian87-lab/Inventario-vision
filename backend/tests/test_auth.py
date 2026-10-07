EMAIL = "tendero@tienda.local"
PASSWORD = "CambiaEsta123!"


def login(client, email: str, password: str):
    return client.post(
        "/api/auth/login", data={"username": email, "password": password}
    )


def test_login_correcto(client) -> None:
    response = login(client, EMAIL, PASSWORD)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_clave_incorrecta(client) -> None:
    assert login(client, EMAIL, "incorrecta").status_code == 401


def test_login_usuario_inexistente(client) -> None:
    assert login(client, "nadie@tienda.local", "x").status_code == 401


def test_me_con_token(client) -> None:
    token = login(client, EMAIL, PASSWORD).json()["access_token"]

    response = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == EMAIL


def test_me_sin_token(client) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_me_token_invalido(client) -> None:
    response = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer abc"}
    )

    assert response.status_code == 401