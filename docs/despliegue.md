# Despliegue de Inventario Visión

Este documento explica cómo se publica Inventario Visión en un servidor, cómo se configura el dominio con HTTPS y cómo se mantiene la aplicación en funcionamiento.

La versión publicada está disponible en `https://inventariovision.tech`.

## Visión general

En producción, la aplicación se ejecuta con Docker Compose en un servidor privado virtual. Cada componente corre en su propio contenedor:

```text
Internet
   |
   | HTTPS (puertos 80 y 443)
   v
web: Caddy
   |-- Archivos compilados del frontend
   |
   | /api
   v
api: FastAPI + detector YOLO
   |
   | Red interna
   v
db: PostgreSQL 16
```

- **web** recibe todas las peticiones, obtiene el certificado HTTPS y entrega la interfaz.
- **api** aplica las reglas del negocio y ejecuta el modelo YOLO en la CPU.
- **db** guarda la información y solo es accesible desde la API.

## Servidor

| Elemento | Valor |
|---|---|
| Proveedor | Hostinger |
| Plan | VPS KVM 2 |
| Recursos del plan | 2 vCPU, 8 GB de RAM y 100 GB de disco NVMe |
| Tarjeta gráfica | No tiene; la detección se ejecuta en CPU |
| Dominio | `inventariovision.tech` |

El modelo `best.pt` ocupa alrededor de 5 MB, por lo que puede ejecutarse en la CPU del servidor sin necesidad de una GPU.

## Archivos del despliegue

| Archivo | Función |
|---|---|
| `compose.deploy.yml` | Define los servicios `db`, `api` y `web`, sus redes y sus volúmenes |
| `.env.deploy.example` | Plantilla de las variables de entorno del despliegue |
| `backend/Dockerfile` | Construye la imagen de la API con Python 3.11 y PyTorch para CPU |
| `frontend/Dockerfile` | Compila el frontend con Node.js y lo publica en una imagen de Caddy |
| `deploy/Caddyfile` | Configura HTTPS, cabeceras de seguridad, rutas y bloqueos |
| `deploy/compose.restore.yml` | Entorno aislado para comprobar la restauración de un respaldo |
| `deploy/scripts/respaldo-local.ps1` | Genera un respaldo de la base de datos y de las fotografías |

## Servicios

| Servicio | Imagen | Función | Persistencia |
|---|---|---|---|
| `db` | `postgres:16-alpine` | Base de datos con verificación de salud | Volumen `postgres_data` |
| `api` | Imagen propia (`backend/Dockerfile`) | API y detector YOLO; verificación de salud contra `/health/db` | Volumen `uploads`; `backend/weights` montado en solo lectura |
| `web` | Imagen propia (`frontend/Dockerfile`, base Caddy) | HTTPS, archivos estáticos y proxy inverso hacia la API | Volúmenes `caddy_data` y `caddy_config` |

El orden de arranque está controlado por las verificaciones de salud:

1. `db` inicia y espera a que PostgreSQL acepte conexiones.
2. `api` inicia solo cuando `db` está saludable.
3. `web` inicia solo cuando `api` responde correctamente en `/health/db`.

Todos los servicios usan `restart: unless-stopped`, de modo que se reinician solos si el servidor se reinicia o si un contenedor falla.

### Redes

| Red | Servicios | Acceso |
|---|---|---|
| `web` | `web` y `api` | Comunicación entre Caddy y la API |
| `database` | `api` y `db` | Red interna, sin salida al exterior |

La base de datos no publica ningún puerto. Solo la API puede conectarse a ella.

### Registros

Los registros de cada contenedor se guardan en archivos de hasta 10 MB y se conservan los tres más recientes. Así se evita que llenen el disco del servidor.

## Variables de entorno

Las variables se definen en un archivo `.env.deploy` en la raíz del proyecto, creado a partir de `.env.deploy.example`.

> El archivo `.env.deploy` contiene contraseñas y claves. No debe compartirse ni subirse a Git.

| Variable | Uso | Valor en producción |
|---|---|---|
| `ENVIRONMENT` | Modo de la aplicación | `production` |
| `POSTGRES_PASSWORD` | Contraseña de la base de datos | Valor aleatorio hexadecimal |
| `JWT_SECRET_KEY` | Firma de los tokens de sesión | Valor aleatorio de al menos 32 caracteres |
| `SITE_ADDRESS` | Dirección que atiende Caddy | `inventariovision.tech` |
| `FRONTEND_URL` | Dirección usada en los enlaces de los correos | `https://inventariovision.tech` |
| `WEB_BIND_IP` | Interfaz donde se publican los puertos | `0.0.0.0` |
| `HTTP_PORT` | Puerto HTTP | `80` |
| `HTTPS_PORT` | Puerto HTTPS | `443` |
| `YOLO_CONFIDENCE` | Umbral de confianza del detector | `0.50` |
| `SMTP_*` | Servidor de correo para invitaciones y recuperación | Datos del proveedor de correo |

Para `POSTGRES_PASSWORD` y `JWT_SECRET_KEY` deben usarse valores aleatorios. No se deben reutilizar las contraseñas de desarrollo ni usar los caracteres `@`, `%` o `$`.

Si alguna variable obligatoria falta, Docker Compose se detiene con un mensaje que indica cuál definir.

## Dominio y HTTPS

1. En el proveedor del dominio, crear un registro DNS de tipo `A` que apunte `inventariovision.tech` a la dirección IP del servidor.
2. Abrir en el firewall del servidor los puertos `80` y `443`.
3. Definir `SITE_ADDRESS=inventariovision.tech` en `.env.deploy`.

Al iniciar, Caddy solicita el certificado HTTPS de forma automática y lo renueva antes de que venza. Los certificados se guardan en el volumen `caddy_data`, por lo que se conservan aunque se reconstruya el contenedor.

## Puesta en marcha

Desde la raíz del proyecto en el servidor:

1. Clonar el repositorio.
2. Copiar el archivo del modelo en `backend/weights/best.pt`.
3. Crear `.env.deploy` a partir de `.env.deploy.example` y completar las variables.
4. Comprobar que la configuración es válida:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yml config --quiet
```

5. Construir las imágenes e iniciar los servicios:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yml up -d --build
```

6. Aplicar las migraciones de la base de datos:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yml exec api alembic upgrade head
```

7. Crear la primera cuenta administradora:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yml exec api python -m backend.scripts.crear_administrador --email "correo@ejemplo.com" --nombre "Nombre del administrador"
```

El script solicita la contraseña dos veces. Las demás cuentas se crean después desde la aplicación, mediante invitación.

8. Verificar el estado de los servicios:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yml ps
```

Los tres servicios deben aparecer en ejecución y `db` y `api` como saludables.

## Seguridad en producción

Caddy aplica estas medidas a todas las peticiones:

| Medida | Efecto |
|---|---|
| HTTPS automático | Toda la comunicación viaja cifrada |
| `X-Content-Type-Options: nosniff` | El navegador no interpreta archivos con un tipo distinto del declarado |
| `X-Frame-Options: DENY` | La aplicación no puede mostrarse dentro de otra página |
| `Referrer-Policy: no-referrer` | No se envía la dirección de origen a otros sitios |
| Se elimina la cabecera `Server` | No se revela el software del servidor |
| Límite de 12 MB por petición | Se rechazan cargas excesivas |

Además, Caddy responde con `404` a estas rutas cuando se solicitan desde fuera:

| Ruta | Motivo |
|---|---|
| `/health` y `/health/*` | Solo las usan las verificaciones internas |
| `/uploads` | Las fotografías solo se entregan por una ruta autenticada de la API |
| `/docs`, `/redoc` y `/openapi.json` | La documentación interactiva de la API no se publica |

Dentro del contenedor, la API se ejecuta con un usuario sin privilegios y el modelo se monta en solo lectura.

## Actualizaciones

### Actualizar el código

```bash
git pull
docker compose --env-file .env.deploy -f compose.deploy.yml up -d --build
docker compose --env-file .env.deploy -f compose.deploy.yml exec api alembic upgrade head
```

Las migraciones deben aplicarse cada vez que una actualización modifique el esquema de la base de datos.

### Reemplazar el modelo

1. Copiar el nuevo archivo en `backend/weights/best.pt`.
2. Reiniciar la API:

```bash
docker compose --env-file .env.deploy -f compose.deploy.yml restart api
```

No es necesario reconstruir la imagen. El nuevo modelo debe conservar las 10 clases en el mismo orden; al iniciar, la API lo verifica y no pone en marcha el detector si no coinciden.

## Respaldos

El script `deploy/scripts/respaldo-local.ps1` genera un respaldo completo:

1. Inicia la base de datos y comprueba que responde.
2. Detiene `web` y `api` para que no haya cambios durante la copia.
3. Exporta la base de datos con `pg_dump` en formato personalizado.
4. Copia las fotografías del volumen `uploads`.
5. Crea el archivo `RESPALDO_COMPLETO.txt` como señal de que el respaldo terminó.
6. Vuelve a iniciar `api` y `web`, aunque el respaldo haya fallado.

El respaldo se guarda en `backups/<fecha>/`. Una carpeta sin `RESPALDO_COMPLETO.txt` no debe considerarse válida.

El respaldo **no incluye** `.env.deploy` ni `best.pt`. Ambos archivos deben guardarse por separado en un lugar seguro.

### Comprobar la restauración

`deploy/compose.restore.yml` levanta una base de datos aislada, en una red interna, para restaurar un respaldo sin tocar la instalación en uso. Así se comprueba que el respaldo puede recuperarse antes de necesitarlo.

## Mantenimiento

| Tarea | Comando |
|---|---|
| Ver el estado de los servicios | `docker compose --env-file .env.deploy -f compose.deploy.yml ps` |
| Ver los registros de la API | `docker compose --env-file .env.deploy -f compose.deploy.yml logs -f api` |
| Reiniciar un servicio | `docker compose --env-file .env.deploy -f compose.deploy.yml restart <servicio>` |
| Detener la aplicación | `docker compose --env-file .env.deploy -f compose.deploy.yml down` |

`docker compose down` detiene los contenedores, pero conserva los volúmenes. Para no perder datos, no se debe agregar la opción `-v`.

## Solución de problemas

| Situación | Qué revisar |
|---|---|
| Compose indica que falta una variable | Completar la variable mencionada en `.env.deploy` |
| `api` no queda saludable | Revisar sus registros y que `best.pt` exista en `backend/weights` |
| El sitio no obtiene certificado | Que el registro DNS apunte al servidor y que los puertos 80 y 443 estén abiertos |
| No llegan invitaciones ni enlaces de recuperación | La configuración `SMTP_*` y que `FRONTEND_URL` use `https://` |
| El detector no inicia | Que el modelo tenga las 10 clases en el orden esperado |
