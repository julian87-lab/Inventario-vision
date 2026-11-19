# Arquitectura de Inventario Visión

Inventario Visión es una aplicación web para consultar existencias, recibir mercancía con apoyo del análisis de fotografías y registrar ventas y movimientos de inventario.

El sistema separa la interfaz de uso, la lógica del servidor y la base de datos. Una fotografía genera una propuesta de recepción, pero las existencias solo cambian cuando una persona revisa y confirma las cantidades.

## Visión general

```text
Persona usuaria
      |
      | Navegador
      v
Frontend React
      |
      | Peticiones HTTP a /api
      v
Backend FastAPI
      |
      +--> PostgreSQL
      |
      +--> Modelo YOLO
      |
      +--> Servicio de correo
```

- El **frontend** es la aplicación que la persona usa en el navegador.
- El **backend** recibe las peticiones, aplica las reglas del negocio y protege los datos.
- **PostgreSQL** guarda usuarios, productos, existencias, movimientos, recepciones, alertas, invitaciones y auditoría.
- El **modelo YOLO** analiza la fotografía y propone productos y cantidades.
- El **servicio de correo** envía invitaciones y enlaces para recuperar la contraseña.

## Tecnologías principales

| Componente | Tecnología | Función |
|---|---|---|
| Frontend | React, TypeScript, Vite y Tailwind CSS | Interfaz de uso y navegación |
| Backend | Python y FastAPI | API, reglas de negocio y seguridad |
| Base de datos | PostgreSQL | Persistencia de la información |
| Migraciones | Alembic | Creación y evolución del esquema de la base de datos |
| Autenticación | JWT | Sesiones de las personas usuarias |
| Detección | Ultralytics YOLO | Análisis de fotografías de mercancía |
| Servidor web | Caddy | Publicación del frontend en producción |

## Estructura del proyecto

```text
.
├── backend/
│   ├── alembic/          Migraciones de la base de datos
│   ├── app/              API, modelos, servicios y configuración
│   ├── scripts/          Creación de administrador y datos iniciales
│   ├── tests/            Pruebas automatizadas
│   ├── uploads/          Imágenes recibidas para análisis
│   └── weights/          Modelo YOLO
├── frontend/
│   └── src/              Interfaz, páginas, componentes y lógica de uso
├── deploy/
│   └── Caddyfile         Configuración del servidor web
└── docs/
    ├── manual-usuario.md
    ├── arquitectura.md
    └── despliegue.md
```

## Frontend

El frontend está desarrollado con React y TypeScript. Utiliza Vite como herramienta de desarrollo y construcción, y Tailwind CSS para la apariencia.

La aplicación organiza el acceso mediante rutas:

| Ruta | Sección |
|---|---|
| `/login` | Inicio de sesión |
| `/registro` | Creación de cuenta mediante invitación |
| `/recuperar-contrasena` | Solicitud de recuperación |
| `/restablecer-contrasena` | Elección de una contraseña nueva |
| `/inicio` | Resumen general |
| `/inventario` | Consulta de productos y existencias |
| `/operaciones` | Recepciones, ventas, ajustes, alertas e historial |
| `/perfil` | Datos de la cuenta y contraseña |
| `/administracion` | Gestión de accesos, disponible solo para administradores |

Las rutas protegidas requieren una sesión iniciada. La ruta de administración requiere además el rol de administrador.

El frontend no calcula ni guarda las existencias de forma definitiva. Consulta la API y envía las acciones que la persona realiza; el backend valida cada operación antes de modificar la base de datos.

## Backend

El backend está desarrollado en Python con FastAPI. Expone una API bajo el prefijo `/api` y proporciona los servicios que utiliza el frontend.

Los módulos principales son:

| Módulo | Función |
|---|---|
| `app/main.py` | Crea la aplicación, registra las rutas y define el estado de salud |
| `app/config.py` | Lee la configuración desde variables de entorno |
| `app/database.py` | Configura la conexión con PostgreSQL |
| `app/models/` | Define las tablas de la base de datos |
| `app/routers/` | Define los endpoints de la API |
| `app/services/` | Implementa reglas de negocio, correo, auditoría y detección |
| `app/inference/` | Administra el detector de productos |
| `alembic/` | Contiene las migraciones de la base de datos |
| `scripts/` | Permite crear un administrador y cargar datos iniciales |
| `tests/` | Contiene pruebas automatizadas |

### Endpoints principales

La API organiza sus funciones en estos grupos:

| Grupo | Función |
|---|---|
| `auth` | Inicio de sesión, recuperación de contraseña y gestión de la sesión |
| `admin` | Usuarios, invitaciones y auditoría |
| `productos` | Consulta del catálogo |
| `inventario` | Consulta de existencias y registro de movimientos |
| `alertas` | Consulta de alertas de stock |
| `detecciones` | Recepción y revisión de fotografías |

El backend también expone:

- `/health`: comprueba que la aplicación esté activa.
- `/health/db`: comprueba la conexión con la base de datos.

En desarrollo, la documentación interactiva de la API está disponible en `/docs`. En producción, esa documentación se desactiva.

## Base de datos

La base de datos utiliza PostgreSQL. Las migraciones de Alembic crean y mantienen el esquema.

Las entidades principales son:

| Entidad | Qué representa |
|---|---|
| Usuario | Cuenta de una persona, su rol y estado |
| Invitación | Enlace para crear una cuenta |
| Producto | Mercancía del catálogo y su clase de detección |
| Movimiento | Cambio en las existencias |
| Detección | Propuesta generada a partir de una fotografía |
| Alerta | Aviso de stock bajo o sin stock |
| Restablecimiento de contraseña | Solicitud de recuperación de acceso |
| Evento de auditoría | Registro de acciones administrativas y de cuentas |

### Reglas de inventario

Las existencias cambian mediante movimientos. Cada movimiento conserva:

- Producto afectado.
- Tipo de movimiento.
- Cantidad aplicada.
- Existencias anteriores.
- Existencias posteriores.
- Fecha y hora.
- Persona responsable, cuando corresponde.

Una venta resta unidades. Un ajuste puede sumar o restar unidades y está reservado al rol administrador. Una recepción confirmada suma las cantidades revisadas.

El sistema impide que una venta o un ajuste deje existencias negativas.

## Recepción asistida

El flujo de recepción tiene una regla central: **el análisis de una fotografía no modifica el inventario**.

```text
Fotografía
   |
   v
Análisis con YOLO
   |
   v
Propuesta de recepción
   |
   v
Revisión de la persona
   |
   +--> Corregir cantidades
   +--> Añadir producto omitido
   |
   v
Confirmación
   |
   v
Actualización del inventario
```

1. La persona toma o selecciona una fotografía.
2. El backend la envía al detector.
3. El detector identifica productos y cantidades.
4. El sistema crea una recepción pendiente.
5. La persona compara la propuesta con la mercancía recibida.
6. Puede corregir cantidades o añadir productos omitidos.
7. Al confirmar, el backend registra la entrada y actualiza las existencias.
8. Si la propuesta no corresponde, puede descartarse sin afectar el stock.

La revisión humana es parte del diseño. El modelo puede omitir productos o proponer cantidades incorrectas; por eso, la confirmación requiere la validación de la persona que recibe la mercancía.

## Modelo de detección

El sistema utiliza YOLO para analizar fotografías de mercancía. El modelo se encuentra en `backend/weights/best.pt`.

La configuración permite dos modos:

| Valor de `DETECTOR` | Comportamiento |
|---|---|
| `stub` | Utiliza un detector de prueba |
| `yolo` | Utiliza el modelo YOLO configurado |

En desarrollo, el backend se inicia con `DETECTOR=yolo` para utilizar el modelo real.

La variable `YOLO_CONFIDENCE` define el umbral de confianza del detector. Un valor más alto reduce propuestas poco seguras, pero puede aumentar los productos omitidos. Por ello, la revisión humana sigue siendo necesaria.

## Seguridad y acceso

El sistema utiliza JWT para las sesiones. Al iniciar sesión, el backend entrega un token firmado; las peticiones protegidas deben incluirlo.

Las contraseñas se almacenan mediante hash, no como texto plano. El sistema utiliza Argon2 a través de `pwdlib`.

Las cuentas pueden tener dos roles:

| Rol | Alcance |
|---|---|
| Operador | Consulta, ventas y recepciones |
| Administrador | Funciones de operador, ajustes y administración de accesos |

La administración permite invitar personas, cambiar roles, activar o desactivar cuentas y consultar auditoría. Las cuentas no se eliminan; se desactivan para conservar el historial.

## Auditoría

La auditoría registra acciones relacionadas con cuentas, invitaciones, roles y administración.

No debe confundirse con el historial de inventario:

| Registro | Qué consulta |
|---|---|
| Auditoría | Acciones de cuentas, invitaciones, roles y administración |
| Historial de inventario | Recepciones confirmadas, ventas y ajustes |

Ambos registros apoyan la trazabilidad, pero responden a preguntas distintas.

## Correo

El backend utiliza SMTP para enviar:

- Invitaciones para crear una cuenta.
- Enlaces para recuperar la contraseña.

La configuración de correo es opcional en desarrollo. Para producción, deben configurarse el servidor SMTP, el puerto, la cuenta remitente y las credenciales correspondientes.

Los enlaces de recuperación tienen vigencia limitada y solo pueden utilizarse una vez.

## Puesta en producción

En producción, el frontend se construye con Vite y se publica mediante Caddy. El backend expone la API y se conecta con PostgreSQL.

La configuración de producción exige:

- `ENVIRONMENT=production`.
- Una `JWT_SECRET_KEY` aleatoria de al menos 32 caracteres.
- Un `FRONTEND_URL` que comience con `https://`.
- Configuración segura de la base de datos.
- Configuración del servicio de correo.

La documentación operativa correspondiente se encuentra en [Despliegue](despliegue.md).

## Decisiones de diseño

- **Revisión humana obligatoria:** una fotografía genera una propuesta, no una entrada definitiva.
- **Trazabilidad de movimientos:** cada cambio conserva el estado anterior y posterior.
- **Roles diferenciados:** el rol operador cubre el trabajo diario; el administrador gestiona ajustes y accesos.
- **Cuentas desactivables:** no se eliminan, para conservar el historial.
- **Separación de responsabilidades:** el frontend presenta información; el backend valida y aplica las reglas.
- **Auditoría separada del inventario:** cada tipo de registro responde a un propósito distinto.