import logging
import smtplib
import ssl
from email.message import EmailMessage
from html import escape

from fastapi.concurrency import run_in_threadpool

from ..config import settings

logger = logging.getLogger(__name__)


def _enviar_por_smtp(mensaje: EmailMessage) -> None:
    contexto = ssl.create_default_context()
    host = settings.smtp_host or ""

    if settings.smtp_ssl:
        servidor = smtplib.SMTP_SSL(
            host,
            settings.smtp_port,
            timeout=20,
            context=contexto,
        )
    else:
        servidor = smtplib.SMTP(
            host,
            settings.smtp_port,
            timeout=20,
        )

    with servidor:
        if not settings.smtp_ssl and settings.smtp_starttls:
            servidor.starttls(context=contexto)

        if settings.smtp_user and settings.smtp_password:
            servidor.login(
                settings.smtp_user,
                settings.smtp_password,
            )

        servidor.send_message(mensaje)


async def enviar_correo(
    destino: str,
    asunto: str,
    texto: str,
    html: str,
) -> None:
    if not settings.smtp_host:
        logger.error(
            "SMTP no configurado: no se envió el correo '%s'.",
            asunto,
        )
        return

    if not settings.smtp_from:
        logger.error(
            "SMTP_FROM no configurado: no se envió el correo '%s'.",
            asunto,
        )
        return

    try:
        mensaje = EmailMessage()
        mensaje["Subject"] = asunto
        mensaje["From"] = settings.smtp_from
        mensaje["To"] = destino
        mensaje.set_content(texto)
        mensaje.add_alternative(html, subtype="html")

        await run_in_threadpool(
            _enviar_por_smtp,
            mensaje,
        )

    except (smtplib.SMTPException, OSError, ValueError):
        logger.exception(
            "No se pudo enviar el correo '%s'",
            asunto,
        )


async def enviar_correo_recuperacion(
    destino: str,
    nombre: str,
    enlace: str,
) -> None:
    minutos = settings.password_reset_expire_minutes

    texto = (
        f"Hola, {nombre}.\n\n"
        "Recibimos una solicitud para restablecer tu contraseña de "
        "Inventario Visión.\n\n"
        "Abre este enlace para elegir una contraseña nueva. Vence en "
        f"{minutos} minutos y solo puede usarse una vez:\n{enlace}\n\n"
        "Si no fuiste tú, ignora este mensaje: tu contraseña actual no "
        "cambiará.\n"
    )

    html = (
        f"<p>Hola, {escape(nombre)}.</p>"
        "<p>Recibimos una solicitud para restablecer tu contraseña de "
        "Inventario Visión.</p>"
        f'<p><a href="{escape(enlace)}">'
        "Elegir una contraseña nueva"
        "</a></p>"
        f"<p>El enlace vence en {minutos} minutos y solo puede usarse "
        "una vez.</p>"
        "<p>Si no fuiste tú, ignora este mensaje: tu contraseña actual "
        "no cambiará.</p>"
    )

    await enviar_correo(
        destino,
        "Restablece tu contraseña de Inventario Visión",
        texto,
        html,
    )


async def enviar_aviso_cambio_contrasena(
    destino: str,
    nombre: str,
) -> None:
    texto = (
        f"Hola, {nombre}.\n\n"
        "La contraseña de tu cuenta de Inventario Visión se acaba de "
        "cambiar y se cerraron tus sesiones anteriores.\n\n"
        "Si no fuiste tú, solicita un restablecimiento de inmediato y "
        "avisa a quien administra la tienda.\n"
    )

    html = (
        f"<p>Hola, {escape(nombre)}.</p>"
        "<p>La contraseña de tu cuenta de Inventario Visión se acaba de "
        "cambiar y se cerraron tus sesiones anteriores.</p>"
        "<p>Si no fuiste tú, solicita un restablecimiento de inmediato y "
        "avisa a quien administra la tienda.</p>"
    )

    await enviar_correo(
        destino,
        "Tu contraseña de Inventario Visión cambió",
        texto,
        html,
    )


async def enviar_correo_invitacion(
    destino: str,
    invitador: str,
    rol: str,
    enlace: str,
) -> None:
    horas = settings.invitacion_expire_hours

    texto = (
        "Hola.\n\n"
        f"{invitador} te invitó a Inventario Visión con el rol de "
        f"{rol}.\n\n"
        "Abre este enlace para crear tu cuenta. Vence en "
        f"{horas} horas y solo puede usarse una vez:\n{enlace}\n\n"
        "Si no esperabas esta invitación, ignora este mensaje.\n"
    )

    html = (
        "<p>Hola.</p>"
        f"<p>{escape(invitador)} te invitó a Inventario Visión con el rol "
        f"de <strong>{escape(rol)}</strong>.</p>"
        f'<p><a href="{escape(enlace)}">Crear mi cuenta</a></p>'
        f"<p>El enlace vence en {horas} horas y solo puede usarse una "
        "vez.</p>"
        "<p>Si no esperabas esta invitación, ignora este mensaje.</p>"
    )

    await enviar_correo(
        destino,
        "Te invitaron a Inventario Visión",
        texto,
        html,
    )