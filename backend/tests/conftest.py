import asyncio
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool


TEST_DATABASE_URL = (
    "postgresql+asyncpg://"
    "inventario_test:inventario_test@127.0.0.1:15433/inventario_test"
)

TEST_EMAIL = "pruebas@inventario.local"
TEST_PASSWORD = "PruebasSeguras123!"

# Estas variables afectan al proceso de pruebas, no modifican el .env.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["JWT_SECRET_KEY"] = (
    "clave-exclusiva-de-pruebas-no-usar-en-produccion-123456789"
)
os.environ["ENVIRONMENT"] = "test"
os.environ["DETECTOR"] = "stub"
os.environ["SMTP_HOST"] = ""


from backend.app.config import settings
from backend.app.database import get_db
from backend.app.main import app
from backend.app.models import Base, Producto, Usuario


test_engine = create_async_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    expire_on_commit=False,
)


def comprobar_base_de_pruebas() -> None:
    url = make_url(str(test_engine.url))

    if (
        url.drivername != "postgresql+asyncpg"
        or url.host != "127.0.0.1"
        or url.port != 15433
        or url.database != "inventario_test"
        or url.username != "inventario_test"
    ):
        raise RuntimeError(
            "Se cancelaron las pruebas: el motor no apunta a "
            "inventario_test en 127.0.0.1:15433."
        )


async def preparar_base() -> None:
    from backend.app.security import hash_password

    comprobar_base_de_pruebas()

    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    password_hash = hash_password(TEST_PASSWORD)

    async with TestSessionLocal() as db:
        db.add_all(
            [
                Usuario(
                    id=1,
                    nombre="Administrador de pruebas",
                    email=TEST_EMAIL,
                    password_hash=password_hash,
                    rol="administrador",
                    activo=True,
                    token_version=0,
                ),
                Usuario(
                    id=2,
                    nombre="Operador de pruebas",
                    email="operador@inventario.local",
                    password_hash=password_hash,
                    rol="operador",
                    activo=True,
                    token_version=0,
                ),
                Usuario(
                    id=3,
                    nombre="Segundo operador de pruebas",
                    email="otro@inventario.local",
                    password_hash=password_hash,
                    rol="operador",
                    activo=True,
                    token_version=0,
                ),
            ]
        )

        db.add_all(
            [
                Producto(
                    id=1,
                    clase_yolo=0,
                    nombre="Coca-Cola de prueba",
                    stock_actual=10,
                    umbral_alerta=3,
                    activo=True,
                ),
                Producto(
                    id=2,
                    clase_yolo=1,
                    nombre="Doritos de prueba",
                    stock_actual=8,
                    umbral_alerta=2,
                    activo=True,
                ),
            ]
        )

        await db.commit()


async def eliminar_base() -> None:
    comprobar_base_de_pruebas()

    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)

    await test_engine.dispose()


async def override_get_db():
    async with TestSessionLocal() as db:
        yield db


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    monkeypatch.setattr(settings, "detector", "stub")
    monkeypatch.setattr(settings, "environment", "test")
    monkeypatch.setattr(settings, "smtp_host", None)

    comprobar_base_de_pruebas()

    if make_url(settings.database_url) != make_url(TEST_DATABASE_URL):
        raise RuntimeError(
            "La configuración de la aplicación no apunta "
            "a la base exclusiva de pruebas."
        )

    asyncio.run(preparar_base())

    overrides_anteriores = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(overrides_anteriores)
        asyncio.run(eliminar_base())


@pytest.fixture
def headers(client):
    response = client.post(
        "/api/auth/login",
        data={
            "username": TEST_EMAIL,
            "password": TEST_PASSWORD,
        },
    )
    assert response.status_code == 200, response.text

    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def aislar_limitadores_autenticacion(monkeypatch):
    from backend.app.routers import auth
    from backend.app.services.rate_limit import LimitadorVentana

    limites = {
        "_limite_login": (10, 15 * 60),
        "_limite_login_ip": (50, 15 * 60),
        "_limite_login_correo": (30, 15 * 60),
        "_limite_solicitud": (10, 15 * 60),
        "_limite_restablecer": (10, 15 * 60),
        "_limite_registro": (10, 15 * 60),
        "_limite_cambio": (5, 15 * 60),
    }

    for nombre, (maximo, ventana_segundos) in limites.items():
        monkeypatch.setattr(
            auth,
            nombre,
            LimitadorVentana(
                maximo=maximo,
                ventana_segundos=ventana_segundos,
            ),
        )
