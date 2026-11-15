import asyncio
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy import select

from backend.app.models import EventoAuditoria, Usuario
from backend.app.security import create_access_token
from conftest import TestSessionLocal


def headers_usuario(usuario_id: int):
    token = create_access_token(
        subject=str(usuario_id),
        token_version=0,
    )
    return {"Authorization": f"Bearer {token}"}


async def datos_usuario(usuario_id: int):
    async with TestSessionLocal() as db:
        usuario = await db.get(Usuario, usuario_id)
        assert usuario is not None

        return {
            "id": usuario.id,
            "rol": usuario.rol,
            "activo": usuario.activo,
            "token_version": usuario.token_version,
        }


async def promover_segundo_administrador():
    async with TestSessionLocal() as db:
        usuario = await db.get(Usuario, 2)
        assert usuario is not None

        usuario.rol = "administrador"
        await db.commit()


async def administradores_activos():
    async with TestSessionLocal() as db:
        resultado = await db.execute(
            select(Usuario.id).where(
                Usuario.rol == "administrador",
                Usuario.activo.is_(True),
            )
        )
        return list(resultado.scalars().all())


async def acciones_usuario(usuario_id: int):
    async with TestSessionLocal() as db:
        resultado = await db.execute(
            select(EventoAuditoria.accion).where(
                EventoAuditoria.objeto_tipo == "usuario",
                EventoAuditoria.objeto_id == usuario_id,
            )
        )
        return list(resultado.scalars().all())


@pytest.mark.parametrize(
    "cambio",
    [
        {"rol": "operador"},
        {"activo": False},
    ],
)
def test_admin_no_modifica_su_propia_cuenta(client, cambio):
    antes = asyncio.run(datos_usuario(1))

    respuesta = client.patch(
        "/api/admin/usuarios/1",
        headers=headers_usuario(1),
        json=cambio,
    )

    assert respuesta.status_code == 409, respuesta.text
    assert asyncio.run(datos_usuario(1)) == antes
    assert asyncio.run(administradores_activos()) == [1]
    assert asyncio.run(acciones_usuario(1)) == []


def test_operador_no_modifica_usuarios(client):
    antes = asyncio.run(datos_usuario(3))

    respuesta = client.patch(
        "/api/admin/usuarios/3",
        headers=headers_usuario(2),
        json={"rol": "administrador"},
    )

    assert respuesta.status_code == 403, respuesta.text
    assert asyncio.run(datos_usuario(3)) == antes
    assert asyncio.run(acciones_usuario(3)) == []


def test_desactivar_y_reactivar_no_revalida_token_anterior(client):
    admin = headers_usuario(1)
    sesion_anterior = headers_usuario(2)

    assert client.get(
        "/api/auth/me",
        headers=sesion_anterior,
    ).status_code == 200

    desactivacion = client.patch(
        "/api/admin/usuarios/2",
        headers=admin,
        json={"activo": False},
    )

    assert desactivacion.status_code == 200, desactivacion.text
    assert desactivacion.json()["activo"] is False

    desactivado = asyncio.run(datos_usuario(2))
    assert desactivado["activo"] is False
    assert desactivado["token_version"] == 1

    assert client.get(
        "/api/auth/me",
        headers=sesion_anterior,
    ).status_code == 401

    reactivacion = client.patch(
        "/api/admin/usuarios/2",
        headers=admin,
        json={"activo": True},
    )

    assert reactivacion.status_code == 200, reactivacion.text
    assert reactivacion.json()["activo"] is True

    # Reactivar no debe volver a aceptar el token anterior.
    assert client.get(
        "/api/auth/me",
        headers=sesion_anterior,
    ).status_code == 401

    login = client.post(
        "/api/auth/login",
        data={
            "username": "operador@inventario.local",
            "password": "PruebasSeguras123!",
        },
    )

    assert login.status_code == 200, login.text

    nueva_sesion = {
        "Authorization": f"Bearer {login.json()['access_token']}"
    }

    assert client.get(
        "/api/auth/me",
        headers=nueva_sesion,
    ).status_code == 200

    acciones = asyncio.run(acciones_usuario(2))
    assert acciones.count("usuario_desactivado") == 1
    assert acciones.count("usuario_activado") == 1


def test_cambio_de_rol_actualiza_permisos_de_sesion_abierta(client):
    admin = headers_usuario(1)
    sesion_operador = headers_usuario(2)

    assert client.get(
        "/api/admin/usuarios",
        headers=sesion_operador,
    ).status_code == 403

    promocion = client.patch(
        "/api/admin/usuarios/2",
        headers=admin,
        json={"rol": "administrador"},
    )

    assert promocion.status_code == 200, promocion.text
    assert promocion.json()["rol"] == "administrador"

    # Se reutiliza el mismo token, sin iniciar sesión otra vez.
    assert client.get(
        "/api/admin/usuarios",
        headers=sesion_operador,
    ).status_code == 200

    degradacion = client.patch(
        "/api/admin/usuarios/2",
        headers=admin,
        json={"rol": "operador"},
    )

    assert degradacion.status_code == 200, degradacion.text
    assert degradacion.json()["rol"] == "operador"

    assert client.get(
        "/api/admin/usuarios",
        headers=sesion_operador,
    ).status_code == 403

    assert asyncio.run(administradores_activos()) == [1]

    acciones = asyncio.run(acciones_usuario(2))
    assert acciones.count("rol_cambiado") == 2


def test_actualizacion_sin_cambios_se_rechaza(client):
    antes = asyncio.run(datos_usuario(2))

    respuesta = client.patch(
        "/api/admin/usuarios/2",
        headers=headers_usuario(1),
        json={},
    )

    assert respuesta.status_code == 422, respuesta.text
    assert asyncio.run(datos_usuario(2)) == antes
    assert asyncio.run(acciones_usuario(2)) == []


def test_cambios_simultaneos_conservan_administrador_activo(client):
    asyncio.run(promover_segundo_administrador())

    assert set(
        asyncio.run(administradores_activos())
    ) == {1, 2}

    barrera = Barrier(2)

    def quitar_rol(actor_id: int, objetivo_id: int):
        barrera.wait(timeout=15)

        return client.patch(
            f"/api/admin/usuarios/{objetivo_id}",
            headers=headers_usuario(actor_id),
            json={"rol": "operador"},
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futuros = [
            executor.submit(quitar_rol, 1, 2),
            executor.submit(quitar_rol, 2, 1),
        ]
        respuestas = [
            futuro.result(timeout=30)
            for futuro in futuros
        ]

    codigos = [
        respuesta.status_code
        for respuesta in respuestas
    ]

    detalle = [
        (respuesta.status_code, respuesta.text)
        for respuesta in respuestas
    ]

    assert codigos.count(200) == 1, detalle

    # Puede rechazarse por pérdida del permiso durante la petición
    # o por la regla que conserva un administrador activo.
    assert all(
        codigo in (200, 403, 409)
        for codigo in codigos
    ), detalle

    restantes = asyncio.run(administradores_activos())
    assert len(restantes) == 1, (restantes, detalle)

    acciones = (
        asyncio.run(acciones_usuario(1))
        + asyncio.run(acciones_usuario(2))
    )

    assert acciones.count("rol_cambiado") == 1
    