# Avisos de componentes de terceros

Inventario Visión utiliza bibliotecas, herramientas, fuentes
tipográficas y modelos de terceros.

Cada componente conserva su licencia, sus titulares y sus avisos
de copyright. La licencia del código original de Inventario Visión
se encuentra en el archivo LICENSE de la raíz del repositorio y
no sustituye las licencias de sus dependencias.

Este documento identifica componentes utilizados por el proyecto.
No reemplaza los textos de licencia, los archivos NOTICE ni los
avisos específicos incluidos en las distribuciones de terceros.

Fecha del inventario: 15 de noviembre de 2026.

## 1. Fuentes del inventario

Las versiones y denominaciones de licencia indicadas se obtuvieron de:

- Los metadatos de las distribuciones Python del entorno local.
- Los metadatos de Ultralytics, torch y torchvision de la imagen Docker.
- Los archivos package.json de las dependencias instaladas del frontend.

Las versiones declaradas para Python se encuentran en
backend/requirements.txt.

Las dependencias del frontend se declaran en frontend/package.json.
frontend/package-lock.json registra la resolución utilizada por npm.

Las versiones instaladas por separado durante la construcción
del backend se especifican en backend/Dockerfile.

El inventario distingue los entornos cuando sus versiones difieren.
No constituye una enumeración exhaustiva de dependencias transitivas
o de componentes internos de cada distribución.

## 2. Backend: dependencias directas

Versiones consultadas en el entorno Python local:

| Componente | Versión | Licencia declarada |
| --- | --- | --- |
| FastAPI | 0.119.0 | MIT |
| Uvicorn | 0.38.0 | BSD-3-Clause |
| SQLAlchemy | 2.0.44 | MIT |
| asyncpg | 0.30.0 | Apache-2.0 |
| Alembic | 1.17.0 | MIT |
| pydantic-settings | 2.11.0 | MIT |
| pwdlib | 0.2.1 | MIT |
| PyJWT | 2.10.1 | MIT |
| python-multipart | 0.0.20 | Apache-2.0 |
| Pillow | 11.3.0 | MIT-CMU |
| Ultralytics | 8.4.197 | AGPL-3.0 |
| pytest | 8.4.2 | MIT |
| HTTPX | 0.28.1 | BSD-3-Clause |

pytest forma parte de las herramientas de pruebas. Su inclusión
en este inventario no significa que la aplicación lo utilice
para atender solicitudes de usuarios.

## 3. Bibliotecas adicionales del entorno Python local

| Componente | Versión | Licencia declarada |
| --- | --- | --- |
| argon2-cffi | 23.1.0 | MIT |
| torch | 2.15.0 | Expresión compuesta indicada a continuación |
| torchvision | 0.29.2 | BSD, según los metadatos consultados |

Expresión de licencia declarada por la distribución local de torch:

    Apache-2.0 AND Apache-2.0 WITH LLVM-exception AND BSD-2-Clause AND BSD-3-Clause AND BSL-1.0 AND ISC AND MIT AND Zlib

La denominación BSD de torchvision reproduce el metadato consultado.
El texto de licencia incluido en su distribución es la referencia
para sus condiciones específicas.

## 4. Detector en la imagen Docker

Versiones consultadas directamente en la imagen
inventario-vision-api:deploy:

| Componente | Versión | Licencia declarada |
| --- | --- | --- |
| Ultralytics | 8.4.197 | AGPL-3.0 |
| torch | 2.6.0+cpu | BSD-3-Clause |
| torchvision | 0.21.0+cpu | BSD, según los metadatos consultados |

El backend Docker utiliza distribuciones de PyTorch y torchvision
para CPU.

Estas versiones son distintas de las consultadas en el entorno
Python local. No deben intercambiarse las versiones ni los
metadatos de licencia entre ambos entornos.

Las distribuciones pueden incluir componentes adicionales con
sus propios avisos y condiciones.

## 5. Frontend: dependencias directas

Versiones consultadas en los paquetes instalados:

| Componente | Versión | Licencia declarada |
| --- | --- | --- |
| @base-ui/react | 1.8.0 | MIT |
| @fontsource-variable/geist | 5.3.0 | OFL-1.1 |
| @tailwindcss/vite | 4.3.3 | MIT |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| cn | 0.4.0 | MIT |
| lucide-react | 1.50.0 | ISC |
| react | 19.3.0 | MIT |
| react-dom | 19.3.0 | MIT |
| react-router-dom | 7.18.4 | MIT |
| shadcn | 4.21.1 | MIT |
| tailwindcss | 4.3.3 | MIT |
| tw-animate-css | 1.4.0 | MIT |

La pertenencia a dependencies refleja la organización de
frontend/package.json. No implica que todos estos paquetes
se incorporen íntegramente al JavaScript distribuido.

## 6. Frontend: herramientas de desarrollo

| Componente | Versión | Licencia declarada |
| --- | --- | --- |
| @eslint/js | 10.0.1 | MIT |
| @types/node | 24.19.1 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |
| @vitejs/plugin-react | 6.1.1 | MIT |
| eslint | 10.11.0 | MIT |
| eslint-plugin-react-hooks | 7.1.1 | MIT |
| eslint-plugin-react-refresh | 0.5.7 | MIT |
| globals | 17.13.0 | MIT |
| prettier | 3.9.9 | MIT |
| prettier-plugin-tailwindcss | 0.8.1 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| typescript-eslint | 8.71.0 | MIT |
| vite | 8.3.2 | MIT |

Estas herramientas participan en tareas como compilación,
comprobación de tipos, análisis estático y formato del código.

## 7. Fuentes tipográficas e iconos

El frontend utiliza la fuente Geist mediante
@fontsource-variable/geist y los iconos de lucide-react.

Los archivos de licencia de estos recursos se conservan en:

- docs/licenses/geist-LICENSE.txt
- docs/licenses/lucide-react-LICENSE.txt

Los textos completos incluyen los avisos y condiciones
correspondientes a los recursos distribuidos por esos paquetes.

## 8. Procedencia del modelo de detección

El detector utiliza software de Ultralytics.

El archivo args.yaml del entrenamiento registra:

- Modelo base: yolo11n.pt.
- Uso de pesos preentrenados: true.

La persona autora de Inventario Visión realizó la toma de
fotografías, el etiquetado y el entrenamiento de ajuste
en Google Colab.

El entrenamiento produjo el archivo best.pt utilizado
por la aplicación.

Ubicación del archivo en el proyecto:

    backend/weights/best.pt

Identificador mostrado por la aplicación:

    yolo11n-v3

Este identificador es propio de la aplicación y no representa
una versión oficial del paquete Ultralytics.

La configuración y procedencia se describen en:

    docs/modelo-deteccion.md

El trabajo de preparación de datos, entrenamiento e integración
no atribuye a la persona autora la creación del software
Ultralytics ni del modelo preentrenado de origen.

Las condiciones aplicables al software y a los pesos de origen
se conservan independientemente de la autoría de las fotografías.

## 9. Fotografías propias y marcas visibles

La procedencia de las fotografías se documenta en:

    docs/procedencia-imagenes.md

Según la declaración de la persona autora, las fotografías
del conjunto de datos y de las pruebas son propias y muestran
exclusivamente productos, sin personas.

Las marcas, logotipos y diseños de envases que aparezcan
fotografiados pertenecen a sus respectivos titulares.

La licencia del código no concede automáticamente una licencia
sobre las fotografías ni sobre las marcas que estas muestran.

## 10. Servicios e imágenes de infraestructura

El entorno definido en compose.deploy.yml utiliza:

- PostgreSQL mediante la imagen postgres:16-alpine.
- Caddy como servidor del frontend y proxy hacia la API.
- Imágenes base de Python y Node.js para construir o ejecutar
  los componentes, según los Dockerfiles.

Las imágenes de contenedor contienen software de terceros
adicional al inventario de paquetes de este documento.

Sus componentes conservan las licencias y avisos incluidos
por sus respectivos distribuidores.

## 11. Código fuente y alcance de la licencia del proyecto

El archivo LICENSE contiene la GNU Affero General Public
License, versión 3, adoptada para el código original
de Inventario Visión.

Los componentes de terceros mantienen sus propias licencias.
Su uso no implica que sus autores respalden o patrocinen
este proyecto.

Las credenciales, secretos, respaldos operativos y datos
privados no forman parte del código fuente público
del proyecto.

La distribución y el uso por red deben respetar las
obligaciones aplicables de las licencias correspondientes.
