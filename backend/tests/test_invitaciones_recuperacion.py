import asyncio
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import select, text

from backend.app.models import Invitacion, PasswordResetToken
from backend.app.routers import admin, auth
from backend.app.security import create_access_token
from backend.app.services import recuperacion_service
from backend.app.services.rate_limit import LimitadorVentana
from backend.app.tokens import hash_token

from conftest import TestSessionLocal


PASSWORD_NUEVA = "NuevaContrasenaSegura456!"
EMAIL_OPERADOR = "operador@inventario.local"


def headers_usuario(usuario_id: int):
    token = create_access_token(
        subject=str(usuario_id),
        token_version=0,
    )
    return {"Authorization": f"Bearer {token}"}


def extraer_token(enlace: str) -> str:
    valores = parse_qs(urlsplit(enlace).fragment)
    assert "token" in valores, enlace
    return valores["token"][0]


async def sincronizar_secuencia_usuarios():
    async with TestSessionLocal() as db:
        await db.execute(
            text(
                """
                SELECT setval(
                    pg_get_serial_sequence('usuarios', 'id'),
                    (SELECT MAX(id) FROM usuarios),
                    true
                )
                """
            )
        )
        await db.commit()


async def vencer_invitacion(token: str):
    async with TestSessionLocal() as db:
        resultado = await db.execute(
            select(Invitacion).where(
                Invitacion.token_hash == hash_token(token)
            )
        )
        invitacion = resultado.scalar_one()
        invitacion.expira_en = (
            datetime.now(timezone.utc) - timedelta(minutes=1)
        )
        await db.commit()


async def vencer_recuperacion(token: str):
    async with TestSessionLocal() as db:
        resultado = await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash
                == recuperacion_service._hash_token(token)
            )
        )
        registro = resultado.scalar_one()
        registro.expira_en = (
            datetime.now(timezone.utc) - timedelta(minutes=1)
        )
        await db.commit()


@pytest.fixture
def entorno_correos(client, monkeypatch):
    correos = {
        "invitaciones": [],
        "recuperaciones": [],
        "avisos": [],
    }

    async def enviar_invitacion(
        destino,
        nombre_admin,
        rol,
        enlace,
    ):
        correos["invitaciones"].append(
            {
                "destino": destino,
                "nombre_admin": nombre_admin,
                "rol": rol,
                "enlace": enlace,
            }
        )

    async def enviar_recuperacion(destino, nombre, enlace):
        correos["recuperaciones"].append(
            {
                "destino": destino,
                "nombre": nombre,
                "enlace": enlace,
            }
        )

    async def enviar_aviso(destino, nombre):
        correos["avisos"].append(
            {
                "destino": destino,
                "nombre": nombre,
            }
        )

    monkeypatch.setattr(
        admin,
        "_limite_invitaciones",
        LimitadorVentana(
            maximo=20,
            ventana_segundos=60 * 60,
        ),
    )

    monkeypatch.setattr(
        admin,
        "enviar_correo_invitacion",
        enviar_invitacion,
    )

    monkeypatch.setattr(
        recuperacion_service,
        "AsyncSessionLocal",
        TestSessionLocal,
    )

    monkeypatch.setattr(
        recuperacion_service,
        "enviar_correo_recuperacion",
        enviar_recuperacion,
    )

    monkeypatch.setattr(
        auth,
        "enviar_aviso_cambio_contrasena",
        enviar_aviso,
    )

    asyncio.run(sincronizar_secuencia_usuarios())

    return correos


def crear_invitacion(client, correos, email="nueva@inventario.local"):
    respuesta = client.post(
        "/api/admin/invitaciones",
        headers=headers_usuario(1),
        json={
            "email": email,
            "rol": "operador",
        },
    )

    assert respuesta.status_code == 201, respuesta.text
    assert correos["invitaciones"]

    token = extraer_token(
        correos["invitaciones"][-1]["enlace"]
    )

    return respuesta.json(), token


def registrar(client, token: str):
    return client.post(
        "/api/auth/registro",
        json={
            "token": token,
            "nombre": "Nueva Persona",
            "password": PASSWORD_NUEVA,
        },
    )


def solicitar_recuperacion(client, correos):
    respuesta = client.post(
        "/api/auth/forgot-password",
        json={"email": EMAIL_OPERADOR},
    )

    assert respuesta.status_code == 202, respuesta.text
    assert len(correos["recuperaciones"]) == 1

    return extraer_token(
        correos["recuperaciones"][0]["enlace"]
    )


def test_operador_no_accede_a_consultas_administrativas(
    client,
    entorno_correos,
):
    headers = headers_usuario(2)

    for ruta in (
        "/api/admin/usuarios",
        "/api/admin/invitaciones",
        "/api/admin/auditoria",
    ):
        respuesta = client.get(ruta, headers=headers)
        assert respuesta.status_code == 403, (
            ruta,
            respuesta.text,
        )


def test_invitacion_registro_y_uso_unico(client, entorno_correos):
    correos = entorno_correos

    _, token = crear_invitacion(client, correos)

    consulta = client.post(
        "/api/auth/invitacion/consultar",
        json={"token": token},
    )

    assert consulta.status_code == 200, consulta.text
    assert consulta.json()["email"] == "nueva@inventario.local"
    assert consulta.json()["rol"] == "operador"

    respuesta = registrar(client, token)

    assert respuesta.status_code == 201, respuesta.text

    repetida = registrar(client, token)
    assert repetida.status_code == 400, repetida.text

    consulta_repetida = client.post(
        "/api/auth/invitacion/consultar",
        json={"token": token},
    )
    assert consulta_repetida.status_code == 400

    login = client.post(
        "/api/auth/login",
        data={
            "username": "nueva@inventario.local",
            "password": PASSWORD_NUEVA,
        },
    )

    assert login.status_code == 200, login.text

    perfil = client.get(
        "/api/auth/me",
        headers={
            "Authorization": (
                f"Bearer {login.json()['access_token']}"
            )
        },
    )

    assert perfil.status_code == 200, perfil.text
    assert perfil.json()["rol"] == "operador"
    assert perfil.json()["nombre"] == "Nueva Persona"


def test_invitacion_revocada_no_permite_registro(
    client,
    entorno_correos,
):
    invitacion, token = crear_invitacion(
        client,
        entorno_correos,
    )

    revocada = client.post(
        f"/api/admin/invitaciones/{invitacion['id']}/revocar",
        headers=headers_usuario(1),
    )

    assert revocada.status_code == 200, revocada.text

    respuesta = registrar(client, token)
    assert respuesta.status_code == 400, respuesta.text


def test_reenvio_invalida_token_anterior(client, entorno_correos):
    correos = entorno_correos
    invitacion, anterior = crear_invitacion(client, correos)

    respuesta = client.post(
        f"/api/admin/invitaciones/{invitacion['id']}/reenviar",
        headers=headers_usuario(1),
    )

    assert respuesta.status_code == 200, respuesta.text
    assert len(correos["invitaciones"]) == 2

    nuevo = extraer_token(
        correos["invitaciones"][-1]["enlace"]
    )

    assert nuevo != anterior

    consulta_anterior = client.post(
        "/api/auth/invitacion/consultar",
        json={"token": anterior},
    )
    assert consulta_anterior.status_code == 400

    registro_nuevo = registrar(client, nuevo)
    assert registro_nuevo.status_code == 201, registro_nuevo.text


def test_invitacion_vencida_no_permite_registro(
    client,
    entorno_correos,
):
    _, token = crear_invitacion(client, entorno_correos)

    asyncio.run(vencer_invitacion(token))

    consulta = client.post(
        "/api/auth/invitacion/consultar",
        json={"token": token},
    )
    assert consulta.status_code == 400, consulta.text

    respuesta = registrar(client, token)
    assert respuesta.status_code == 400, respuesta.text


def test_recuperacion_cambia_clave_invalida_sesion_y_es_unica(
    client,
    entorno_correos,
):
    correos = entorno_correos
    sesion_anterior = headers_usuario(2)

    assert client.get(
        "/api/auth/me",
        headers=sesion_anterior,
    ).status_code == 200

    token = solicitar_recuperacion(client, correos)

    respuesta = client.post(
        "/api/auth/reset-password",
        json={
            "token": token,
            "password": PASSWORD_NUEVA,
        },
    )

    assert respuesta.status_code == 200, respuesta.text
    assert len(correos["avisos"]) == 1
    assert correos["avisos"][0]["destino"] == EMAIL_OPERADOR

    assert client.get(
        "/api/auth/me",
        headers=sesion_anterior,
    ).status_code == 401

    login_anterior = client.post(
        "/api/auth/login",
        data={
            "username": EMAIL_OPERADOR,
            "password": "PruebasSeguras123!",
        },
    )
    assert login_anterior.status_code == 401

    login_nuevo = client.post(
        "/api/auth/login",
        data={
            "username": EMAIL_OPERADOR,
            "password": PASSWORD_NUEVA,
        },
    )
    assert login_nuevo.status_code == 200, login_nuevo.text

    repetida = client.post(
        "/api/auth/reset-password",
        json={
            "token": token,
            "password": "OtraContrasenaSegura789!",
        },
    )
    assert repetida.status_code == 400, repetida.text
    assert len(correos["avisos"]) == 1


def test_recuperacion_vencida_no_cambia_clave(
    client,
    entorno_correos,
):
    token = solicitar_recuperacion(
        client,
        entorno_correos,
    )

    asyncio.run(vencer_recuperacion(token))

    respuesta = client.post(
        "/api/auth/reset-password",
        json={
            "token": token,
            "password": PASSWORD_NUEVA,
        },
    )

    assert respuesta.status_code == 400, respuesta.text
    assert entorno_correos["avisos"] == []

    login = client.post(
        "/api/auth/login",
        data={
            "username": EMAIL_OPERADOR,
            "password": "PruebasSeguras123!",
        },
    )

    assert login.status_code == 200, login.text


def test_recuperacion_no_revela_si_correo_existe(
    client,
    entorno_correos,
):
    conocida = client.post(
        "/api/auth/forgot-password",
        json={"email": EMAIL_OPERADOR},
    )

    desconocida = client.post(
        "/api/auth/forgot-password",
        json={"email": "inexistente@inventario.local"},
    )

    assert conocida.status_code == 202, conocida.text
    assert desconocida.status_code == 202, desconocida.text
    assert conocida.json() == desconocida.json()

    assert len(entorno_correos["recuperaciones"]) == 1
    assert (
        entorno_correos["recuperaciones"][0]["destino"]
        == EMAIL_OPERADOR
    )
    