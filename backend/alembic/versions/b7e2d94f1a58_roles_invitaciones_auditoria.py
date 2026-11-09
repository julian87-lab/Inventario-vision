"""roles, invitaciones y auditoria

Revision ID: b7e2d94f1a58
Revises: a3f1c9d27b64
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7e2d94f1a58"
down_revision: Union[str, Sequence[str], None] = "a3f1c9d27b64"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column(
            "rol",
            sa.String(length=20),
            server_default="operador",
            nullable=False,
        ),
    )

    op.add_column(
        "usuarios",
        sa.Column(
            "activo",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
    )

    op.create_check_constraint(
        "ck_usuarios_rol",
        "usuarios",
        "rol IN ('administrador','operador')",
    )

    op.create_table(
        "invitaciones",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("rol", sa.String(length=20), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("creada_por_id", sa.Integer(), nullable=False),
        sa.Column(
            "creada_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "expira_en",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "usada_en",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "revocada_en",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "rol IN ('administrador','operador')",
            name="ck_invitaciones_rol",
        ),
        sa.ForeignKeyConstraint(
            ["creada_por_id"],
            ["usuarios.id"],
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuarios.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_invitaciones_email"),
        "invitaciones",
        ["email"],
        unique=False,
    )

    op.create_index(
        op.f("ix_invitaciones_token_hash"),
        "invitaciones",
        ["token_hash"],
        unique=True,
    )

    op.create_index(
        "uq_invitacion_pendiente_email",
        "invitaciones",
        ["email"],
        unique=True,
        postgresql_where=sa.text(
            "usada_en IS NULL AND revocada_en IS NULL"
        ),
    )

    op.create_table(
        "eventos_auditoria",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("accion", sa.String(length=50), nullable=False),
        sa.Column("objeto_tipo", sa.String(length=30), nullable=False),
        sa.Column("objeto_id", sa.Integer(), nullable=True),
        sa.Column("detalle", sa.String(length=500), nullable=True),
        sa.Column(
            "fecha_hora",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuarios.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_eventos_auditoria_fecha",
        "eventos_auditoria",
        ["fecha_hora"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_eventos_auditoria_fecha",
        table_name="eventos_auditoria",
    )
    op.drop_table("eventos_auditoria")

    op.drop_index(
        "uq_invitacion_pendiente_email",
        table_name="invitaciones",
    )
    op.drop_index(
        op.f("ix_invitaciones_token_hash"),
        table_name="invitaciones",
    )
    op.drop_index(
        op.f("ix_invitaciones_email"),
        table_name="invitaciones",
    )
    op.drop_table("invitaciones")

    op.drop_constraint(
        "ck_usuarios_rol",
        "usuarios",
        type_="check",
    )
    op.drop_column("usuarios", "activo")
    op.drop_column("usuarios", "rol")
    