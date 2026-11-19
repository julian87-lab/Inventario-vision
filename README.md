# Inventario Visión

Aplicación para consultar existencias, recibir mercancía con apoyo del
análisis de fotografías y registrar ventas y movimientos de inventario.

Las fotografías generan propuestas de recepción que deben revisarse antes
de confirmar la entrada de mercancía. El análisis de una imagen no
actualiza por sí solo las existencias.

## Documentación

Consulta el [Manual de usuario](docs/manual-usuario.md) para conocer el
recorrido de uso de la aplicación.

## Tecnologías

- Frontend: React, TypeScript, Vite y Tailwind CSS.
- Backend: Python, FastAPI, SQLAlchemy y Alembic.
- Base de datos: PostgreSQL.
- Detección: modelo YOLO mediante Ultralytics.
- Servidor web para producción: Caddy.

## Estructura del proyecto

```text
.
├── backend/          API, base de datos, migraciones, pruebas y modelo
├── frontend/         Aplicación web
├── deploy/           Configuración de Caddy
└── docs/             Documentación del proyecto
```

## Requisitos previos

Para ejecutar el proyecto en un equipo de desarrollo necesitas:

- Docker y Docker Compose.
- Python 3.11.
- Node.js y npm.
- Un navegador actualizado.

## Configuración inicial

1. Clona el repositorio.
2. Crea una copia de `backend/.env.example` llamada `backend/.env`.
3. Completa al menos estas variables:

```env
DATABASE_URL=postgresql+asyncpg://inventario:inventario@127.0.0.1:15432/inventario
JWT_SECRET_KEY=<valor_aleatorio_largo>
DETECTOR=yolo
FRONTEND_URL=http://localhost:5173
```

4. Genera un valor aleatorio para `JWT_SECRET_KEY`.
5. No compartas ni subas a Git el archivo `.env` con credenciales reales.

`JWT_SECRET_KEY` se utiliza para firmar los tokens de sesión. En desarrollo puede utilizarse un valor de prueba; en producción debe ser aleatorio, tener al menos 32 caracteres y mantenerse privado.

## Base de datos

Desde la raíz del proyecto, inicia PostgreSQL:

```powershell
docker compose up -d db
```

La base de datos queda disponible localmente en el puerto `15432`.

## Backend

Abre una terminal y ejecuta:

```powershell
Set-Location ".\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Ejecuta las migraciones desde la raíz del proyecto:

```powershell
Set-Location ".."
alembic upgrade head
```

Crea la primera cuenta administradora:

```powershell
python -m backend.scripts.crear_administrador --email "correo@ejemplo.com" --nombre "Nombre del administrador"
```

El script solicitará la contraseña dos veces. Si la cuenta ya existe, la promueve a administrador y la activa; no cambia su contraseña.

Inicia el backend:

```powershell
Set-Location ".\backend"
.\.venv\Scripts\Activate.ps1
$env:DETECTOR = "yolo"
python -m uvicorn backend.app.main:app --reload --port 8000
```

El backend queda disponible en:

```text
http://127.0.0.1:8000
```

En desarrollo, la documentación de la API está disponible en:

```text
http://127.0.0.1:8000/docs
```

## Frontend

Abre otra terminal, desde la raíz del proyecto:

```powershell
Set-Location ".\frontend"
npm install
npm run dev
```

La aplicación queda disponible en:

```text
http://localhost:5173
```

El frontend redirige las peticiones de `/api` al backend en `http://127.0.0.1:8000`.

## Datos iniciales

El script `backend/scripts/seed.py` crea o actualiza una cuenta administradora de ejemplo y registra productos iniciales.

Desde la raíz del proyecto, con el entorno virtual del backend activo, define una contraseña de al menos 12 caracteres y ejecuta:

```powershell
$env:ADMIN_PASSWORD = "<contrasena_de_al_menos_12_caracteres>"
python -m backend.scripts.seed
```

No utilices este script para crear la cuenta administradora definitiva de producción. Para eso, utiliza `crear_administrador.py` con el correo y el nombre reales.

## Pruebas

Desde `backend`, con el entorno virtual activo:

```powershell
Set-Location ".\backend"
.\.venv\Scripts\Activate.ps1
pytest
```

## Construcción del frontend

Para generar la versión de producción del frontend:

```powershell
Set-Location ".\frontend"
npm run build
```

## Despliegue

Las instrucciones de despliegue, dominio, HTTPS, correo y mantenimiento se documentarán en [Despliegue](docs/despliegue.md).