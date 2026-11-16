# Procedencia del modelo de detección

## Trabajo realizado

La persona autora de Inventario Visión realizó:

- La toma de fotografías de los productos.
- El etiquetado de las imágenes.
- La preparación del conjunto de datos.
- La ejecución del entrenamiento en Google Colab.
- La evaluación y las pruebas de integración del detector.

La procedencia de las fotografías se documenta en
procedencia-imagenes.md.

## Modelo base y método

El archivo args.yaml del entrenamiento registra:

- Tarea: detección de objetos.
- Modelo base: yolo11n.pt.
- Uso de pesos preentrenados: true.
- Tamaño de imagen configurado: 640.
- Tamaño de lote configurado: 8.
- Máximo de épocas configurado: 100.
- Paciencia de parada temprana configurada: 20.
- Semilla configurada: 42.

El procedimiento corresponde a un ajuste de un modelo
preentrenado con un conjunto propio de imágenes etiquetadas.
No se presenta como un entrenamiento desde pesos aleatorios.

Los parámetros anteriores describen la configuración.
El número de épocas efectivamente completadas y las métricas
obtenidas deben consultarse en los resultados del entrenamiento.

## Artefactos

El entrenamiento produjo el archivo best.pt y archivos de
resultados, configuración y gráficas.

La aplicación utiliza:

- Archivo: backend/weights/best.pt.
- Identificador mostrado por la aplicación: yolo11n-v3.

El identificador de la aplicación no es una versión oficial
del paquete Ultralytics.

## Entornos

El entrenamiento se ejecutó en Google Colab.

La aplicación se ha probado localmente y dentro de Docker.
En el ensayo Docker, el detector se ejecutó mediante CPU.

Las versiones de las bibliotecas de cada entorno deben
registrarse por separado. La versión instalada para ejecutar
la aplicación no demuestra qué versión se utilizó para entrenar.

## Licencias y atribución

El detector utiliza software y un modelo base de Ultralytics.
Estos elementos no se presentan como desarrollos originales
de la persona autora de Inventario Visión.

La toma de datos, el etiquetado, el entrenamiento y la integración
realizados para este proyecto no eliminan las condiciones
aplicables al software ni a los pesos de origen.

Los componentes de terceros y sus licencias se registran
en THIRD_PARTY_NOTICES.md, ubicado en la raíz del repositorio.
