from fastapi import FastAPI, HTTPException, Request
from sqlalchemy import text

from .config import settings
from .deps import DbSession
from .routers import admin, alertas, auth, detecciones, inventario, productos


ES_PRODUCCION = settings.environment.strip().lower() == "production"


app = FastAPI(
    title="Inventario Vision API",
    version="0.1.0",
    docs_url=None if ES_PRODUCCION else "/docs",
    redoc_url=None if ES_PRODUCCION else "/redoc",
    openapi_url=None if ES_PRODUCCION else "/openapi.json",
)


@app.middleware("http")
async def agregar_cabeceras_seguridad(request: Request, call_next):
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"

    if request.url.path == "/api" or request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"

    return response


app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(productos.router, prefix="/api")
app.include_router(inventario.router, prefix="/api")
app.include_router(alertas.router, prefix="/api")
app.include_router(detecciones.router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
async def health_db(db: DbSession) -> dict[str, str]:
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc
