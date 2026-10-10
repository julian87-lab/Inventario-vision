from fastapi import APIRouter

from ..deps import CurrentUser, DbSession
from ..models import Alerta
from ..schemas.alerta import AlertaRead
from ..services.alerta_service import listar_alertas_pendientes


router = APIRouter(
    prefix="/alertas",
    tags=["alertas"],
)


@router.get("", response_model=list[AlertaRead])
async def obtener_alertas(
    db: DbSession,
    usuario: CurrentUser,
) -> list[Alerta]:
    return await listar_alertas_pendientes(db)

