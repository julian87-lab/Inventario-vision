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

# Solo cambia variables dentro del proceso de pytest, no el archivo .env.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["JWT_SECRET_KEY"] = (
    "clave-exclusiva-de-pruebas-no-usar-en-produccion-123456789"
)

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.main import app
from backend.app.models import Base, Producto, Usuario
from backend.app.security import hash_password


test_engine = create_async_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    expire_on_commit=False,
)

TEST_EMAIL = "pruebas@inventario.local"
TEST_PASSWORD = "PruebasSeguras123!"


def comprobar_base_de_pruebas() -> None:
    url = make_url(TEST_DATABASE_URL)

    if (
        url.host != "127.0.0.1"
        or url.port != 15433
        or url.database != "inventario_test"
    ):
        raise RuntimeError(
            "Se cancelaron las pruebas: la base no es inventario_test "
            "en 127.0.0.1:15433."
        )


async def preparar_base() -> None:
    comprobar_base_de_pruebas()

    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as db:
        db.add(
            Usuario(
                id=1,
                nombre="Usuario de pruebas",
                email=TEST_EMAIL,
                password_hash=hash_password(TEST_PASSWORD),
            )
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
    asyncio.run(preparar_base())

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
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
