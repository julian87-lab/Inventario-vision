from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Invitacion(Base):
    __tablename__ = "invitaciones"
    __table_args__ = (
        CheckConstraint(
            "rol IN ('administrador','operador')", name="ck_invitaciones_rol"
        ),
        Index(
            "uq_invitacion_pendiente_email",
            "email",
            unique=True,
            postgresql_where=text("usada_en IS NULL AND revocada_en IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    rol: Mapped[str] = mapped_column(String(20))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    creada_por_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    creada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    usada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revocada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    usuario_id: Mapped[int | None] = mapped_column(
        ForeignKey("usuarios.id", ondelete="SET NULL")
    )

    @property
    def estado(self) -> str:
        if self.usada_en is not None:
            return "usada"
        if self.revocada_en is not None:
            return "revocada"
        if self.expira_en <= datetime.now(timezone.utc):
            return "vencida"
        return "pendiente"
    