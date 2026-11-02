# Preparación del dataset de Inventario Visión

Herramientas utilizadas para preparar el dataset v3 de detección
de diez clases de productos.

## Scripts

- convertir_cvat_xml.py: convierte cajas de CVAT XML a etiquetas
  YOLO normalizadas. Las cajas rotadas se convierten a rectángulos
  envolventes alineados con los ejes.
- revisar_etiquetas.py: genera un resumen de clases, informa
  problemas de etiquetas y crea una muestra visual.
- vista_previa.py: genera hojas de imágenes con sus cajas.
- preparar_revision_escenas.py: crea hojas visuales y un CSV
  para asignar manualmente identificadores de escena.
- dividir_dataset.py: reparte grupos de escenas entre entrenamiento,
  validación y prueba, y genera el ZIP para Colab.
- clases.yaml: nombres descriptivos del catálogo por índice de clase.

## Configuración y dependencias

Los scripts utilizan Pillow, pandas y NumPy según la herramienta.
Algunos reciben rutas como argumentos y otros contienen rutas
locales de Windows que deben revisarse antes de ejecutarlos.

El repartidor actual está configurado específicamente para
309 imágenes del dataset v3.

## Reparto v3

- Entrenamiento: 213 imágenes.
- Validación: 46 imágenes.
- Prueba: 50 imágenes.
- Proporciones objetivo: 70%, 15% y 15%.
- Agrupación: escenas revisadas manualmente e imágenes con
  píxeles idénticos.
- El manifiesto y el informe de división se generan junto al dataset.

La separación de escenas visualmente similares depende de la
revisión manual del CSV. La búsqueda exhaustiva del reparto
puede requerir muchos recursos al aumentar las escenas por clase.

## Precauciones

No ejecutar de nuevo los scripts sobre salidas existentes sin
revisar sus rutas y condiciones de sobrescritura.

Los datos, imágenes, ZIP y pesos del modelo se conservan fuera
del código versionado. No añadirlos a Git a la fuerza.