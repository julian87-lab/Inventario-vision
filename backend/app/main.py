from fastapi import FastAPI, HTTPException
from sqlalchemy import text

from .deps import DbSession


app = FastAPI(
    title="Inventario Vision API",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/health/db")
async def health_db(db: DbSession) -> dict[str, str]:
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc