/**
 * Config.local.example.gs — PLANTILLA (este sí se versiona)
 * ---------------------------------------------------------------------------
 * Copia este archivo como `local/Config.local.gs` (ignorado por git) y
 * rellénalo con los datos reales SOLO en tu despliegue privado.
 *
 * `Config.gs` detecta la variable global `PERSONAS_SEED` y la usa únicamente
 * para el sembrado inicial de la pestaña 'Configuracion_Personas'. En tiempo de
 * ejecución la fuente de verdad es siempre esa pestaña, no el código.
 *
 * Si prefieres no manejar datos personales en archivos, omite este archivo por
 * completo y rellena la pestaña a mano.
 */

var PERSONAS_SEED = [
  // numero: orden/identificador interno
  // nombre: etiqueta descriptiva del origen (evita datos personales si puedes)
  // id: ID del Spreadsheet de origen a consolidar
  // carpeta_id: ID de la carpeta de Drive asociada
  { numero: 1, nombre: "Origen de ejemplo 1", id: "SPREADSHEET_ID_DE_ORIGEN", carpeta_id: "FOLDER_ID_DE_ORIGEN" },
  { numero: 2, nombre: "Origen de ejemplo 2", id: "SPREADSHEET_ID_DE_ORIGEN", carpeta_id: "FOLDER_ID_DE_ORIGEN" }
];
